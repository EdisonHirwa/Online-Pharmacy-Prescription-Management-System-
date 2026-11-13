<?php

namespace App\Http\Controllers\Laboratory;

use App\Http\Controllers\Controller;
use App\Http\Requests\LaboratoryReportRequest;
use App\Http\Requests\LaboratoryResultRequest;
use App\Http\Resources\LaboratoryReportResource;
use App\Http\Resources\LaboratoryTestResource;
use App\Models\LabReport;
use App\Models\LabTest;
use App\Models\LabTestType;
use App\Models\Patient;
use App\Services\AuditService;
use App\Services\LaboratoryAccess;
use App\Services\LaboratoryWorkflowService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class LaboratoryController extends Controller
{
    public function __construct(private LaboratoryWorkflowService $workflows) {}

    private function visible(): Builder
    {
        return LabTest::where(fn ($q) => $q->where('assigned_technician_id', auth()->id())->orWhere(fn ($q) => $q->whereNull('assigned_technician_id')->where('status', 'requested')));
    }

    private function relations(): array
    {
        return ['patient.user', 'doctor.user', 'doctor.department', 'test_type', 'consultation', 'reports'];
    }

    private function readable(int $id): LabTest
    {
        $test = LabTest::findOrFail($id);
        Gate::authorize('laboratory-record', $test);

        return $test;
    }

    private function resource(LabTest $test): LaboratoryTestResource
    {
        return new LaboratoryTestResource($test->load($this->relations()));
    }

    public function dashboard(): JsonResponse
    {
        $mine = LabTest::where('assigned_technician_id', auth()->id());
        $trend = [];
        for ($i = 5; $i >= 0; $i--) {
            $start = now()->startOfMonth()->subMonths($i);
            $trend[] = ['period' => $start->format('M Y'), 'count' => (clone $mine)->where('status', 'completed')->whereBetween('updated_at', [$start, $start->copy()->endOfMonth()])->count()];
        }

        return response()->json(['data' => ['unassigned_requests' => LabTest::whereNull('assigned_technician_id')->where('status', 'requested')->count(), 'assigned_to_me' => (clone $mine)->where('status', 'assigned')->count(), 'processing' => (clone $mine)->where('status', 'processing')->count(), 'completed' => (clone $mine)->where('status', 'completed')->count(), 'completed_today' => (clone $mine)->where('status', 'completed')->whereDate('updated_at', today())->count(), 'completion_trend' => $trend, 'can_manage' => LaboratoryAccess::canManage(auth()->user())]]);
    }

    public function options(): JsonResponse
    {
        return response()->json(['data' => ['test_types' => LabTestType::orderBy('name')->get(['id', 'name', 'expected_turnaround_time', 'status']), 'can_manage' => LaboratoryAccess::canManage(auth()->user()), 'max_upload_size' => 2 * 1024 * 1024, 'allowed_file_types' => ['application/pdf', 'image/jpeg', 'image/png']]]);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate(['mode' => 'nullable|in:all,queue,work,reports,history', 'status' => 'nullable|in:requested,assigned,processing,completed,cancelled', 'test_type_id' => 'nullable|integer', 'search' => 'nullable|string|max:255', 'per_page' => 'sometimes|integer|between:1,100', 'page' => 'sometimes|integer|min:1', 'sort' => 'nullable|in:id,patient,test_type,status,request_date,updated_at', 'direction' => 'nullable|in:asc,desc', 'start_date' => 'nullable|date_format:Y-m-d', 'end_date' => ['nullable', 'date_format:Y-m-d', Rule::when($request->filled('start_date'), 'after_or_equal:start_date')], 'assigned_technician_id' => 'prohibited']);
        $query = $this->visible()->with($this->relations());
        $mode = $request->input('mode', 'all');
        if ($mode === 'queue') {
            $query->whereNull('assigned_technician_id')->where('status', 'requested');
        }
        if (in_array($mode, ['work', 'reports', 'history'], true)) {
            $query->where('assigned_technician_id', auth()->id())->whereIn('status', match ($mode) {
                'work' => ['assigned', 'processing'],'reports' => ['processing', 'completed'],default => ['completed']
            });
        }
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('test_type_id')) {
            $query->where('test_type_id', $request->integer('test_type_id'));
        }
        if ($request->filled('search')) {
            $search = '%'.$request->input('search').'%';
            $query->where(fn ($q) => $q->whereHas('patient', fn ($p) => $p->where('patient_number', 'like', $search)->orWhereHas('user', fn ($u) => $u->where('name', 'like', $search)))->orWhereHas('test_type', fn ($t) => $t->where('name', 'like', $search))->orWhereHas('doctor.user', fn ($d) => $d->where('name', 'like', $search)));
        }
        $date = $mode === 'history' ? 'updated_at' : 'request_date';
        if ($request->filled('start_date')) {
            $query->whereDate($date, '>=', $request->input('start_date'));
        }if ($request->filled('end_date')) {
            $query->whereDate($date, '<=', $request->input('end_date'));
        }
        $sort = $request->input('sort', 'request_date');
        $direction = $request->input('direction', 'asc');
        if ($sort === 'patient') {
            $query->orderBy(Patient::query()->select('users.name')->join('users', 'users.id', '=', 'patients.user_id')->whereColumn('patients.id', 'lab_tests.patient_id'), $direction);
        } elseif ($sort === 'test_type') {
            $query->orderBy(LabTestType::select('name')->whereColumn('lab_test_types.id', 'lab_tests.test_type_id'), $direction);
        } else {
            $query->orderBy($sort, $direction);
        }

        return LaboratoryTestResource::collection($query->paginate($request->integer('per_page', 10)));
    }

    public function show(int $id): LaboratoryTestResource
    {
        $test = $this->readable($id);
        AuditService::record('laboratory_investigation_viewed', 'lab_tests', $id);

        return $this->resource($test);
    }

    public function claim(int $id): LaboratoryTestResource
    {
        return $this->resource($this->workflows->claim($id));
    }

    public function start(int $id): LaboratoryTestResource
    {
        $this->readable($id);

        return $this->resource($this->workflows->start($id));
    }

    public function release(int $id): LaboratoryTestResource
    {
        $this->readable($id);

        return $this->resource($this->workflows->release($id));
    }

    public function saveResults(LaboratoryResultRequest $request, int $id): LaboratoryTestResource
    {
        $this->readable($id);

        return $this->resource($this->workflows->results($id, $request->validated('result_summary')));
    }

    public function complete(LaboratoryResultRequest $request, int $id): LaboratoryTestResource
    {
        $this->readable($id);

        return $this->resource($this->workflows->results($id, $request->validated('result_summary'), true));
    }

    public function upload(LaboratoryReportRequest $request, int $id): LaboratoryReportResource
    {
        return new LaboratoryReportResource($this->workflows->upload($id, $request->file('report')));
    }

    public function deleteReport(int $id): JsonResponse
    {
        $this->workflows->removeReport($id);

        return response()->json(['message' => 'Draft report removed.']);
    }

    private function file(int $id, bool $inline): StreamedResponse
    {
        $report = LabReport::with('labTest')->findOrFail($id);
        Gate::authorize('laboratory-record', $report);
        abort_unless(Storage::disk('local')->exists($report->file_path), 404, 'Report file is unavailable.');
        $mime = match ($report->file_type) {
            'pdf','application/pdf' => 'application/pdf','png','image/png' => 'image/png','jpg','jpeg','image/jpeg' => 'image/jpeg',default => abort(415, 'Unsupported report file.')
        };
        $name = 'laboratory-report-'.$id.'.'.match ($mime) {
            'application/pdf' => 'pdf','image/png' => 'png',default => 'jpg'
        };
        AuditService::record($inline ? 'laboratory_report_previewed' : 'report_downloaded', 'lab_reports', $id);

        return Storage::disk('local')->response($report->file_path, $name, ['Content-Type' => $mime, 'X-Content-Type-Options' => 'nosniff', 'Cache-Control' => 'private, no-store'], $inline ? 'inline' : 'attachment');
    }

    public function preview(int $id): StreamedResponse
    {
        return $this->file($id, true);
    }

    public function download(int $id): StreamedResponse
    {
        return $this->file($id, false);
    }
}
