<?php

namespace App\Services;

use App\Models;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class AdminCatalog
{
    public const ROLES = ['admin', 'doctor', 'patient', 'lab_tech', 'pharmacist'];

    public const PERMISSIONS = ['view_own_records', 'book_appointments', 'view_prescriptions', 'view_invoices', 'manage_consultations', 'manage_schedules', 'manage_laboratory', 'manage_pharmacy'];

    public static function definitions(): array
    {
        $status = ['active', 'inactive'];

        return [
            'users' => ['model' => Models\User::class, 'fields' => [
                'name' => ['type' => 'text'], 'email' => ['type' => 'email', 'unique' => true], 'phone_number' => ['type' => 'phone', 'unique' => true],
                'password' => ['type' => 'password'], 'role' => ['type' => 'select', 'options' => self::ROLES], 'account_status' => ['type' => 'select', 'options' => $status],
                'permissions' => ['type' => 'multiselect', 'options' => self::PERMISSIONS, 'optional' => true],
            ]],
            'departments' => ['model' => Models\Department::class, 'fields' => ['name' => ['type' => 'text', 'unique' => true], 'description' => ['type' => 'textarea', 'optional' => true], 'status' => ['type' => 'select', 'options' => $status]]],
            'specializations' => ['model' => Models\Specialization::class, 'with' => ['department'], 'fields' => ['department_id' => ['type' => 'reference', 'resource' => 'departments'], 'name' => ['type' => 'text', 'unique' => true], 'description' => ['type' => 'textarea', 'optional' => true], 'status' => ['type' => 'select', 'options' => $status]]],
            'patients' => ['model' => Models\Patient::class, 'with' => ['user'], 'fields' => [
                'user_id' => ['type' => 'reference', 'resource' => 'users', 'role' => 'patient', 'unique' => true], 'date_of_birth' => ['type' => 'date'], 'gender' => ['type' => 'select', 'options' => ['Male', 'Female', 'Other']],
                'blood_group' => ['type' => 'select', 'options' => ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], 'optional' => true], 'address' => ['type' => 'textarea'], 'emergency_contact_name' => ['type' => 'text'], 'emergency_contact_phone' => ['type' => 'phone'],
            ]],
            'doctors' => ['model' => Models\Doctor::class, 'with' => ['user', 'department', 'specialization', 'schedules'], 'fields' => [
                'user_id' => ['type' => 'reference', 'resource' => 'users', 'role' => 'doctor', 'unique' => true], 'department_id' => ['type' => 'reference', 'resource' => 'departments'], 'specialization_id' => ['type' => 'reference', 'resource' => 'specializations'],
                'license_number' => ['type' => 'text', 'unique' => true, 'max' => 100], 'consultation_fee' => ['type' => 'money'], 'room_number' => ['type' => 'text', 'optional' => true, 'max' => 50], 'professional_status' => ['type' => 'select', 'options' => ['active', 'on_leave', 'inactive']], 'bio' => ['type' => 'textarea', 'optional' => true],
            ]],
            'doctor-schedules' => ['model' => Models\DoctorSchedule::class, 'with' => ['doctor.user'], 'fields' => [
                'doctor_id' => ['type' => 'reference', 'resource' => 'doctors'], 'day_of_week' => ['type' => 'select', 'options' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']], 'start_time' => ['type' => 'time'], 'end_time' => ['type' => 'time'], 'slot_duration' => ['type' => 'integer', 'min' => 5, 'max' => 240], 'is_available' => ['type' => 'boolean'],
            ]],
            'wards' => ['model' => Models\Ward::class, 'fields' => ['name' => ['type' => 'text', 'unique' => true], 'ward_type' => ['type' => 'text', 'max' => 100], 'description' => ['type' => 'textarea', 'optional' => true], 'status' => ['type' => 'select', 'options' => $status]]],
            'beds' => ['model' => Models\HospitalBed::class, 'with' => ['ward'], 'fields' => ['ward_id' => ['type' => 'reference', 'resource' => 'wards'], 'bed_number' => ['type' => 'text', 'unique' => true, 'max' => 50], 'bed_type' => ['type' => 'text', 'max' => 100], 'availability_status' => ['type' => 'select', 'options' => ['available', 'unavailable']]]],
            'services' => ['model' => Models\HospitalService::class, 'fields' => ['name' => ['type' => 'text', 'unique' => true], 'service_type' => ['type' => 'select', 'options' => ['consultation', 'lab_test', 'medicine', 'admission']], 'description' => ['type' => 'textarea', 'optional' => true], 'price' => ['type' => 'money'], 'status' => ['type' => 'select', 'options' => $status]]],
            'lab-test-types' => ['model' => Models\LabTestType::class, 'fields' => ['name' => ['type' => 'text', 'unique' => true], 'description' => ['type' => 'textarea', 'optional' => true], 'price' => ['type' => 'money'], 'expected_turnaround_time' => ['type' => 'text', 'max' => 100], 'status' => ['type' => 'select', 'options' => $status]]],
            'medicines' => ['model' => Models\Medicine::class, 'fields' => ['medicine_code' => ['type' => 'text', 'unique' => true, 'max' => 100], 'name' => ['type' => 'text'], 'category' => ['type' => 'text', 'max' => 100], 'description' => ['type' => 'textarea', 'optional' => true], 'unit' => ['type' => 'text', 'max' => 50], 'unit_price' => ['type' => 'money'], 'reorder_level' => ['type' => 'integer'], 'expiry_date' => ['type' => 'date'], 'status' => ['type' => 'select', 'options' => $status]]],
            'settings' => ['model' => Models\SystemSetting::class, 'fields' => ['key' => ['type' => 'select', 'unique' => true, 'options' => ['hospital_name', 'hospital_address', 'hospital_phone', 'hospital_email', 'currency', 'timezone']], 'value' => ['type' => 'textarea']]],
            'consultations' => ['model' => Models\Consultation::class, 'with' => ['patient.user', 'doctor.user'], 'readonly' => true],
            'dispensations' => ['model' => Models\Dispensation::class, 'readonly' => true],
            'appointments' => ['model' => Models\Appointment::class, 'with' => ['patient.user', 'doctor.user', 'doctor.department'], 'readonly' => true],
            'admissions' => ['model' => Models\Admission::class, 'with' => ['patient.user', 'bed.ward'], 'readonly' => true],
            'invoices' => ['model' => Models\Invoice::class, 'with' => ['patient.user', 'items', 'payments'], 'readonly' => true],
            'payments' => ['model' => Models\Payment::class, 'with' => ['invoice'], 'readonly' => true],
            'lab-tests' => ['model' => Models\LabTest::class, 'with' => ['patient.user', 'doctor.user', 'test_type'], 'readonly' => true],
            'lab-reports' => ['model' => Models\LabReport::class, 'with' => ['labTest.patient.user'], 'readonly' => true],
            'prescriptions' => ['model' => Models\Prescription::class, 'with' => ['patient.user', 'doctor.user'], 'readonly' => true],
            'stock-movements' => ['model' => Models\MedicineStockMovement::class, 'with' => ['medicine', 'user'], 'readonly' => true],
            'audit-logs' => ['model' => Models\AuditLog::class, 'with' => ['user'], 'readonly' => true],
            'login-attempts' => ['model' => Models\LoginAttempt::class, 'readonly' => true],
        ];
    }

    public static function definition(string $resource): array
    {
        return self::definitions()[$resource] ?? abort(404);
    }

    public static function model(string $resource): Model
    {
        $class = self::definition($resource)['model'];

        return new $class;
    }

    public static function query(string $resource): Builder
    {
        return self::model($resource)->newQuery()->with(self::definition($resource)['with'] ?? []);
    }

    public static function rules(string $resource, ?int $id): array
    {
        $definition = self::definition($resource);
        abort_if($definition['readonly'] ?? false, 405, 'Use the dedicated workflow for this record.');
        $rules = [];
        foreach ($definition['fields'] as $field => $spec) {
            $type = $spec['type'];
            $rules[$field] = [($spec['optional'] ?? false) || ($type === 'password' && $id) ? 'nullable' : 'required'];
            $rules[$field] = array_merge($rules[$field], match ($type) {
                'email' => ['email', 'max:255'], 'phone' => ['string', 'regex:/^\+?[0-9]{9,15}$/'],
                'password' => ['string', Password::min(8)->mixedCase()->numbers()->symbols()],
                'reference' => ['integer', Rule::exists(self::model($spec['resource'])->getTable(), 'id')->where(function ($q) use ($spec): void {
                    if (in_array(SoftDeletes::class, class_uses_recursive(self::model($spec['resource'])))) {
                        $q->whereNull('deleted_at');
                    }
                    if (isset($spec['role'])) {
                        $q->where('role', $spec['role']);
                    }
                })],
                'select' => [Rule::in($spec['options'])], 'multiselect' => ['array'], 'boolean' => ['boolean'],
                'money' => ['numeric', 'min:0', 'max:99999999.99', 'decimal:0,2'], 'integer' => ['integer', 'min:'.($spec['min'] ?? 0), 'max:'.($spec['max'] ?? 1000000)],
                'date' => ['date_format:Y-m-d'], 'time' => ['date_format:H:i'], 'textarea' => ['string', 'max:5000'], default => ['string', 'max:'.($spec['max'] ?? 255)],
            });
            if ($spec['unique'] ?? false) {
                $rules[$field][] = Rule::unique(self::model($resource)->getTable(), $field)->ignore($id);
            }
            if ($type === 'multiselect') {
                $rules[$field.'.*'] = [Rule::in($spec['options'])];
            }
        }
        if ($resource === 'patients') {
            $rules['date_of_birth'][] = 'before_or_equal:today';
        }
        if ($resource === 'doctor-schedules') {
            $rules['end_time'][] = 'after:start_time';
        }

        return $rules;
    }
}
