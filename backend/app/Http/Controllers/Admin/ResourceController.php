<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminResourceRequest;
use App\Http\Resources\AdminRecordResource;
use App\Models\Admission;
use App\Models\Appointment;
use App\Models\Consultation;
use App\Models\Doctor;
use App\Models\DoctorSchedule;
use App\Models\Specialization;
use App\Models\User;
use App\Services\AdminCatalog;
use App\Services\AuditService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ResourceController extends Controller
{
    public function catalog(): JsonResponse
    {
        return response()->json(['data' => collect(AdminCatalog::definitions())->map(fn (array $d): array => ['fields' => $d['fields'] ?? [], 'readonly' => $d['readonly'] ?? false])]);
    }

    public function options(): JsonResponse
    {
        $data = [];
        foreach (['users', 'departments', 'specializations', 'patients', 'doctors', 'wards', 'beds', 'services', 'lab-test-types', 'medicines'] as $resource) {
            $data[$resource] = AdminCatalog::query($resource)->get()->map(fn ($record): array => [
                'id' => $record->id, 'label' => $record->name ?? $record->user?->name ?? $record->bed_number ?? (string) $record->id,
                'role' => $record->role, 'department_id' => $record->department_id, 'status' => $record->account_status ?? $record->status ?? $record->professional_status ?? $record->availability_status,
            ]);
        }

        return response()->json(['data' => $data]);
    }

    public function index(Request $request, string $resource): JsonResponse
    {
        $request->validate(['page' => 'sometimes|integer|min:1', 'per_page' => 'sometimes|integer|min:1|max:100', 'search' => 'nullable|string|max:255', 'sort' => 'nullable|string|max:100', 'direction' => 'nullable|in:asc,desc', 'start_date' => 'nullable|date_format:Y-m-d', 'end_date' => ['nullable', 'date_format:Y-m-d', Rule::when($request->filled('start_date'), 'after_or_equal:start_date')]]);
        $query = $this->filteredQuery($request, $resource);
        $fields = array_diff(DB::getSchemaBuilder()->getColumnListing($query->getModel()->getTable()), ['password', 'remember_token', 'permissions']);
        $sort = in_array($request->input('sort'), $fields, true) ? $request->input('sort') : 'id';
        $page = $query->orderBy($sort, $request->input('direction', 'desc'))->paginate($request->integer('per_page', 25));
        $page->through(fn ($record) => (new AdminRecordResource($record))->resolve($request));

        return response()->json($page);
    }

    public function filteredQuery(Request $request, string $resource): Builder
    {
        $query = AdminCatalog::query($resource);
        if ($search = trim((string) $request->input('search'))) {
            $schema = DB::getSchemaBuilder()->getColumnListing($query->getModel()->getTable());
            $fields = array_values(array_intersect($schema, ['name', 'email', 'phone_number', 'patient_number', 'appointment_number', 'invoice_number', 'bed_number', 'license_number', 'action', 'activity_details', 'attempt_status', 'status', 'category']));
            $relations = match ($resource) {
                'patients','doctors','audit-logs' => ['user'],'appointments','admissions','invoices','lab-tests','prescriptions','consultations' => ['patient.user'],default => []
            };
            if ($fields || $relations) {
                $query->where(function ($q) use ($fields, $relations, $search): void {
                    foreach ($fields as $field) {
                        $q->orWhere($field, 'like', '%'.$search.'%');
                    }
                    foreach ($relations as $relation) {
                        $q->orWhereHas($relation, fn ($r) => $r->where('name', 'like', '%'.$search.'%')->orWhere('phone_number', 'like', '%'.$search.'%'));
                    }
                });
            }
        }
        $columns = DB::getSchemaBuilder()->getColumnListing($query->getModel()->getTable());
        foreach (['status', 'account_status', 'role', 'department_id', 'specialization_id', 'professional_status', 'doctor_id', 'patient_id', 'ward_id', 'payment_method', 'category', 'availability_status', 'attempt_status'] as $field) {
            if ($request->filled($field) && in_array($field, $columns, true)) {
                $query->where($field, $request->input($field));
            }
        }
        if ($request->filled('department_id') && in_array($resource, ['appointments', 'consultations', 'prescriptions', 'lab-tests'], true)) {
            $query->whereHas('doctor', fn ($q) => $q->where('department_id', $request->input('department_id')));
        }
        if ($request->filled('ward_id') && $resource === 'admissions') {
            $query->whereHas('bed', fn ($q) => $q->where('ward_id', $request->input('ward_id')));
        }
        if ($resource === 'medicines' && $request->boolean('low_stock')) {
            $query->whereColumn('available_stock', '<=', 'reorder_level');
        }
        if ($resource === 'medicines' && $request->boolean('expiring')) {
            $query->whereDate('expiry_date', '<=', today()->addDays(30));
        }
        $date = match ($resource) {
            'payments' => 'payment_date','appointments' => 'appointment_date','invoices' => 'issue_date','admissions' => 'admission_date','login-attempts' => 'attempt_date',default => 'created_at'
        };
        if ($request->filled('start_date')) {
            $query->whereDate($date, '>=', $request->input('start_date'));
        }
        if ($request->filled('end_date')) {
            $query->whereDate($date, '<=', $request->input('end_date'));
        }

        return $query;
    }

    public function show(string $resource, int $id): JsonResponse
    {
        $record = AdminCatalog::query($resource)->findOrFail($id);
        $data = (new AdminRecordResource($record))->resolve();
        if ($resource === 'patients') {
            $data['appointments'] = Appointment::with('doctor.user')->where('patient_id', $id)->latest()->get();
            $data['consultations'] = Consultation::with('doctor.user')->where('patient_id', $id)->latest()->get();
            $data['allergies'] = DB::table('patient_allergies')->where('patient_id', $id)->get();
            $data['medical_histories'] = DB::table('patient_medical_histories')->where('patient_id', $id)->get();
            AuditService::record('patient_record_viewed', 'patients', $id);
        }

        return response()->json(['data' => $data]);
    }

    public function store(AdminResourceRequest $request, string $resource): JsonResponse
    {
        return $this->save($request, $resource, null);
    }

    public function update(AdminResourceRequest $request, string $resource, int $id): JsonResponse
    {
        return $this->save($request, $resource, $id);
    }

    private function save(AdminResourceRequest $request, string $resource, ?int $id): JsonResponse
    {
        $record = DB::transaction(function () use ($request, $resource, $id) {
            $data = $request->validated();
            if ($resource === 'users') {
                User::where('role', 'admin')->orderBy('id')->lockForUpdate()->get();
            }
            $record = $id ? AdminCatalog::model($resource)->newQuery()->lockForUpdate()->findOrFail($id) : AdminCatalog::model($resource);
            $this->guardChanges($resource, $record, $data);
            if ($resource === 'users' && empty($data['password'])) {
                unset($data['password']);
            }
            if ($resource === 'patients' && ! $id) {
                $data['patient_number'] = 'PAT-'.strtoupper((string) Str::ulid());
            }
            if ($resource === 'medicines' && ! $id) {
                $data['available_stock'] = 0;
            }
            $record->fill($data)->save();
            if ($resource === 'users' && $id) {
                $record->tokens()->delete();
            }
            AuditService::record($id ? 'updated' : 'created', $record->getTable(), $record->id);

            return $record;
        });

        return response()->json(['data' => AdminCatalog::query($resource)->findOrFail($record->id), 'message' => 'Record saved.'], $id ? 200 : 201);
    }

    private function guardChanges(string $resource, Model $record, array $data): void
    {
        if ($resource === 'users' && $record->exists) {
            if ($record->id === auth()->id() && (($data['role'] ?? $record->role) !== 'admin' || ($data['account_status'] ?? $record->account_status) !== 'active')) {
                throw ValidationException::withMessages(['role' => 'You cannot deactivate or demote your own administrator account.']);
            }
            if ($record->role === 'admin' && $record->account_status === 'active' && (($data['role'] ?? 'admin') !== 'admin' || ($data['account_status'] ?? 'active') !== 'active') && User::where('role', 'admin')->where('account_status', 'active')->count() <= 1) {
                throw ValidationException::withMessages(['role' => 'At least one active administrator must remain.']);
            }
            if (($data['role'] ?? $record->role) !== $record->role && (DB::table('patients')->where('user_id', $record->id)->exists() || DB::table('doctors')->where('user_id', $record->id)->exists())) {
                throw ValidationException::withMessages(['role' => 'This account is linked to a clinical profile; its role cannot be changed.']);
            }
        }
        if ($resource === 'doctors' && ! Specialization::whereKey($data['specialization_id'])->where('department_id', $data['department_id'])->exists()) {
            throw ValidationException::withMessages(['specialization_id' => 'Choose a specialization belonging to the selected department.']);
        }
        if (in_array($resource, ['patients', 'doctors'], true) && $record->exists && (int) $data['user_id'] !== $record->user_id) {
            throw ValidationException::withMessages(['user_id' => 'The account linked to an existing clinical profile cannot be changed.']);
        }
        if ($resource === 'specializations' && $record->exists && (int) $data['department_id'] !== $record->department_id && Doctor::where('specialization_id', $record->id)->exists()) {
            throw ValidationException::withMessages(['department_id' => 'This specialization is in use by doctors.']);
        }
        if ($resource === 'beds' && $record->exists && Admission::where('bed_id', $record->id)->where('status', 'admitted')->exists()) {
            throw ValidationException::withMessages(['availability_status' => 'Discharge the current patient before changing this bed.']);
        }
        if ($resource === 'doctor-schedules') {
            Doctor::whereKey($data['doctor_id'])->lockForUpdate()->firstOrFail();
            $overlap = DoctorSchedule::where('doctor_id', $data['doctor_id'])->where('day_of_week', $data['day_of_week'])->where('is_available', true)->where('start_time', '<', $data['end_time'])->where('end_time', '>', $data['start_time']);
            if ($record->exists) {
                $overlap->where('id', '!=', $record->id);
            }
            if ($data['is_available'] && $overlap->exists()) {
                throw ValidationException::withMessages(['start_time' => 'This schedule overlaps an existing consultation period.']);
            }
            if ($record->exists && Appointment::where('doctor_id', $record->doctor_id)->whereDate('appointment_date', '>=', today())->whereIn('status', ['pending', 'confirmed'])->exists()) {
                throw ValidationException::withMessages(['doctor_id' => 'Resolve upcoming appointments before changing consultation schedules.']);
            }
        }
        if ($resource === 'settings') {
            if ($data['key'] === 'timezone' && ! in_array($data['value'], timezone_identifiers_list(), true)) {
                throw ValidationException::withMessages(['value' => 'Enter a valid timezone, such as Africa/Kigali.']);
            }
            if ($data['key'] === 'currency' && ! preg_match('/^[A-Z]{3}$/', $data['value'])) {
                throw ValidationException::withMessages(['value' => 'Use a three-letter currency code, such as RWF.']);
            }
        }
    }

    public function destroy(string $resource, int $id): JsonResponse
    {
        abort_if(AdminCatalog::definition($resource)['readonly'] ?? false, 405, 'Historical records cannot be deleted.');
        try {
            DB::transaction(function () use ($resource, $id): void {
                if ($resource === 'users') {
                    User::where('role', 'admin')->lockForUpdate()->get();
                }
                $record = AdminCatalog::model($resource)->newQuery()->lockForUpdate()->findOrFail($id);
                if ($resource === 'users') {
                    $this->guardChanges($resource, $record, ['account_status' => 'inactive']);
                    if (DB::table('patients')->where('user_id', $id)->exists() || DB::table('doctors')->where('user_id', $id)->exists()) {
                        abort(409, 'Deactivate this account to preserve its linked clinical profile.');
                    }
                    $record->tokens()->delete();
                }
                if ($resource === 'beds' && Admission::where('bed_id', $id)->exists()) {
                    abort(409, 'Beds with admission history must be retained.');
                }
                if ($resource === 'doctor-schedules' && Appointment::where('doctor_id', $record->doctor_id)->whereDate('appointment_date', '>=', today())->whereIn('status', ['pending', 'confirmed'])->exists()) {
                    abort(409, 'Resolve upcoming appointments before removing this schedule.');
                }
                if (in_array($resource, ['patients', 'doctors', 'medicines'], true)) {
                    $references = match ($resource) {
                        'patients' => [['appointments', 'patient_id'], ['admissions', 'patient_id'], ['invoices', 'patient_id']],'doctors' => [['appointments', 'doctor_id'], ['doctor_schedules', 'doctor_id']],default => [['prescription_items', 'medicine_id'], ['medicine_stock_movements', 'medicine_id']]
                    };
                    foreach ($references as [$table,$field]) {
                        if (DB::table($table)->where($field, $id)->exists()) {
                            abort(409, 'This record has history. Retain it and update its status where available.');
                        }
                    }
                }
                $record->delete();
                AuditService::record('deleted', $record->getTable(), $id);
            });
        } catch (QueryException $exception) {
            if (in_array((string) $exception->getCode(), ['23000', '23503'], true)) {
                abort(409, 'This record is referenced elsewhere and must be retained.');
            }
            throw $exception;
        }

        return response()->json(['message' => 'Record deleted.']);
    }
}
