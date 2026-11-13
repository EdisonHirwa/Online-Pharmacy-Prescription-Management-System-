<?php

namespace App\Http\Controllers\Pharmacy;

use App\Http\Controllers\Controller;
use App\Http\Requests\PharmacyDispenseRequest;
use App\Http\Requests\PharmacyMedicineRequest;
use App\Http\Requests\PharmacyStockRequest;
use App\Http\Resources\PharmacyDispensationResource;
use App\Http\Resources\PharmacyPrescriptionResource;
use App\Models\Dispensation;
use App\Models\Medicine;
use App\Models\MedicineStockMovement;
use App\Models\Prescription;
use App\Services\AuditService;
use App\Services\PharmacyAccess;
use App\Services\PharmacyWorkflowService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class PharmacyController extends Controller
{
    public function __construct(private PharmacyWorkflowService $workflow) {}

    public function dashboard(): JsonResponse
    {
        Gate::authorize('pharmacy-record');

        return response()->json(['data' => ['pending' => Prescription::where('status', 'pending')->count(), 'partial' => Prescription::where('status', 'partially_dispensed')->count(), 'dispensed_today' => Dispensation::whereDate('dispensing_date', today())->count(), 'medicines' => Medicine::count(), 'low_stock' => Medicine::where('status', 'active')->whereColumn('available_stock', '<=', 'reorder_level')->count(), 'expired' => Medicine::whereDate('expiry_date', '<', today())->count(), 'expiring' => Medicine::whereBetween('expiry_date', [today(), today()->addDays(30)])->count(), 'can_manage' => PharmacyAccess::canManage(auth()->user()), 'today' => today()->toDateString(), 'currency' => config('hospital.currency', 'RWF')]]);
    }

    private function parameters(Request $request, array $sorts): array
    {
        return $request->validate(['search' => 'nullable|string|max:255', 'status' => 'nullable|string|max:50', 'per_page' => 'sometimes|integer|between:1,100', 'page' => 'sometimes|integer|min:1', 'sort' => 'nullable|in:'.implode(',', $sorts), 'direction' => 'nullable|in:asc,desc', 'start_date' => 'nullable|date_format:Y-m-d', 'end_date' => ['nullable', 'date_format:Y-m-d', Rule::when($request->filled('start_date'), 'after_or_equal:start_date')], 'filter' => 'nullable|in:low_stock,expired,expiring', 'mode' => 'nullable|in:queue,all']);
    }

    private function dateFilters(Builder $query, Request $request, string $column): void
    {
        if ($request->filled('start_date')) {
            $query->whereDate($column, '>=', $request->input('start_date'));
        }
        if ($request->filled('end_date')) {
            $query->whereDate($column, '<=', $request->input('end_date'));
        }
    }

    public function prescriptions(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('pharmacy-record');
        $this->parameters($request, ['id', 'issue_date', 'status']);
        $query = Prescription::with('patient.user', 'doctor.user');
        if ($request->input('mode', 'queue') === 'queue') {
            $query->whereIn('status', ['pending', 'partially_dispensed']);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('search')) {
            $search = '%'.$request->input('search').'%';
            $query->where(fn ($q) => $q->where('id', $request->input('search'))->orWhereHas('patient', fn ($p) => $p->where('patient_number', 'like', $search)->orWhereHas('user', fn ($u) => $u->where('name', 'like', $search)))->orWhereHas('doctor.user', fn ($u) => $u->where('name', 'like', $search)));
        }
        $this->dateFilters($query, $request, 'issue_date');

        return PharmacyPrescriptionResource::collection($query->orderBy($request->input('sort', 'issue_date'), $request->input('direction', 'asc'))->orderBy('id')->paginate($request->integer('per_page', 10)));
    }

    public function prescription(int $id): PharmacyPrescriptionResource
    {
        Gate::authorize('pharmacy-record');
        $record = PharmacyWorkflowService::loadPrescription(Prescription::findOrFail($id));
        AuditService::record('pharmacy_prescription_viewed', 'prescriptions', $id);

        return new PharmacyPrescriptionResource($record);
    }

    public function dispense(PharmacyDispenseRequest $request, int $id): PharmacyDispensationResource
    {
        return new PharmacyDispensationResource($this->workflow->dispense($id, $request->validated())->load('prescription.patient.user', 'pharmacist', 'items.prescriptionItem.medicine'));
    }

    public function medicines(Request $request): JsonResponse
    {
        Gate::authorize('pharmacy-record');
        $this->parameters($request, ['id', 'name', 'available_stock', 'expiry_date', 'unit_price', 'reorder_level']);
        $query = Medicine::query();
        if ($request->filled('search')) {
            $search = '%'.$request->input('search').'%';
            $query->where(fn ($q) => $q->where('name', 'like', $search)->orWhere('medicine_code', 'like', $search)->orWhere('category', 'like', $search));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->input('filter') === 'low_stock') {
            $query->whereColumn('available_stock', '<=', 'reorder_level');
        }
        if ($request->input('filter') === 'expired') {
            $query->whereDate('expiry_date', '<', today());
        }
        if ($request->input('filter') === 'expiring') {
            $query->whereBetween('expiry_date', [today(), today()->addDays(30)]);
        }

        return response()->json($query->orderBy($request->input('sort', 'name'), $request->input('direction', 'asc'))->orderBy('id')->paginate($request->integer('per_page', 10)));
    }

    public function saveMedicine(PharmacyMedicineRequest $request, ?int $id = null): JsonResponse
    {
        return response()->json(['data' => $this->workflow->medicine($request->validated(), $id)]);
    }

    public function stock(PharmacyStockRequest $request, int $id): JsonResponse
    {
        return response()->json(['data' => $this->workflow->stock($id, $request->validated())]);
    }

    public function movements(Request $request): JsonResponse
    {
        Gate::authorize('pharmacy-record');
        $this->parameters($request, ['id', 'created_at', 'quantity']);
        $request->validate(['medicine_id' => 'nullable|integer', 'movement_type' => 'nullable|in:addition,deduction,dispensing,adjustment,expired']);
        $query = MedicineStockMovement::with('medicine:id,name,medicine_code', 'user:id,name');
        if ($request->filled('medicine_id')) {
            $query->where('medicine_id', $request->integer('medicine_id'));
        }
        if ($request->filled('movement_type')) {
            $query->where('movement_type', $request->input('movement_type'));
        }
        if ($request->filled('search')) {
            $search = '%'.$request->input('search').'%';
            $query->where(fn ($q) => $q->where('reason', 'like', $search)->orWhereHas('medicine', fn ($m) => $m->where('name', 'like', $search)->orWhere('medicine_code', 'like', $search)));
        }
        $this->dateFilters($query, $request, 'created_at');

        return response()->json($query->orderBy($request->input('sort', 'id'), $request->input('direction', 'desc'))->paginate($request->integer('per_page', 10)));
    }

    public function history(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('pharmacy-record');
        $this->parameters($request, ['id', 'dispensing_date', 'dispensing_status']);
        $query = Dispensation::with('prescription.patient.user', 'pharmacist', 'items.prescriptionItem.medicine');
        if ($request->filled('search')) {
            $search = '%'.$request->input('search').'%';
            $query->where(fn ($q) => $q->where('prescription_id', $request->input('search'))->orWhereHas('prescription.patient.user', fn ($u) => $u->where('name', 'like', $search))->orWhereHas('pharmacist', fn ($u) => $u->where('name', 'like', $search)));
        }
        if ($request->filled('status')) {
            $query->where('dispensing_status',$request->input('status'));
        }
        $this->dateFilters($query,$request,'dispensing_date');

        return PharmacyDispensationResource::collection($query->orderBy($request->input('sort','dispensing_date'),$request->input('direction','desc'))->orderBy('id')->paginate($request->integer('per_page',10)));
    }
}
