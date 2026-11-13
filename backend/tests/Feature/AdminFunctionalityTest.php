<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Consultation;
use App\Models\Doctor;
use App\Models\HospitalBed;
use App\Models\Invoice;
use App\Models\LabReport;
use App\Models\LabTest;
use App\Models\LabTestType;
use App\Models\Patient;
use App\Models\User;
use App\Services\AdminCatalog;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminFunctionalityTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $user = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($user);

        return $user;
    }

    private function patient(): Patient
    {
        $user = User::factory()->create(['role' => 'patient']);
        $id = $this->postJson('/api/admin/patients', ['user_id' => $user->id, 'date_of_birth' => '1995-01-01', 'gender' => 'Female', 'blood_group' => 'O+', 'address' => 'Kigali', 'emergency_contact_name' => 'Contact', 'emergency_contact_phone' => '+250788123456'])->assertCreated()->json('data.id');

        return Patient::findOrFail($id);
    }

    private function doctor(): Doctor
    {
        $department = $this->postJson('/api/admin/departments', ['name' => 'General Medicine', 'status' => 'active'])->assertCreated()->json('data.id');
        $specialization = $this->postJson('/api/admin/specializations', ['name' => 'General practice', 'department_id' => $department, 'status' => 'active'])->assertCreated()->json('data.id');
        $user = User::factory()->create(['role' => 'doctor']);
        $id = $this->postJson('/api/admin/doctors', ['user_id' => $user->id, 'department_id' => $department, 'specialization_id' => $specialization, 'license_number' => 'DOC-001', 'consultation_fee' => 5000, 'professional_status' => 'active'])->assertCreated()->json('data.id');

        return Doctor::findOrFail($id);
    }

    private function bed(): HospitalBed
    {
        $ward = $this->postJson('/api/admin/wards', ['name' => 'General', 'ward_type' => 'General', 'status' => 'active'])->assertCreated()->json('data.id');
        $bed = $this->postJson('/api/admin/beds', ['ward_id' => $ward, 'bed_number' => 'B-001', 'bed_type' => 'Standard', 'availability_status' => 'available'])->assertCreated()->json('data.id');

        return HospitalBed::findOrFail($bed);
    }

    public function test_login_verifies_password_and_logout_revokes_the_token(): void
    {
        $user = User::factory()->create(['role' => 'admin', 'password' => 'Correct!123']);
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'wrong'])->assertUnprocessable();
        $response = $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'Correct!123'])->assertOk()->assertJsonPath('user.role', 'admin')->assertJsonMissingPath('user.password');
        $token = $response->json('token');
        $this->withToken($token)->getJson('/api/auth/me')->assertOk()->assertJsonPath('data.id', $user->id);
        $this->withToken($token)->postJson('/api/auth/logout')->assertOk();
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseHas('login_attempts', ['email' => $user->email, 'attempt_status' => 'failed']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'login']);
    }

    public function test_inactive_accounts_cannot_log_in_and_repeated_failures_lock_out(): void
    {
        $user = User::factory()->create(['account_status' => 'inactive', 'password' => 'Correct!123']);
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'Correct!123'])->assertUnprocessable();
        }
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'Correct!123'])->assertStatus(429);
        $this->assertDatabaseHas('login_attempts', ['attempt_status' => 'suspicious_lockout']);
    }

    public function test_admin_endpoints_require_authentication_and_admin_role(): void
    {
        $this->getJson('/api/admin/users')->assertUnauthorized();
        Sanctum::actingAs(User::factory()->create(['role' => 'patient']));
        $this->getJson('/api/admin/users')->assertForbidden();
        $this->postJson('/api/admin/departments', ['name' => 'Unauthorized', 'status' => 'active'])->assertForbidden();
        $this->getJson('/api/admin/reports/users?format=csv')->assertForbidden();
        $this->assertDatabaseHas('audit_logs', ['action' => 'unauthorized_access']);
    }

    public function test_admin_can_manage_users_but_cannot_demote_self_or_escalate_via_profile(): void
    {
        $admin = $this->admin();
        $data = ['name' => 'New doctor', 'email' => 'new@example.test', 'phone_number' => '+250788000001', 'password' => 'StrongPass!123', 'role' => 'doctor', 'account_status' => 'active', 'permissions' => ['manage_schedules']];
        $id = $this->postJson('/api/admin/users', $data)->assertCreated()->assertJsonMissingPath('data.password')->json('data.id');
        $this->postJson('/api/admin/users', $data)->assertUnprocessable()->assertJsonValidationErrors(['email', 'phone_number']);
        $data['account_status'] = 'inactive';
        unset($data['password']);
        $this->putJson('/api/admin/users/'.$id, $data)->assertOk();
        $this->putJson('/api/admin/users/'.$admin->id, ['name' => $admin->name, 'email' => $admin->email, 'phone_number' => $admin->phone_number, 'role' => 'patient', 'account_status' => 'active'])->assertUnprocessable();
        $this->putJson('/api/auth/profile', ['name' => 'Updated', 'email' => $admin->email, 'phone_number' => $admin->phone_number, 'role' => 'patient'])->assertOk()->assertJsonPath('data.role', 'admin');
        $this->deleteJson('/api/admin/users/'.$admin->id)->assertUnprocessable();
    }

    public function test_user_edits_revoke_sessions_and_clinical_profile_roles_are_protected(): void
    {
        $this->admin();
        $patient = $this->patient();
        $user = $patient->user;
        $user->createToken('existing');
        $data = ['name' => $user->name, 'email' => $user->email, 'phone_number' => $user->phone_number, 'role' => 'patient', 'account_status' => 'inactive'];
        $this->putJson('/api/admin/users/'.$user->id, $data)->assertOk();
        $this->assertSame(0, $user->tokens()->count());
        $data['role'] = 'doctor';
        $this->putJson('/api/admin/users/'.$user->id, $data)->assertUnprocessable();
        $this->deleteJson('/api/admin/users/'.$user->id)->assertConflict();
    }

    public function test_catalog_crud_search_pagination_and_reference_protection(): void
    {
        $this->admin();
        $id = $this->postJson('/api/admin/departments', ['name' => 'Dentistry', 'status' => 'active'])->assertCreated()->json('data.id');
        $this->postJson('/api/admin/departments', ['name' => 'Dentistry', 'status' => 'active'])->assertUnprocessable();
        $this->getJson('/api/admin/departments?search=Dent&per_page=1')->assertOk()->assertJsonPath('total', 1);
        $this->postJson('/api/admin/specializations', ['name' => 'Dental', 'department_id' => $id, 'status' => 'active'])->assertCreated();
        $this->deleteJson('/api/admin/departments/'.$id)->assertConflict();
        $this->getJson('/api/admin/options')->assertOk()->assertJsonMissingPath('data.users.0.password');
        $this->getJson('/api/admin/not-a-resource')->assertNotFound();
    }

    public function test_schedules_prevent_overlap_and_appointments_prevent_double_booking(): void
    {
        $this->admin();
        $doctor = $this->doctor();
        $patient = $this->patient();
        $schedule = ['doctor_id' => $doctor->id, 'day_of_week' => now()->addDay()->format('l'), 'start_time' => '09:00', 'end_time' => '12:00', 'slot_duration' => 30, 'is_available' => true];
        $this->postJson('/api/admin/doctor-schedules', $schedule)->assertCreated();
        $this->postJson('/api/admin/doctor-schedules', $schedule)->assertUnprocessable();
        $appointment = ['patient_id' => $patient->id, 'doctor_id' => $doctor->id, 'appointment_date' => now()->addDay()->toDateString(), 'appointment_time' => '09:00', 'reason' => 'Consultation'];
        $id = $this->postJson('/api/admin/appointments', $appointment)->assertCreated()->json('data.id');
        $this->postJson('/api/admin/appointments', $appointment)->assertConflict();
        $appointment['appointment_time'] = '09:10';
        $this->postJson('/api/admin/appointments', $appointment)->assertConflict();
        $this->postJson('/api/admin/appointments/'.$id.'/status', ['status' => 'cancelled', 'cancellation_reason' => 'Patient request'])->assertOk();
        $appointment['appointment_time'] = '09:00';
        $this->postJson('/api/admin/appointments', $appointment)->assertCreated();
    }

    public function test_admissions_and_discharge_preserve_bed_consistency(): void
    {
        $this->admin();
        $patient = $this->patient();
        $second = $this->patient();
        $bed = $this->bed();
        $id = $this->postJson('/api/admin/admissions', ['patient_id' => $patient->id, 'bed_id' => $bed->id])->assertCreated()->json('data.id');
        $this->postJson('/api/admin/admissions', ['patient_id' => $second->id, 'bed_id' => $bed->id])->assertConflict();
        $this->putJson('/api/admin/beds/'.$bed->id, ['ward_id' => $bed->ward_id, 'bed_number' => $bed->bed_number, 'bed_type' => $bed->bed_type, 'availability_status' => 'available'])->assertUnprocessable();
        $this->postJson('/api/admin/admissions/'.$id.'/discharge', ['discharge_summary' => 'Recovered'])->assertOk();
        $this->assertDatabaseHas('hospital_beds', ['id' => $bed->id, 'availability_status' => 'available']);
        $this->postJson('/api/admin/admissions/'.$id.'/discharge', ['discharge_summary' => 'Again'])->assertConflict();
        $this->assertDatabaseHas('notifications', ['user_id' => $patient->user_id, 'notification_type' => 'admission']);
    }

    public function test_invoices_and_payments_use_accurate_totals_and_are_idempotent(): void
    {
        $this->admin();
        $patient = $this->patient();
        $id = $this->postJson('/api/admin/invoices', ['patient_id' => $patient->id, 'items' => [['service_description' => 'Consultation', 'service_type' => 'consultation', 'quantity' => 3, 'unit_price' => '10.10']]])->assertCreated()->json('data.id');
        $this->assertEquals('30.30', Invoice::find($id)->total_amount);
        $payment = ['amount' => '10.10', 'payment_method' => 'mobile_money', 'payment_reference' => 'MOMO-001'];
        $this->postJson('/api/admin/invoices/'.$id.'/payments', $payment)->assertOk();
        $this->postJson('/api/admin/invoices/'.$id.'/payments', $payment)->assertOk();
        $this->assertDatabaseCount('payments', 1);
        $this->assertEquals('20.20', Invoice::find($id)->outstanding_balance);
        $payment['amount'] = '50.00';
        $payment['payment_reference'] = 'MOMO-002';
        $this->postJson('/api/admin/invoices/'.$id.'/payments', $payment)->assertUnprocessable();
        $payment['amount'] = '20.20';
        $this->postJson('/api/admin/invoices/'.$id.'/payments', $payment)->assertOk();
        $this->assertSame('paid', Invoice::find($id)->status);
        $this->postJson('/api/admin/invoices/'.$id.'/cancel')->assertConflict();
        $this->deleteJson('/api/admin/payments/1')->assertStatus(405);
    }

    public function test_stock_adjustments_record_movements_and_cannot_go_negative(): void
    {
        $this->admin();
        $id = $this->postJson('/api/admin/medicines', ['medicine_code' => 'MED-001', 'name' => 'Medicine', 'category' => 'General', 'unit' => 'tablet', 'unit_price' => '20.00', 'reorder_level' => 5, 'expiry_date' => now()->addYear()->toDateString(), 'status' => 'active', 'available_stock' => 999])->assertCreated()->assertJsonPath('data.available_stock', 0)->json('data.id');
        $this->postJson('/api/admin/medicines/'.$id.'/stock', ['quantity' => 10, 'reason' => 'Delivery'])->assertOk();
        $this->postJson('/api/admin/medicines/'.$id.'/stock', ['quantity' => -11, 'reason' => 'Correction'])->assertUnprocessable();
        $this->assertDatabaseHas('medicine_stock_movements', ['medicine_id' => $id, 'previous_stock' => 0, 'resulting_stock' => 10]);
        $this->assertDatabaseHas('medicines', ['id' => $id, 'available_stock' => 10]);
    }

    public function test_reports_are_filtered_and_audited_and_dashboard_uses_database(): void
    {
        $this->admin();
        $patient = $this->patient();
        $this->getJson('/api/dashboard/stats')->assertOk()->assertJsonPath('data.total_patients', 1)->assertJsonPath('data.total_doctors', 0);
        $response = $this->get('/api/admin/reports/patients?format=csv')->assertOk();
        $this->assertStringContainsString($patient->patient_number, $response->streamedContent());
        $pdf = $this->get('/api/admin/reports/patients?format=pdf')->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->assertStringStartsWith('%PDF-1.4', $pdf->getContent());
        $this->getJson('/api/admin/reports/users?format=csv&start_date=2030-01-01&end_date=2020-01-01')->assertUnprocessable();
        $this->assertDatabaseHas('audit_logs', ['action' => 'report_exported']);
    }

    public function test_notifications_are_scoped_to_the_authenticated_user(): void
    {
        $this->admin();
        $patient = $this->patient();
        $bed = $this->bed();
        $this->postJson('/api/admin/admissions', ['patient_id' => $patient->id, 'bed_id' => $bed->id])->assertCreated();
        $this->getJson('/api/notifications')->assertOk()->assertJsonCount(0, 'data');
        Sanctum::actingAs($patient->user);
        $this->getJson('/api/notifications')->assertOk()->assertJsonCount(1, 'data');
        $this->postJson('/api/notifications/read')->assertOk();
        $this->assertDatabaseHas('notifications', ['user_id' => $patient->user_id, 'is_read' => true]);
    }

    public function test_registration_is_patient_only_and_password_recovery_revokes_tokens(): void
    {
        Notification::fake();
        $data = ['name' => 'New Patient', 'email' => 'patient@example.test', 'phone_number' => '+250788654321', 'password' => 'PatientPass!123', 'password_confirmation' => 'PatientPass!123', 'date_of_birth' => '1995-01-01', 'gender' => 'Female', 'blood_group' => 'O+', 'address' => 'Kigali', 'emergency_contact_name' => 'Family', 'emergency_contact_phone' => '+250788654322', 'role' => 'admin'];
        $this->postJson('/api/auth/register', $data)->assertCreated()->assertJsonPath('user.role', 'patient');
        $user = User::where('email', $data['email'])->firstOrFail();
        $this->postJson('/api/auth/register', $data)->assertUnprocessable();
        $this->postJson('/api/auth/forgot-password', ['email' => $user->email])->assertOk();
        Notification::assertSentTo($user, ResetPassword::class);
        $token = Password::createToken($user);
        $this->postJson('/api/auth/reset-password', ['email' => $user->email, 'token' => $token, 'password' => 'ChangedPass!123', 'password_confirmation' => 'ChangedPass!123'])->assertOk();
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'ChangedPass!123'])->assertOk();
        $this->postJson('/api/auth/reset-password', ['email' => $user->email, 'token' => $token, 'password' => 'AnotherPass!123', 'password_confirmation' => 'AnotherPass!123'])->assertUnprocessable();
    }

    public function test_all_admin_resource_lists_and_analytics_load(): void
    {
        $this->admin();
        foreach (array_keys(AdminCatalog::definitions()) as $resource) {
            $this->getJson('/api/admin/'.$resource)->assertOk();
        }
        foreach (['doctor-performance', 'laboratory-revenue', 'revenue'] as $report) {
            $this->getJson('/api/admin/analytics/'.$report)->assertOk();
            $this->get('/api/admin/reports/'.$report.'?format=pdf')->assertOk();
        }
        $this->getJson('/api/configuration')->assertOk();
    }

    public function test_patient_search_includes_name_phone_and_history_is_audited(): void
    {
        $this->admin();
        $patient = $this->patient();
        $this->getJson('/api/admin/patients?search='.urlencode($patient->user->name))->assertOk()->assertJsonPath('total', 1);
        $this->getJson('/api/admin/patients/'.$patient->id)->assertOk()->assertJsonStructure(['data' => ['appointments', 'consultations', 'allergies', 'medical_histories']]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'patient_record_viewed', 'affected_record_id' => $patient->id]);
    }

    public function test_rescheduling_validates_slots_and_preserves_the_patient(): void
    {
        $this->admin();
        $doctor = $this->doctor();
        $patient = $this->patient();
        $date = now()->addDay();
        $this->postJson('/api/admin/doctor-schedules', ['doctor_id' => $doctor->id, 'day_of_week' => $date->format('l'), 'start_time' => '09:00', 'end_time' => '12:00', 'slot_duration' => 30, 'is_available' => true])->assertCreated();
        $data = ['patient_id' => $patient->id, 'doctor_id' => $doctor->id, 'appointment_date' => $date->toDateString(), 'appointment_time' => '09:00', 'reason' => 'Checkup'];
        $id = $this->postJson('/api/admin/appointments', $data)->assertCreated()->json('data.id');
        $data['appointment_time'] = '11:30';
        $this->postJson('/api/admin/appointments/'.$id.'/reschedule', $data)->assertCreated();
        $this->assertDatabaseCount('appointments', 1);
        $this->assertDatabaseHas('appointments', ['id' => $id, 'appointment_time' => '11:30:00']);
        $data['appointment_time'] = '12:00';
        $this->postJson('/api/admin/appointments/'.$id.'/reschedule', $data)->assertConflict();
        $this->assertDatabaseHas('appointments', ['id' => $id, 'appointment_time' => '11:30:00']);
        $data['appointment_time'] = '10:00';
        $data['patient_id'] = $this->patient()->id;
        $this->postJson('/api/admin/appointments/'.$id.'/reschedule', $data)->assertConflict();
    }

    public function test_real_token_logout_and_profile_password_change(): void
    {
        $user = User::factory()->create(['role' => 'admin', 'password' => 'Correct!123']);
        $token = $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'Correct!123'])->assertOk()->json('token');
        app('auth')->forgetGuards();
        $this->withToken($token)->putJson('/api/auth/profile', ['name' => $user->name, 'email' => $user->email, 'phone_number' => $user->phone_number, 'password' => 'Changed!123', 'password_confirmation' => 'Changed!123', 'current_password' => 'wrong'])->assertUnprocessable();
        $this->withToken($token)->putJson('/api/auth/profile', ['name' => $user->name, 'email' => $user->email, 'phone_number' => $user->phone_number, 'password' => 'Changed!123', 'password_confirmation' => 'Changed!123', 'current_password' => 'Correct!123'])->assertOk();
        $this->assertTrue(Hash::check('Changed!123', $user->fresh()->password));
        $this->withToken($token)->postJson('/api/auth/logout')->assertOk();
        app('auth')->forgetGuards();
        $this->withToken($token)->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_private_lab_files_are_hidden_and_downloads_are_authorized(): void
    {
        $this->admin();
        Storage::fake('local');
        Storage::disk('local')->put('reports/sample.pdf', 'private report');
        $patient = $this->patient();
        $doctor = $this->doctor();
        $appointment = Appointment::create(['patient_id' => $patient->id, 'doctor_id' => $doctor->id, 'appointment_number' => 'APT-PRIVATE', 'appointment_date' => today(), 'appointment_time' => '09:00:00', 'reason' => 'Review']);
        $consultation = Consultation::create(['appointment_id' => $appointment->id, 'patient_id' => $patient->id, 'doctor_id' => $doctor->id, 'diagnosis' => 'Diagnosis', 'consultation_notes' => 'Notes']);
        $type = LabTestType::create(['name' => 'Test', 'price' => 1000, 'expected_turnaround_time' => '1 hour']);
        $test = LabTest::create(['patient_id' => $patient->id, 'doctor_id' => $doctor->id, 'consultation_id' => $consultation->id, 'test_type_id' => $type->id, 'request_date' => now()]);
        $report = LabReport::create(['lab_test_id' => $test->id, 'uploaded_by' => auth()->id(), 'file_path' => 'reports/sample.pdf', 'file_type' => 'pdf', 'file_size' => 14, 'upload_date' => now()]);
        $this->getJson('/api/admin/lab-tests')->assertOk()->assertJsonPath('data.0.test_type.name', 'Test');
        $this->getJson('/api/admin/lab-reports')->assertOk()->assertJsonMissingPath('data.0.file_path');
        $this->get('/api/admin/lab-reports/'.$report->id.'/download')->assertOk();
        Sanctum::actingAs($patient->user);
        $this->getJson('/api/admin/lab-reports/'.$report->id.'/download')->assertForbidden();
    }

    public function test_legacy_user_schema_repair_preserves_existing_records(): void
    {
        $user = User::factory()->create();
        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex(['role', 'account_status']);
            $table->dropUnique(['phone_number']);
            $table->dropColumn(['phone_number', 'role', 'account_status', 'deleted_at']);
        });
        $migration = require glob(database_path('migrations/*reconcile_legacy_user_columns.php'))[0];
        $migration->up();
        $this->assertDatabaseHas('users', ['id' => $user->id, 'email' => $user->email, 'role' => 'patient', 'account_status' => 'active']);
        $this->assertTrue(Schema::hasColumn('users', 'phone_number'));
    }

    public function test_admin_creation_command_and_nonempty_analytics(): void
    {
        $this->artisan('admin:create', ['email' => 'first-admin@example.test', '--phone' => '+250788000009'])->assertSuccessful();
        $this->assertDatabaseHas('users', ['email' => 'first-admin@example.test', 'role' => 'admin']);
        $this->artisan('admin:create', ['email' => 'first-admin@example.test', '--phone' => '+250788000008'])->assertFailed();
        $this->admin();
        $doctor = $this->doctor();
        $patient = $this->patient();
        $id = $this->postJson('/api/admin/invoices', ['patient_id' => $patient->id, 'items' => [['service_description' => 'Blood test', 'service_type' => 'lab_test', 'quantity' => 2, 'unit_price' => '10.10']]])->assertCreated()->json('data.id');
        $this->postJson('/api/admin/invoices/'.$id.'/payments', ['amount' => '20.20', 'payment_reference' => 'ANALYTICS-001', 'payment_method' => 'cash'])->assertOk();
        $this->getJson('/api/admin/analytics/laboratory-revenue')->assertOk()->assertJsonPath('data.0.quantity', 2)->assertJsonPath('data.0.total_billed', 20.2);
        $this->getJson('/api/admin/analytics/revenue')->assertOk()->assertJsonPath('data.0.revenue', 20.2);
        $this->getJson('/api/admin/analytics/doctor-performance')->assertOk()->assertJsonPath('data.0.doctor', $doctor->user->name);
        $this->getJson('/api/admin/invoices?end_date='.now()->addDay()->toDateString())->assertOk()->assertJsonPath('total', 1);
    }
}
