<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Consultation;
use App\Models\Dispensation;
use App\Models\Doctor;
use App\Models\DoctorSchedule;
use App\Models\Invoice;
use App\Models\LabReport;
use App\Models\LabTest;
use App\Models\LabTestType;
use App\Models\Medicine;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DoctorFunctionalityTest extends TestCase
{
    use RefreshDatabase;

    private function doctor(array $userAttributes = []): Doctor
    {
        $doctor = Doctor::factory()->create(['user_id' => User::factory()->create(['role' => 'doctor'] + $userAttributes)->id]);
        Sanctum::actingAs($doctor->user);

        return $doctor;
    }

    private function appointment(Doctor $doctor, array $attributes = []): Appointment
    {
        return Appointment::factory()->create(['doctor_id' => $doctor->id] + $attributes);
    }

    private function consultation(Doctor $doctor): Consultation
    {
        $appointment = $this->appointment($doctor);
        $id = $this->postJson('/api/doctor/consultations', ['appointment_id' => $appointment->id, 'diagnosis' => 'Clinical diagnosis', 'consultation_notes' => 'Clinical notes', 'treatment_recommendations' => 'Care plan', 'follow_up_date' => now()->addWeek()->toDateString()])->assertCreated()->json('data.id');

        return Consultation::findOrFail($id);
    }

    private function medicine(array $attributes = []): Medicine
    {
        return Medicine::create($attributes + ['medicine_code' => fake()->unique()->bothify('MED-#######'), 'name' => 'Test medicine', 'category' => 'General', 'unit' => 'tablet', 'unit_price' => '12.35', 'available_stock' => 10, 'reorder_level' => 2, 'expiry_date' => now()->addYear()->toDateString(), 'status' => 'active']);
    }

    private function prescriptionData(Consultation $consultation, Medicine $medicine): array
    {
        return ['consultation_id' => $consultation->id, 'prescription_instructions' => 'Instructions recorded by doctor', 'items' => [['medicine_id' => $medicine->id, 'dosage' => 'One tablet', 'frequency' => 'Once daily', 'duration' => 'Seven days', 'quantity' => 7]]];
    }

    private function labType(): LabTestType
    {
        return LabTestType::create(['name' => fake()->unique()->words(3, true), 'price' => '2500.25', 'status' => 'active', 'expected_turnaround_time' => '24 hours']);
    }

    public function test_doctor_routes_require_login_role_and_linked_profile(): void
    {
        $this->getJson('/api/doctor/dashboard')->assertUnauthorized();
        foreach (['patient', 'admin', 'lab_tech', 'pharmacist'] as $role) {
            Sanctum::actingAs(User::factory()->create(['role' => $role]));
            $this->getJson('/api/doctor/dashboard')->assertForbidden();
        }
        Sanctum::actingAs(User::factory()->create(['role' => 'doctor']));
        $this->getJson('/api/doctor/dashboard')->assertForbidden();
    }

    public function test_real_doctor_login_and_scoped_dashboard_and_lists(): void
    {
        $doctor = Doctor::factory()->create(['user_id' => User::factory()->create(['role' => 'doctor', 'password' => 'DoctorPass!123'])->id]);
        $this->appointment($doctor);
        Appointment::factory()->create();
        $token = $this->postJson('/api/auth/login', ['email' => $doctor->user->email, 'password' => 'DoctorPass!123'])->assertOk()->assertJsonPath('user.role', 'doctor')->json('token');
        $this->withToken($token)->getJson('/api/doctor/dashboard')->assertOk()->assertJsonPath('data.today_appointments', 1);
        $this->withToken($token)->getJson('/api/doctor/appointments')->assertOk()->assertJsonCount(1, 'data')->assertJsonMissingPath('data.0.patient.user.permissions');
        $this->withToken($token)->getJson('/api/admin/users')->assertForbidden();
    }

    public function test_ownership_and_patient_care_relationships_are_enforced(): void
    {
        $doctor = $this->doctor();
        $assigned = $this->appointment($doctor);
        $other = Appointment::factory()->create();
        $this->getJson('/api/doctor/appointments/'.$other->id)->assertForbidden();
        $this->getJson('/api/doctor/patients/'.$other->patient_id)->assertForbidden();
        $this->getJson('/api/doctor/patients/'.$assigned->patient_id)->assertOk()->assertJsonStructure(['data' => ['allergies', 'medical_histories', 'consultations', 'prescriptions', 'lab_tests']]);
        $this->getJson('/api/doctor/patients')->assertOk()->assertJsonPath('meta.total', 1);
        $assigned->update(['status' => 'cancelled']);
        $this->getJson('/api/doctor/patients/'.$assigned->patient_id)->assertForbidden();
        $this->assertDatabaseHas('audit_logs', ['action' => 'unauthorized_access', 'affected_table' => 'patients']);
    }

    public function test_doctor_can_manage_own_schedules_and_conflicts_are_prevented(): void
    {
        $doctor = $this->doctor();
        $data = ['day_of_week' => 'Monday', 'start_time' => '09:00', 'end_time' => '12:00', 'slot_duration' => 30, 'is_available' => true];
        $id = $this->postJson('/api/doctor/schedules', $data)->assertCreated()->assertJsonPath('data.doctor_id', $doctor->id)->json('data.id');
        $this->postJson('/api/doctor/schedules', $data)->assertUnprocessable();
        $adjacent = $data;
        $adjacent['start_time'] = '12:00';
        $adjacent['end_time'] = '14:00';
        $this->postJson('/api/doctor/schedules', $adjacent)->assertCreated();
        $this->putJson('/api/doctor/schedules/'.$id, $data + ['doctor_id' => Doctor::factory()->create()->id])->assertUnprocessable();
        $this->putJson('/api/doctor/schedules/'.$id, array_replace($data, ['is_available' => false]))->assertOk();
        $this->deleteJson('/api/doctor/schedules/'.$id)->assertOk();
    }

    public function test_schedule_ownership_and_upcoming_bookings_are_protected(): void
    {
        $doctor = $this->doctor();
        $date = now()->addWeek();
        $data = ['day_of_week' => $date->format('l'), 'start_time' => '09:00', 'end_time' => '12:00', 'slot_duration' => 30, 'is_available' => true];
        $id = $this->postJson('/api/doctor/schedules', $data)->assertCreated()->json('data.id');
        $this->appointment($doctor, ['appointment_date' => $date->toDateString()]);
        $this->deleteJson('/api/doctor/schedules/'.$id)->assertConflict();
        $this->putJson('/api/doctor/schedules/'.$id, array_replace($data, ['is_available' => false]))->assertConflict();
        $other = DoctorSchedule::create($data + ['doctor_id' => Doctor::factory()->create()->id]);
        $this->deleteJson('/api/doctor/schedules/'.$other->id)->assertForbidden();
    }

    public function test_consultation_finalizes_appointment_and_generates_consultation_charge(): void
    {
        $doctor = $this->doctor();
        $consultation = $this->consultation($doctor);
        $this->assertDatabaseHas('appointments', ['id' => $consultation->appointment_id, 'status' => 'completed']);
        $this->assertDatabaseHas('invoices', ['patient_id' => $consultation->patient_id, 'appointment_id' => $consultation->appointment_id, 'total_amount' => 5000, 'outstanding_balance' => 5000]);
        $this->postJson('/api/doctor/consultations', ['appointment_id' => $consultation->appointment_id, 'diagnosis' => 'Again', 'consultation_notes' => 'Duplicate'])->assertConflict();
        $this->assertDatabaseCount('consultations', 1);
        $this->assertDatabaseCount('invoice_items', 1);
        $this->getJson('/api/doctor/consultations/'.$consultation->id)->assertOk();
        $this->assertDatabaseHas('notifications', ['user_id' => $consultation->patient->user_id, 'notification_type' => 'consultation']);
    }

    public function test_invalid_future_pending_and_foreign_consultations_are_rejected(): void
    {
        $doctor = $this->doctor();
        $appointment = $this->appointment($doctor, ['appointment_date' => now()->addDay()->toDateString()]);
        $data = ['appointment_id' => $appointment->id, 'diagnosis' => 'Diagnosis', 'consultation_notes' => 'Notes'];
        $this->postJson('/api/doctor/consultations', $data)->assertConflict();
        $appointment->update(['appointment_date' => today(), 'status' => 'pending']);
        $this->postJson('/api/doctor/consultations', $data)->assertConflict();
        $data['appointment_id'] = Appointment::factory()->create()->id;
        $this->postJson('/api/doctor/consultations', $data)->assertForbidden();
        $data['patient_id'] = Patient::factory()->create()->id;
        $this->postJson('/api/doctor/consultations', $data)->assertUnprocessable();
        $this->assertDatabaseCount('consultations', 0);
        $this->assertDatabaseCount('invoices', 0);
    }

    public function test_prescription_creation_update_cancellation_and_server_prices(): void
    {
        $doctor = $this->doctor();
        $consultation = $this->consultation($doctor);
        $medicine = $this->medicine();
        $pharmacist = User::factory()->create(['role' => 'pharmacist']);
        $data = $this->prescriptionData($consultation, $medicine);
        $id = $this->postJson('/api/doctor/prescriptions', $data)->assertCreated()->assertJsonPath('data.items.0.unit_price', '12.35')->json('data.id');
        $this->assertSame(10, $medicine->fresh()->available_stock);
        $this->assertDatabaseHas('notifications', ['user_id' => $pharmacist->id, 'notification_type' => 'prescription']);
        unset($data['consultation_id']);
        $data['items'][0]['quantity'] = 5;
        $this->putJson('/api/doctor/prescriptions/'.$id, $data)->assertOk()->assertJsonPath('data.items.0.quantity', 5);
        $pdf = $this->get('/api/doctor/prescriptions/'.$id.'/download')->assertOk();
        $this->assertStringStartsWith('%PDF-1.4', $pdf->getContent());
        $this->postJson('/api/doctor/prescriptions/'.$id.'/cancel')->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->putJson('/api/doctor/prescriptions/'.$id, $data)->assertConflict();
    }

    public function test_expired_medicines_duplicates_forged_prices_and_dispensed_edits_are_blocked(): void
    {
        $doctor = $this->doctor();
        $consultation = $this->consultation($doctor);
        $medicine = $this->medicine(['expiry_date' => now()->subDay()->toDateString()]);
        $data = $this->prescriptionData($consultation, $medicine);
        $this->postJson('/api/doctor/prescriptions', $data)->assertUnprocessable();
        $medicine->update(['expiry_date' => now()->addYear()->toDateString()]);
        $data['items'][] = $data['items'][0];
        $this->postJson('/api/doctor/prescriptions', $data)->assertUnprocessable();
        array_pop($data['items']);
        $data['items'][0]['unit_price'] = 0;
        $this->postJson('/api/doctor/prescriptions', $data)->assertUnprocessable();
        unset($data['items'][0]['unit_price']);
        $id = $this->postJson('/api/doctor/prescriptions', $data)->assertCreated()->json('data.id');
        Dispensation::create(['prescription_id' => $id, 'pharmacist_id' => User::factory()->create(['role' => 'pharmacist'])->id, 'dispensing_date' => now(), 'dispensing_status' => 'partially_completed']);
        unset($data['consultation_id']);
        $this->putJson('/api/doctor/prescriptions/'.$id, $data)->assertConflict();
        $this->postJson('/api/doctor/prescriptions/'.$id.'/cancel')->assertConflict();
    }

    public function test_laboratory_requests_are_linked_billed_notified_and_can_be_cancelled_before_processing(): void
    {
        $doctor = $this->doctor();
        $consultation = $this->consultation($doctor);
        $type = $this->labType();
        $technician = User::factory()->create(['role' => 'lab_tech']);
        $data = ['consultation_id' => $consultation->id, 'test_type_ids' => [$type->id]];
        $id = $this->postJson('/api/doctor/lab-requests', $data)->assertCreated()->json('data.0.id');
        $this->assertDatabaseHas('lab_tests', ['id' => $id, 'patient_id' => $consultation->patient_id, 'doctor_id' => $doctor->id, 'status' => 'requested']);
        $this->assertEquals('7500.25', Invoice::first()->total_amount);
        $this->assertDatabaseHas('notifications', ['user_id' => $technician->id, 'notification_type' => 'laboratory']);
        $this->postJson('/api/doctor/lab-requests', $data)->assertConflict();
        $this->assertDatabaseCount('lab_tests', 1);
        $this->postJson('/api/doctor/lab-requests/'.$id.'/cancel')->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->assertEquals('5000.00', Invoice::first()->total_amount);
    }

    public function test_laboratory_multi_request_rolls_back_and_paid_charges_cannot_be_cancelled(): void
    {
        $doctor = $this->doctor();
        $consultation = $this->consultation($doctor);
        $type = $this->labType();
        $second = $this->labType();
        $id = $this->postJson('/api/doctor/lab-requests', ['consultation_id' => $consultation->id, 'test_type_ids' => [$type->id]])->assertCreated()->json('data.0.id');
        $this->postJson('/api/doctor/lab-requests', ['consultation_id' => $consultation->id, 'test_type_ids' => [$second->id, $type->id]])->assertConflict();
        $this->assertDatabaseCount('lab_tests', 1);
        Invoice::first()->update(['amount_paid' => 100, 'outstanding_balance' => '7400.25', 'status' => 'partially_paid']);
        $this->postJson('/api/doctor/lab-requests/'.$id.'/cancel')->assertConflict();
        $this->assertDatabaseHas('lab_tests', ['id' => $id, 'status' => 'requested']);
    }

    public function test_private_lab_report_access_and_patient_history_are_protected(): void
    {
        $doctor = $this->doctor();
        $consultation = $this->consultation($doctor);
        $type = $this->labType();
        $test = LabTest::create(['consultation_id' => $consultation->id, 'doctor_id' => $doctor->id, 'patient_id' => $consultation->patient_id, 'test_type_id' => $type->id, 'request_date' => now(), 'status' => 'completed', 'result_summary' => 'Completed test findings']);
        Storage::fake('local');
        Storage::disk('local')->put('labs/private.pdf', 'private report');
        $report = LabReport::create(['lab_test_id' => $test->id, 'uploaded_by' => User::factory()->create(['role' => 'lab_tech'])->id, 'file_path' => 'labs/private.pdf', 'file_type' => 'pdf', 'file_size' => 14, 'upload_date' => now(), 'report_status' => 'completed']);
        $this->get('/api/doctor/lab-reports/'.$report->id.'/download')->assertOk();
        $this->getJson('/api/doctor/lab-requests')->assertOk()->assertJsonMissingPath('data.0.reports.0.file_path');
        $this->getJson('/api/doctor/patients/'.$consultation->patient_id)->assertOk()->assertJsonMissingPath('data.lab_tests.0.reports.0.file_path');
        $other = $this->doctor();
        $this->getJson('/api/doctor/lab-reports/'.$report->id.'/download')->assertForbidden();
        $this->getJson('/api/doctor/consultations/'.$consultation->id)->assertForbidden();
    }

    public function test_professional_profile_and_clinical_history_updates_are_validated(): void
    {
        $doctor = $this->doctor();
        $appointment = $this->appointment($doctor);
        $this->putJson('/api/doctor/profile', ['bio' => 'Professional biography', 'room_number' => '202'])->assertOk()->assertJsonPath('data.bio', 'Professional biography');
        $this->putJson('/api/doctor/profile', ['consultation_fee' => 0])->assertUnprocessable();
        $this->postJson('/api/doctor/patients/'.$appointment->patient_id.'/allergies', ['allergy_name' => 'Known allergen', 'severity' => 'severe', 'reaction_description' => 'Recorded reaction'])->assertCreated();
        $this->postJson('/api/doctor/patients/'.$appointment->patient_id.'/medical-history', ['condition' => 'Existing condition', 'diagnosis_details' => 'Patient history'])->assertCreated();
        $this->getJson('/api/doctor/patients/'.$appointment->patient_id)->assertOk()->assertJsonCount(1, 'data.allergies')->assertJsonCount(1, 'data.medical_histories');
    }

    public function test_permissions_inactive_professional_status_and_foreign_record_mutations(): void
    {
        $doctor = $this->doctor(['permissions' => ['view_own_records']]);
        $this->getJson('/api/doctor/dashboard')->assertOk();
        $this->postJson('/api/doctor/schedules', ['day_of_week' => 'Monday', 'start_time' => '09:00', 'end_time' => '10:00', 'slot_duration' => 30, 'is_available' => true])->assertForbidden();
        $appointment = $this->appointment($doctor);
        $this->postJson('/api/doctor/consultations', ['appointment_id' => $appointment->id, 'diagnosis' => 'Test', 'consultation_notes' => 'Test'])->assertForbidden();
        $doctor->user->update(['permissions' => null]);
        Sanctum::actingAs($doctor->user->fresh());
        $doctor->update(['professional_status' => 'on_leave']);
        $this->postJson('/api/doctor/consultations', ['appointment_id' => $appointment->id, 'diagnosis' => 'Test', 'consultation_notes' => 'Test'])->assertForbidden();
    }

    public function test_appointment_status_changes_are_scoped_and_notified(): void
    {
        $doctor = $this->doctor();
        $appointment = $this->appointment($doctor, ['status' => 'pending']);
        $this->postJson('/api/doctor/appointments/'.$appointment->id.'/status', ['status' => 'confirmed'])->assertOk()->assertJsonPath('data.status', 'confirmed');
        $this->postJson('/api/doctor/appointments/'.$appointment->id.'/status', ['status' => 'cancelled'])->assertUnprocessable();
        $this->postJson('/api/doctor/appointments/'.$appointment->id.'/status', ['status' => 'cancelled', 'cancellation_reason' => 'Doctor unavailable'])->assertOk();
        $other = Appointment::factory()->create(['status' => 'pending']);
        $this->postJson('/api/doctor/appointments/'.$other->id.'/status', ['status' => 'confirmed'])->assertForbidden();
    }

    public function test_foreign_prescription_and_laboratory_mutations_are_forbidden(): void
    {
        $doctor = $this->doctor();
        $consultation = $this->consultation($doctor);
        $medicine = $this->medicine();
        $data = $this->prescriptionData($consultation, $medicine);
        $prescription = $this->postJson('/api/doctor/prescriptions', $data)->assertCreated()->json('data.id');
        $type = $this->labType();
        $lab = $this->postJson('/api/doctor/lab-requests', ['consultation_id' => $consultation->id, 'test_type_ids' => [$type->id]])->assertCreated()->json('data.0.id');
        $other = $this->doctor();
        unset($data['consultation_id']);
        $this->putJson('/api/doctor/prescriptions/'.$prescription, $data)->assertForbidden();
        $this->postJson('/api/doctor/prescriptions/'.$prescription.'/cancel')->assertForbidden();
        $this->getJson('/api/doctor/prescriptions/'.$prescription.'/download')->assertForbidden();
        $this->postJson('/api/doctor/lab-requests/'.$lab.'/cancel')->assertForbidden();
        $this->postJson('/api/doctor/lab-requests', ['consultation_id' => $consultation->id, 'test_type_ids' => [$type->id]])->assertForbidden();
        $this->assertDatabaseHas('prescriptions', ['id' => $prescription, 'status' => 'pending']);
        $this->assertDatabaseHas('lab_tests', ['id' => $lab, 'status' => 'requested']);
    }

    public function test_doctor_schedules_work_with_admin_booking_and_reject_unusable_durations(): void
    {
        $doctor = $this->doctor();
        $date = now()->addWeek();
        $data = ['day_of_week' => $date->format('l'), 'start_time' => '09:00', 'end_time' => '10:00', 'slot_duration' => 120, 'is_available' => true];
        $this->postJson('/api/doctor/schedules', $data)->assertUnprocessable()->assertJsonValidationErrors('slot_duration');
        $data['slot_duration'] = 30;
        $this->postJson('/api/doctor/schedules', $data)->assertCreated();
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $this->postJson('/api/admin/appointments', ['doctor_id' => $doctor->id, 'patient_id' => Patient::factory()->create()->id, 'appointment_date' => $date->toDateString(), 'appointment_time' => '09:00', 'reason' => 'Scheduled consultation'])->assertCreated();
        $this->assertDatabaseHas('notifications', ['user_id' => $doctor->user_id, 'notification_type' => 'appointment']);
    }

    public function test_new_lab_charges_preserve_paid_invoices_and_zero_fee_consultations(): void
    {
        $doctor = $this->doctor();
        $consultation = $this->consultation($doctor);
        $invoice = Invoice::first();
        $invoice->update(['amount_paid' => $invoice->total_amount, 'outstanding_balance' => 0, 'status' => 'paid']);
        $type = $this->labType();
        $lab = $this->postJson('/api/doctor/lab-requests', ['consultation_id' => $consultation->id, 'test_type_ids' => [$type->id]])->assertCreated()->json('data.0.id');
        $this->assertDatabaseCount('invoices', 2);
        $this->assertEquals('5000.00', $invoice->fresh()->total_amount);
        $this->assertSame('paid', $invoice->fresh()->status);
        $this->postJson('/api/doctor/lab-requests/'.$lab.'/cancel')->assertOk();
        $this->assertDatabaseHas('invoices', ['status' => 'cancelled', 'total_amount' => 0, 'outstanding_balance' => 0]);
        $doctor->update(['consultation_fee' => 0]);
        $this->consultation($doctor);
        $this->assertDatabaseCount('invoices', 2);
    }

    public function test_patient_sort_search_and_pagination_preserve_care_scope(): void
    {
        $doctor = $this->doctor();
        $first = $this->appointment($doctor);
        $first->patient->user->update(['name' => 'Zoe Patient']);
        $second = $this->appointment($doctor);
        $second->patient->user->update(['name' => 'Alice Patient']);
        Appointment::factory()->create();
        $this->getJson('/api/doctor/patients?sort=user&direction=asc&per_page=1')->assertOk()->assertJsonPath('meta.total', 2)->assertJsonPath('data.0.user.name', 'Alice Patient');
        $this->getJson('/api/doctor/patients?sort=user&direction=asc&per_page=1&page=2')->assertOk()->assertJsonPath('data.0.user.name', 'Zoe Patient');
        $this->getJson('/api/doctor/patients?search=Zoe')->assertOk()->assertJsonPath('meta.total', 1);
    }
}
