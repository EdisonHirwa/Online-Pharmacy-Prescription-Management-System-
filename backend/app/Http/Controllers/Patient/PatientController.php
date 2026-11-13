<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Controller;
use App\Http\Requests\PatientAppointmentRequest;
use App\Http\Requests\PatientProfileRequest;
use App\Http\Resources\PatientRecordResource;
use App\Models\Admission;
use App\Models\Appointment;
use App\Models\Consultation;
use App\Models\Department;
use App\Models\Doctor;
use App\Models\Invoice;
use App\Models\LabReport;
use App\Models\LabTest;
use App\Models\Patient;
use App\Models\Payment;
use App\Models\Prescription;
use App\Models\Specialization;
use App\Services\AuditService;
use App\Services\PatientAccess;
use App\Services\PatientWorkflowService;
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

class PatientController extends Controller
{
    public function __construct(private PatientWorkflowService $workflows) {}

    private function patient(): Patient
    {
        return PatientAccess::profile(auth()->user());
    }

    private function permission(string $resource): string
    {
        return match ($resource) {
            'prescriptions' => 'view_prescriptions','invoices','payments' => 'view_invoices',default => 'view_own_records'
        };
    }

    private function query(string $resource): Builder
    {
        PatientAccess::requirePermission($this->permission($resource));
        $id = $this->patient()->id;

        return match ($resource) {
            'appointments' => Appointment::with('doctor.user', 'doctor.department', 'doctor.specialization')->where('patient_id', $id),
            'consultations' => Consultation::with('doctor.user', 'doctor.department', 'doctor.specialization')->where('patient_id', $id),
            'prescriptions' => Prescription::with('doctor.user', 'doctor.department', 'doctor.specialization', 'items.medicine')->where('patient_id', $id),
            'lab-tests' => LabTest::with('doctor.user', 'doctor.department', 'doctor.specialization', 'test_type', 'reports')->where('patient_id', $id),
            'invoices' => Invoice::with('items', 'payments.invoice')->where('patient_id', $id),
            'payments' => Payment::with('invoice')->whereHas('invoice', fn ($q) => $q->where('patient_id', $id)),
            'admissions' => Admission::with('bed.ward')->where('patient_id', $id),default => abort(404),
        };
    }

    public function profile(): PatientRecordResource
    {
        return new PatientRecordResource($this->patient()->load('user'));
    }

    public function updateProfile(PatientProfileRequest $request): PatientRecordResource
    {
        $patient = $this->patient();
        DB::transaction(function () use ($patient, $request): void {
            $patient->update($request->validated());
            AuditService::record('patient_profile_updated', 'patients', $patient->id);
        });

        return new PatientRecordResource($patient->load('user'));
    }

    public function history(): JsonResponse
    {
        PatientAccess::requirePermission('view_own_records');
        $id = $this->patient()->id;
        AuditService::record('patient_record_viewed', 'patients', $id);

        return response()->json(['data' => ['allergies' => DB::table('patient_allergies')->where('patient_id', $id)->orderByDesc('id')->get(['id', 'allergy_name', 'severity', 'reaction_description', 'recorded_date']), 'medical_histories' => DB::table('patient_medical_histories')->where('patient_id', $id)->orderByDesc('id')->get(['id', 'condition', 'diagnosis_details', 'treatment_history', 'recorded_date'])]]);
    }

    public function dashboard(): JsonResponse
    {
        $id = $this->patient()->id;
        $user = auth()->user();
        $can = fn ($p) => PatientAccess::can($user, $p);
        $permissions = collect(['view_own_records', 'book_appointments', 'view_prescriptions', 'view_invoices'])->mapWithKeys(fn ($p) => [$p => $can($p)])->all();
        $appointments = Appointment::where('patient_id', $id);
        $upcoming = (clone $appointments)->whereIn('status', ['pending', 'confirmed'])->where(fn ($q) => $q->whereDate('appointment_date', '>', today())->orWhere(fn ($q) => $q->whereDate('appointment_date', today())->whereTime('appointment_time', '>', now()->format('H:i:s'))));

        return response()->json(['data' => ['today' => today()->toDateString(), 'timezone' => config('app.timezone'), 'currency' => config('hospital.currency', 'RWF'), 'permissions' => $permissions,
            'upcoming_appointments' => $can('view_own_records') ? (clone $upcoming)->count() : null,
            'active_prescriptions' => $can('view_prescriptions') ? Prescription::where('patient_id', $id)->whereIn('status', ['pending', 'partially_dispensed'])->count() : null,
            'available_lab_reports' => $can('view_own_records') ? LabReport::where('report_status', 'completed')->whereHas('labTest', fn ($q) => $q->where('patient_id', $id)->where('status', 'completed'))->count() : null,
            'outstanding_balance' => $can('view_invoices') ? (float) Invoice::where('patient_id', $id)->whereIn('status', ['unpaid', 'partially_paid'])->sum('outstanding_balance') : null,
            'appointments_by_status' => $can('view_own_records') ? (clone $appointments)->selectRaw('status,count(*) as count')->groupBy('status')->get()->map(fn ($a) => ['name' => ucfirst($a->status), 'count' => $a->count]) : [],
            'next_appointments' => $can('view_own_records') ? PatientRecordResource::collection((clone $upcoming)->with('doctor.user', 'doctor.department', 'doctor.specialization')->orderBy('appointment_date')->orderBy('appointment_time')->limit(5)->get()) : [],
        ]]);
    }

