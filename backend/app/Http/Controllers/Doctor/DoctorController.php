<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Controller;
use App\Http\Requests\ConsultationRequest;
use App\Http\Requests\DoctorScheduleRequest;
use App\Http\Requests\LabInvestigationRequest;
use App\Http\Requests\PrescriptionRequest;
use App\Http\Resources\DoctorRecordResource;
use App\Models\Appointment;
use App\Models\Consultation;
use App\Models\Doctor;
use App\Models\DoctorSchedule;
use App\Models\LabReport;
use App\Models\LabTest;
use App\Models\LabTestType;
use App\Models\Medicine;
use App\Models\Patient;
use App\Models\Prescription;
use App\Models\User;
use App\Services\AdminWorkflowService;
use App\Services\AuditService;
use App\Services\DoctorAccess;
use App\Services\DoctorWorkflowService;
use App\Services\PdfReport;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DoctorController extends Controller
{
    public function __construct(private DoctorWorkflowService $workflows) {}

    private function doctor(): Doctor
    {
        return DoctorAccess::profile(auth()->user());
    }

    private function patients(): Builder
    {
        $id = $this->doctor()->id;

        return Patient::where(fn ($q) => $q->whereHas('appointments', fn ($a) => $a->where('doctor_id', $id)->whereIn('status', ['pending', 'confirmed', 'completed']))->orWhereHas('consultations', fn ($c) => $c->where('doctor_id', $id)));
    }

    public function profile(): DoctorRecordResource
    {
        return new DoctorRecordResource($this->doctor()->load('user', 'department', 'specialization'));
    }

    public function updateProfile(Request $request): DoctorRecordResource
    {
        $data = $request->validate(['bio' => 'nullable|string|max:5000', 'room_number' => 'nullable|string|max:50', 'user_id' => 'prohibited', 'department_id' => 'prohibited', 'specialization_id' => 'prohibited', 'license_number' => 'prohibited', 'consultation_fee' => 'prohibited', 'professional_status' => 'prohibited']);
        $doctor = $this->doctor();
        $doctor->update($data);
        AuditService::record('doctor_profile_updated', 'doctors', $doctor->id);

        return new DoctorRecordResource($doctor->load('user', 'department', 'specialization'));
    }

    public function options(): JsonResponse
    {
        return response()->json(['data' => [
            'today' => today()->toDateString(),
            'medicines' => Medicine::where('status', 'active')->whereDate('expiry_date', '>=', today())->orderBy('name')->get(['id', 'name', 'unit', 'available_stock', 'unit_price', 'expiry_date']),
            'lab_test_types' => LabTestType::where('status', 'active')->orderBy('name')->get(['id', 'name', 'price', 'expected_turnaround_time']),
            'permissions' => ['manage_schedules' => DoctorAccess::can(auth()->user(), 'manage_schedules'), 'manage_consultations' => DoctorAccess::can(auth()->user(), 'manage_consultations') && $this->doctor()->professional_status === 'active'],
        ]]);
    }

    public function dashboard(): JsonResponse
    {
        $id = $this->doctor()->id;
        $appointments = Appointment::where('doctor_id', $id);
        $statistics = (clone $appointments)->selectRaw('status,count(*) as count')->groupBy('status')->get()->map(fn ($row) => ['name' => ucfirst($row->status), 'count' => $row->count]);

        return response()->json(['data' => [
            'today_appointments' => (clone $appointments)->whereDate('appointment_date', today())->whereNotIn('status', ['cancelled', 'rejected'])->count(),
            'patients_consulted' => Consultation::where('doctor_id', $id)->distinct()->count('patient_id'),
            'pending_laboratory' => LabTest::where('doctor_id', $id)->whereIn('status', ['requested', 'assigned', 'processing'])->count(),
            'upcoming_appointments' => (clone $appointments)->whereDate('appointment_date', '>=', today())->whereIn('status', ['pending', 'confirmed'])->count(),
            'appointments_by_status' => $statistics, 'professional_status' => $this->doctor()->professional_status,
            'recent_appointments' => DoctorRecordResource::collection((clone $appointments)->with('patient.user')->whereIn('status', ['pending', 'confirmed'])->orderBy('appointment_date')->orderBy('appointment_time')->limit(5)->get()),
        ]]);
    }

    private function query(string $resource): Builder
    {
        $id = $this->doctor()->id;

        return match ($resource) {
            'schedules' => DoctorSchedule::where('doctor_id', $id),
            'appointments' => Appointment::with('patient.user')->where('doctor_id', $id),
            'patients' => $this->patients()->with('user'),
            'consultations' => Consultation::with('patient.user', 'appointment')->where('doctor_id', $id),
            'prescriptions' => Prescription::with('patient.user', 'items.medicine', 'consultation')->where('doctor_id', $id),
            'lab-requests' => LabTest::with('patient.user', 'test_type', 'reports', 'consultation')->where('doctor_id', $id),
            default => abort(404),
        };
    }

    public function index(Request $request, string $resource): AnonymousResourceCollection
    {
        $request->validate(['per_page' => 'sometimes|integer|between:1,100', 'page' => 'sometimes|integer|min:1', 'search' => 'nullable|string|max:255', 'status' => 'nullable|string|max:50', 'patient_id' => 'nullable|integer', 'start_date' => 'nullable|date_format:Y-m-d', 'end_date' => ['nullable', 'date_format:Y-m-d', Rule::when($request->filled('start_date'), 'after_or_equal:start_date')], 'sort' => 'nullable|string|max:50', 'direction' => 'nullable|in:asc,desc']);
        $query = $this->query($resource);
        if ($request->filled('search')) {
            $search = $request->input('search');
            if ($resource === 'patients') {
                $query->where(fn ($q) => $q->where('patient_number', 'like', '%'.$search.'%')->orWhereHas('user', fn ($u) => $u->where('name', 'like', '%'.$search.'%')->orWhere('phone_number', 'like', '%'.$search.'%')));
            } elseif ($resource === 'schedules') {
                $query->where('day_of_week', 'like', '%'.$search.'%');
            } else {
                $query->whereHas('patient.user', fn ($q) => $q->where('name', 'like', '%'.$search.'%'));
            }
        }
        if ($request->filled('status') && in_array($resource, ['appointments', 'prescriptions', 'lab-requests'], true)) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('patient_id') && in_array($resource, ['appointments', 'consultations', 'prescriptions', 'lab-requests'], true)) {
            $query->where('patient_id', $request->integer('patient_id'));
        }
        $date = match ($resource) {
            'appointments' => 'appointment_date','lab-requests' => 'request_date','prescriptions' => 'issue_date',default => 'created_at'
        };
        if ($request->filled('start_date')) {
            $query->whereDate($date, '>=', $request->input('start_date'));
        }
        if ($request->filled('end_date')) {
            $query->whereDate($date, '<=', $request->input('end_date'));
        }
        $sorts = match ($resource) {
            'patients' => ['id', 'user', 'patient_number', 'date_of_birth', 'gender', 'blood_group', 'created_at'], 'appointments' => ['id', 'appointment_number', 'appointment_date', 'appointment_time', 'status'],'schedules' => ['id', 'day_of_week', 'start_time'],'prescriptions' => ['id', 'issue_date', 'status'],'lab-requests' => ['id', 'request_date', 'status'],default => ['id', 'created_at']
        };
        $sort = in_array($request->input('sort'), $sorts, true) ? $request->input('sort') : 'id';

        if ($resource === 'patients' && $sort === 'user') {
            $query->orderBy(User::select('name')->whereColumn('users.id', 'patients.user_id'), $request->input('direction', 'desc'));
        } else {
            $query->orderBy($sort, $request->input('direction', 'desc'));
        }

        return DoctorRecordResource::collection($query->paginate($request->integer('per_page', 10)));
    }

    public function show(string $resource, int $id): DoctorRecordResource
    {
        $model = match ($resource) {
            'schedules' => DoctorSchedule::class,'appointments' => Appointment::class,'patients' => Patient::class,'consultations' => Consultation::class,'prescriptions' => Prescription::class,'lab-requests' => LabTest::class,default => abort(404)
        };
        $record = $model::findOrFail($id);
        Gate::authorize('view', $record);
        if ($resource === 'patients') {
            $record->load('user');
            $record->setAttribute('appointments', DoctorRecordResource::collection(Appointment::with('doctor.user')->where('patient_id', $id)->where('doctor_id', $this->doctor()->id)->latest()->get())->resolve());
            $record->setAttribute('consultations', DoctorRecordResource::collection(Consultation::with('doctor.user')->where('patient_id', $id)->latest()->get())->resolve());
            $record->setAttribute('allergies', DB::table('patient_allergies')->where('patient_id', $id)->get()->toArray());
            $record->setAttribute('medical_histories', DB::table('patient_medical_histories')->where('patient_id', $id)->get()->toArray());
            $record->setAttribute('prescriptions', DoctorRecordResource::collection(Prescription::with('items.medicine')->where('patient_id', $id)->latest()->get())->resolve());
            $record->setAttribute('lab_tests', DoctorRecordResource::collection(LabTest::with('test_type', 'reports')->where('patient_id', $id)->where('status', 'completed')->latest()->get())->resolve());
            AuditService::record('patient_record_viewed', 'patients', $id);
        } else {
            $record = $this->query($resource)->findOrFail($id);
            if ($resource === 'consultations') {
                $record->load('prescriptions.items.medicine', 'labTests.test_type', 'labTests.reports');
            }
            AuditService::record('clinical_record_viewed', $record->getTable(), $id);
        }

        return new DoctorRecordResource($record);
    }

    public function saveSchedule(DoctorScheduleRequest $request, ?int $id = null): DoctorRecordResource
    {
        return new DoctorRecordResource($this->workflows->schedule($request->validated(), $id));
    }

    public function deleteSchedule(int $id): JsonResponse
    {
        $this->workflows->schedule([], $id, true);

        return response()->json(['message' => 'Schedule deleted.']);
    }

    public function consultation(ConsultationRequest $request): DoctorRecordResource
    {
        return new DoctorRecordResource($this->workflows->consultation($request->validated())->load('patient.user', 'appointment'));
    }

    public function prescription(PrescriptionRequest $request, ?int $id = null): DoctorRecordResource
    {
        return new DoctorRecordResource($this->workflows->prescription($request->validated(), $id));
    }

    public function cancelPrescription(int $id): DoctorRecordResource
    {
        return new DoctorRecordResource($this->workflows->cancelPrescription($id));
    }

    public function laboratory(LabInvestigationRequest $request): JsonResponse
    {
        return response()->json(['data' => DoctorRecordResource::collection(collect($this->workflows->laboratory($request->validated())))], 201);
    }

    public function cancelLab(int $id): DoctorRecordResource
    {
        return new DoctorRecordResource($this->workflows->cancelLab($id));
    }

    public function appointmentStatus(Request $request, int $id): DoctorRecordResource
    {
        DoctorAccess::requirePermission($request->user(), 'manage_consultations', true);
        $record = Appointment::findOrFail($id);
        Gate::authorize('view', $record);
        $data = $request->validate(['status' => 'required|in:confirmed,cancelled,rejected', 'cancellation_reason' => 'nullable|required_if:status,cancelled,rejected|string|max:1000']);

        return new DoctorRecordResource(app(AdminWorkflowService::class)->appointmentStatus($id, $data));
    }

    public function patientNote(Request $request, int $id, string $kind): JsonResponse
    {
        DoctorAccess::requirePermission($request->user(), 'manage_consultations', true);
        $patient = Patient::findOrFail($id);
        Gate::authorize('view', $patient);
        if ($kind === 'allergies') {
            $table = 'patient_allergies';
            $data = $request->validate(['allergy_name' => 'required|string|max:255', 'severity' => 'required|in:mild,moderate,severe', 'reaction_description' => 'nullable|string|max:5000']);
        } elseif ($kind === 'medical-history') {
            $table = 'patient_medical_histories';
            $data = $request->validate(['condition' => 'required|string|max:255', 'diagnosis_details' => 'required|string|max:5000', 'treatment_history' => 'nullable|string|max:5000']);
        } else {
            abort(404);
        }
        $recordId = DB::transaction(function () use ($data, $table, $patient): int {
            Patient::whereKey($patient->id)->lockForUpdate()->firstOrFail();
            $id = DB::table($table)->insertGetId($data + ['patient_id' => $patient->id, 'recorded_date' => today()->toDateString(), 'created_at' => now(), 'updated_at' => now()]);
            AuditService::record('clinical_history_added', $table, $id);

            return $id;
        });

        return response()->json(['data' => DB::table($table)->find($recordId), 'message' => 'History recorded.'], 201);
    }

    public function downloadReport(int $id): StreamedResponse
    {
        $report = LabReport::with('labTest.patient')->findOrFail($id);
        abort_unless($report->labTest?->patient, 404);
        Gate::authorize('view', $report->labTest->patient);
        abort_unless($report->report_status === 'completed' && $report->labTest->status === 'completed', 409, 'The report is not completed.');
        abort_unless(Storage::disk('local')->exists($report->file_path), 404, 'Report file is unavailable.');
        AuditService::record('report_downloaded', 'lab_reports', $id);

        return Storage::disk('local')->download($report->file_path, 'laboratory-report-'.$id.'.'.pathinfo($report->file_path, PATHINFO_EXTENSION));
    }

    public function prescriptionPdf(int $id): Response
    {
        $record = Prescription::with('patient.user', 'doctor.user', 'items.medicine')->findOrFail($id);
        Gate::authorize('view', $record);
        $lines = ['Prescription #'.$record->id, 'Status: '.$record->status, 'Patient: '.$record->patient->user->name, 'Doctor: '.$record->doctor->user->name, 'Issued: '.$record->issue_date, ''];
        foreach ($record->items as $item) {
            $lines[] = $item->medicine?->name ?? 'Medicine unavailable';
            $lines[] = 'Dosage: '.$item->dosage.'; Frequency: '.$item->frequency;
            $lines[] = 'Duration: '.$item->duration.'; Quantity: '.$item->quantity;
            $lines[] = '';
        }
        foreach (explode("\n", wordwrap($record->prescription_instructions ?? '', 95, "\n", true)) as $line) {
            $lines[] = $line;
        }
        AuditService::record('prescription_downloaded', 'prescriptions', $id);

        return response(PdfReport::render('Electronic Prescription', $lines), 200, ['Content-Type' => 'application/pdf', 'Content-Disposition' => 'attachment; filename="prescription-'.$id.'.pdf"']);
    }
}