    private function doctors(): Builder
    {
        return Doctor::with('user', 'department', 'specialization', 'schedules')->where('professional_status', 'active')->whereHas('user', fn ($q) => $q->where('role', 'doctor')->where('account_status', 'active'))->whereHas('department', fn ($q) => $q->where('status', 'active'))->whereHas('specialization', fn ($q) => $q->where('status', 'active'));
    }

    public function directory(): JsonResponse
    {
        return response()->json(['data' => ['departments' => Department::where('status', 'active')->orderBy('name')->get(['id', 'name', 'description']), 'specializations' => Specialization::where('status', 'active')->whereHas('department', fn ($q) => $q->where('status', 'active'))->orderBy('name')->get(['id', 'department_id', 'name']), 'today' => today()->toDateString(), 'timezone' => config('app.timezone'), 'currency' => config('hospital.currency', 'RWF'), 'can_book' => PatientAccess::can(auth()->user(), 'book_appointments')]]);
    }

    public function doctorList(Request $request): AnonymousResourceCollection
    {
        $request->validate(['department_id' => 'nullable|integer', 'specialization_id' => 'nullable|integer', 'search' => 'nullable|string|max:255', 'per_page' => 'sometimes|integer|between:1,100', 'page' => 'sometimes|integer|min:1']);
        $query = $this->doctors();
        foreach (['department_id', 'specialization_id'] as $key) {
            if ($request->filled($key)) {
                $query->where($key, $request->integer($key));
            }
        }
        if ($request->filled('search')) {
            $query->whereHas('user', fn ($q) => $q->where('name', 'like', '%'.$request->input('search').'%'));
        }

        return PatientRecordResource::collection($query->orderBy('id')->paginate($request->integer('per_page', 12)));
    }

    public function doctorDetail(int $id): PatientRecordResource
    {
        return new PatientRecordResource($this->doctors()->findOrFail($id));
    }

    public function slots(Request $request, int $id): JsonResponse
    {
        PatientAccess::requirePermission('book_appointments');
        $data = $request->validate(['date' => 'required|date_format:Y-m-d|after_or_equal:today', 'appointment_id' => 'nullable|integer']);
        $exclude = null;
        if (! empty($data['appointment_id'])) {
            $appointment = Appointment::findOrFail($data['appointment_id']);
            Gate::authorize('patient-record', $appointment);
            PatientWorkflowService::assertUpcoming($appointment);
            $exclude = $appointment->id;
        }

        return response()->json(['data' => $this->workflows->slots($this->doctors()->findOrFail($id), $data['date'], $exclude), 'timezone' => config('app.timezone')]);
    }

    public function book(PatientAppointmentRequest $request, ?int $id = null): PatientRecordResource
    {
        return new PatientRecordResource($this->workflows->book($request->validated(), $id)->load('doctor.user', 'doctor.department', 'doctor.specialization'));
    }

    public function cancel(Request $request, int $id): PatientRecordResource
    {
        $data = $request->validate(['cancellation_reason' => 'required|string|min:3|max:1000', 'status' => 'prohibited', 'patient_id' => 'prohibited']);

        return new PatientRecordResource($this->workflows->cancel($id, $data['cancellation_reason'])->load('doctor.user', 'doctor.department', 'doctor.specialization'));
    }

    public function index(Request $request, string $resource): AnonymousResourceCollection
    {
        $request->validate(['patient_id' => 'prohibited', 'per_page' => 'sometimes|integer|between:1,100', 'page' => 'sometimes|integer|min:1', 'search' => 'nullable|string|max:255', 'status' => 'nullable|string|max:50', 'payment_method' => 'nullable|in:cash,card,mobile_money', 'sort' => 'nullable|string|max:50', 'direction' => 'nullable|in:asc,desc', 'start_date' => 'nullable|date_format:Y-m-d', 'end_date' => ['nullable', 'date_format:Y-m-d', Rule::when($request->filled('start_date'), 'after_or_equal:start_date')]]);
        $query = $this->query($resource);
        if ($request->filled('status')) {
            $query->where($resource === 'payments' ? 'transaction_status' : 'status', $request->input('status'));
        }
        if ($resource === 'payments' && $request->filled('payment_method')) {
            $query->where('payment_method', $request->input('payment_method'));
        }
        if ($request->filled('search')) {
            $search = '%'.$request->input('search').'%';
            if (in_array($resource, ['appointments', 'consultations', 'prescriptions', 'lab-tests'], true)) {
                $query->whereHas('doctor.user', fn ($q) => $q->where('name', 'like', $search));
            } elseif ($resource === 'invoices') {
                $query->where('invoice_number', 'like', $search);
            } elseif ($resource === 'payments') {
                $query->where('payment_reference', 'like', $search);
            }
        }
        $date = match ($resource) {
            'appointments' => 'appointment_date','prescriptions' => 'issue_date','lab-tests' => 'request_date','invoices' => 'issue_date','payments' => 'payment_date','admissions' => 'admission_date',default => 'created_at'
        };
        if ($request->filled('start_date')) {
            $query->whereDate($date, '>=', $request->input('start_date'));
        }
        if ($request->filled('end_date')) {
            $query->whereDate($date, '<=', $request->input('end_date'));
        }
        $sorts = ['id', $date, 'status'];
        if ($resource === 'invoices') {
            $sorts = array_merge($sorts, ['invoice_number', 'total_amount', 'amount_paid', 'outstanding_balance']);
        }if ($resource === 'payments') {
            $sorts = ['id', $date, 'amount', 'payment_method', 'transaction_status'];
        }
        $sort = in_array($request->input('sort'), $sorts, true) ? $request->input('sort') : 'id';

        return PatientRecordResource::collection($query->orderBy($sort, $request->input('direction', 'desc'))->paginate($request->integer('per_page', 10)));
    }

    public function show(string $resource, int $id): PatientRecordResource
    {
        PatientAccess::requirePermission($this->permission($resource));
        $model = match ($resource) {
            'appointments' => Appointment::class,'consultations' => Consultation::class,'prescriptions' => Prescription::class,'lab-tests' => LabTest::class,'invoices' => Invoice::class,'payments' => Payment::class,'admissions' => Admission::class,default => abort(404)
        };
        $record = $model::findOrFail($id);
        Gate::authorize('patient-record', $record);
        AuditService::record('patient_record_viewed', $record->getTable(), $id);

        return new PatientRecordResource($this->query($resource)->findOrFail($id));
    }

    public function downloadLab(int $id): StreamedResponse
    {
        PatientAccess::requirePermission('view_own_records');
        $record = LabReport::with('labTest')->findOrFail($id);
        Gate::authorize('patient-record', $record);
        abort_unless($record->report_status === 'completed' && $record->labTest?->status === 'completed', 409, 'This report is not completed.');
        abort_unless(Storage::disk('local')->exists($record->file_path), 404, 'The report file is unavailable.');
        AuditService::record('report_downloaded', 'lab_reports', $id);

        return Storage::disk('local')->download($record->file_path, 'laboratory-report-'.$id.'.'.pathinfo($record->file_path, PATHINFO_EXTENSION));
    }

    public function downloadPrescription(int $id): Response
    {
        PatientAccess::requirePermission('view_prescriptions');
        $record = Prescription::with('patient.user', 'doctor.user', 'items.medicine')->findOrFail($id);
        Gate::authorize('patient-record', $record);
        $lines = ['Prescription #'.$record->id, 'Patient: '.$record->patient->user->name, 'Doctor: '.($record->doctor?->user?->name ?? 'Unavailable'), 'Status: '.$record->status, 'Issued: '.$record->issue_date, ''];
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

        return $this->pdf('Electronic Prescription', $lines, 'prescription-'.$id.'.pdf');
    }

    public function downloadInvoice(int $id): Response
    {
        PatientAccess::requirePermission('view_invoices');
        $record = Invoice::with('items', 'patient.user')->findOrFail($id);
        Gate::authorize('patient-record', $record);
        $currency = config('hospital.currency', 'RWF');
        $lines = ['Invoice: '.$record->invoice_number, 'Patient: '.$record->patient->user->name, 'Issued: '.$record->issue_date, 'Status: '.$record->status, ''];
        foreach ($record->items as $item) {
            foreach (explode("\n", wordwrap($item->service_description, 90, "\n", true)) as $line) {
                $lines[] = $line;
            }$lines[] = $item->quantity.' x '.$item->unit_price.' = '.$item->subtotal.' '.$currency;
            $lines[] = '';
        }
        $lines[] = 'Total: '.$record->total_amount.' '.$currency;
        $lines[] = 'Paid: '.$record->amount_paid.' '.$currency;
        $lines[] = 'Outstanding: '.$record->outstanding_balance.' '.$currency;
        AuditService::record('invoice_downloaded','invoices',$id);

        return $this->pdf('Patient Invoice',$lines,'invoice-'.$id.'.pdf');
    }

    private function pdf(string $title,array $lines,string $filename): Response
    {
        return response(PdfReport::render($title,$lines),200,['Content-Type' => 'application/pdf', 'Content-Disposition' => 'attachment; filename="'.$filename.'"']);
    }
}
