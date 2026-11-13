<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Consultation;
use App\Models\Doctor;
use App\Models\DoctorSchedule;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\LabReport;
use App\Models\LabTest;
use App\Models\LabTestType;
use App\Models\Medicine;
use App\Models\Patient;
use App\Models\Payment;
use App\Models\Prescription;
use App\Models\PrescriptionItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PatientFunctionalityTest extends TestCase
{
    use RefreshDatabase;

    private function patient(array $attributes = []): Patient
    {
        $patient = Patient::factory()->create($attributes);
        Sanctum::actingAs($patient->user);

        return $patient;
    }

    private function doctor(): Doctor
    {
        $doctor = Doctor::factory()->create();
        $date = now()->addDay();
        DoctorSchedule::create(['doctor_id' => $doctor->id, 'day_of_week' => $date->format('l'), 'start_time' => '09:00:00', 'end_time' => '10:00:00', 'slot_duration' => 30, 'is_available' => true]);

        return $doctor;
    }

    private function booking(Doctor $doctor): array
    {
        return ['doctor_id' => $doctor->id, 'appointment_date' => now()->addDay()->toDateString(), 'appointment_time' => '09:00', 'reason' => 'Appointment reason'];
    }

    private function consultation(Patient $patient, ?Doctor $doctor = null): Consultation
    {
        $doctor ??= Doctor::factory()->create();
        $appointment = Appointment::factory()->create(['patient_id' => $patient->id, 'doctor_id' => $doctor->id, 'status' => 'completed']);

        return Consultation::create(['appointment_id' => $appointment->id, 'patient_id' => $patient->id, 'doctor_id' => $doctor->id, 'diagnosis' => 'Recorded diagnosis', 'consultation_notes' => 'Authorized clinical notes', 'treatment_recommendations' => 'Recorded care plan', 'follow_up_date' => now()->addWeek()->toDateString()]);
    }

    private function prescription(Consultation $consultation): Prescription
    {
        $medicine = Medicine::create(['medicine_code' => fake()->unique()->bothify('MED-#######'), 'name' => 'Prescription medicine', 'category' => 'General', 'unit' => 'tablet', 'unit_price' => '10.10', 'expiry_date' => now()->addYear()->toDateString(), 'status' => 'active']);
        $prescription = Prescription::create(['consultation_id' => $consultation->id, 'patient_id' => $consultation->patient_id, 'doctor_id' => $consultation->doctor_id, 'issue_date' => now(), 'status' => 'pending', 'prescription_instructions' => 'Recorded prescription instructions']);
        PrescriptionItem::create(['prescription_id' => $prescription->id, 'medicine_id' => $medicine->id, 'dosage' => 'Recorded dose', 'frequency' => 'Recorded frequency', 'duration' => 'Recorded duration', 'quantity' => 3, 'unit_price' => '10.10']);

        return $prescription;
    }

    private function invoice(Patient $patient): Invoice
    {
        $invoice = Invoice::create(['patient_id' => $patient->id, 'invoice_number' => fake()->unique()->bothify('INV-#######'), 'issue_date' => today(), 'total_amount' => '100.50', 'amount_paid' => '25.25', 'outstanding_balance' => '75.25', 'status' => 'partially_paid']);
        InvoiceItem::create(['invoice_id' => $invoice->id, 'service_description' => 'Consultation', 'service_type' => 'consultation', 'quantity' => 1, 'unit_price' => '100.50', 'subtotal' => '100.50']);
        Payment::create(['invoice_id' => $invoice->id, 'payment_reference' => fake()->unique()->bothify('PAY-#######'), 'amount' => '25.25', 'payment_method' => 'cash', 'transaction_status' => 'completed', 'received_by' => User::factory()->create(['role' => 'admin'])->id, 'payment_date' => now()]);

        return $invoice;
    }

    private function lab(Consultation $consultation, string $status = 'completed'): LabTest
    {
        $type = LabTestType::create(['name' => fake()->unique()->words(3, true), 'price' => '1000.00', 'expected_turnaround_time' => '24 hours']);

        return LabTest::create(['consultation_id' => $consultation->id, 'patient_id' => $consultation->patient_id, 'doctor_id' => $consultation->doctor_id, 'test_type_id' => $type->id, 'request_date' => now(), 'status' => $status, 'result_summary' => 'Recorded laboratory findings']);
    }

    public function test_patient_routes_require_authentication_role_and_profile(): void
    {
        $this->getJson('/api/patient/dashboard')->assertUnauthorized();
        foreach (['admin', 'doctor', 'lab_tech', 'pharmacist'] as $role) {
            Sanctum::actingAs(User::factory()->create(['role' => $role]));
            $this->getJson('/api/patient/dashboard')->assertForbidden();
        }
        Sanctum::actingAs(User::factory()->create(['role' => 'patient']));
        $this->getJson('/api/patient/dashboard')->assertForbidden();
    }

    public function test_registration_creates_patient_profile_welcome_notification_and_real_login(): void
    {
        $data = ['name' => 'New Patient', 'email' => 'new-patient@example.test', 'phone_number' => '+250788765432', 'password' => 'PatientPass!123', 'password_confirmation' => 'PatientPass!123', 'date_of_birth' => '1995-01-01', 'gender' => 'Female', 'blood_group' => 'O+', 'address' => 'Kigali', 'emergency_contact_name' => 'Contact', 'emergency_contact_phone' => '+250788765433', 'role' => 'admin'];
        $response = $this->postJson('/api/auth/register', $data)->assertCreated()->assertJsonPath('user.role', 'patient');
        $this->assertDatabaseHas('patients', ['user_id' => $response->json('user.id'), 'date_of_birth' => '1995-01-01']);
        $this->assertDatabaseHas('notifications', ['user_id' => $response->json('user.id'), 'notification_type' => 'registration']);
        $this->withToken($response->json('token'))->getJson('/api/patient/profile')->assertOk()->assertJsonPath('data.user.email', $data['email']);
        $this->postJson('/api/auth/register', $data)->assertUnprocessable();
        $this->postJson('/api/auth/login', ['email' => $data['email'], 'password' => 'PatientPass!123'])->assertOk();
    }

    public function test_directory_only_returns_active_providers_and_public_fields(): void
    {
        $this->patient();
        $doctor = $this->doctor();
        $inactive = Doctor::factory()->create(['professional_status' => 'on_leave']);
        $this->getJson('/api/patient/doctors')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonMissingPath('data.0.user')->assertJsonMissingPath('data.0.license_number');
        $this->getJson('/api/patient/doctors?department_id='.$doctor->department_id.'&specialization_id='.$doctor->specialization_id)->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/patient/doctors/'.$inactive->id)->assertNotFound();
        $doctor->user->update(['account_status' => 'inactive']);
        $this->getJson('/api/patient/doctors')->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson('/api/patient/directory')->assertOk()->assertJsonStructure(['data' => ['departments', 'specializations', 'today', 'timezone', 'can_book']]);
    }

    public function test_slots_respect_schedules_bookings_and_the_patients_existing_appointments(): void
    {
        $patient = $this->patient();
        $doctor = $this->doctor();
        $date = now()->addDay()->toDateString();
        $this->getJson('/api/patient/doctors/'.$doctor->id.'/slots?date='.$date)->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.0.time', '09:00');
        Appointment::factory()->create(['doctor_id' => $doctor->id, 'appointment_date' => $date, 'appointment_time' => '09:00:00']);
        $this->getJson('/api/patient/doctors/'.$doctor->id.'/slots?date='.$date)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.time', '09:30');
        Appointment::factory()->create(['patient_id' => $patient->id, 'appointment_date' => $date, 'appointment_time' => '09:30:00']);
        $this->getJson('/api/patient/doctors/'.$doctor->id.'/slots?date='.$date)->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_booking_derives_patient_and_pending_status_and_notifies_both_users(): void
    {
        $patient = $this->patient();
        $doctor = $this->doctor();
        $data = $this->booking($doctor);
        $id = $this->postJson('/api/patient/appointments', $data)->assertCreated()->assertJsonPath('data.status', 'pending')->json('data.id');
        $this->assertDatabaseHas('appointments', ['id' => $id, 'patient_id' => $patient->id, 'doctor_id' => $doctor->id, 'status' => 'pending']);
        $this->assertDatabaseHas('notifications', ['user_id' => $patient->user_id, 'notification_type' => 'appointment']);
        $this->assertDatabaseHas('notifications', ['user_id' => $doctor->user_id, 'notification_type' => 'appointment']);
        $this->assertDatabaseCount('invoices', 0);
        $this->postJson('/api/patient/appointments', $data + ['patient_id' => Patient::factory()->create()->id])->assertUnprocessable();
        $this->postJson('/api/patient/appointments', $data + ['status' => 'confirmed'])->assertUnprocessable();
    }

    public function test_booking_rechecks_conflicts_inactive_doctors_and_invalid_slot_boundaries(): void
    {
        $this->patient();
        $doctor = $this->doctor();
        $data = $this->booking($doctor);
        $this->postJson('/api/patient/appointments', array_replace($data, ['appointment_time' => '09:10']))->assertConflict();
        $this->postJson('/api/patient/appointments', array_replace($data, ['appointment_time' => '10:00']))->assertConflict();
        $this->postJson('/api/patient/appointments', $data)->assertCreated();
        $this->postJson('/api/patient/appointments', $data)->assertConflict();
        $doctor->update(['professional_status' => 'on_leave']);
        $data['appointment_time'] = '09:30';
        $this->postJson('/api/patient/appointments', $data)->assertConflict();
        $this->assertDatabaseCount('appointments', 1);
    }

    public function test_patient_rescheduling_preserves_ownership_and_requires_confirmation_again(): void
    {
        $patient = $this->patient();
        $doctor = $this->doctor();
        $data = $this->booking($doctor);
        $appointment = Appointment::factory()->create(['patient_id' => $patient->id, 'doctor_id' => $doctor->id, 'appointment_date' => $data['appointment_date'], 'appointment_time' => '09:00:00', 'status' => 'confirmed']);
        $data['appointment_time'] = '09:30';
        $this->putJson('/api/patient/appointments/'.$appointment->id, $data)->assertOk()->assertJsonPath('data.status', 'pending');
        $this->assertDatabaseCount('appointments', 1);
        $this->assertDatabaseHas('appointments', ['id' => $appointment->id, 'appointment_time' => '09:30:00']);
        $other = Appointment::factory()->create(['doctor_id' => $doctor->id, 'appointment_date' => $data['appointment_date'], 'appointment_time' => '09:00:00']);
        $this->putJson('/api/patient/appointments/'.$other->id, $data)->assertForbidden();
        $this->getJson('/api/patient/doctors/'.$doctor->id.'/slots?date='.$data['appointment_date'].'&appointment_id='.$other->id)->assertForbidden();
    }

    public function test_cancel_releases_slot_and_past_or_completed_appointments_cannot_be_changed(): void
    {
        $patient = $this->patient();
        $doctor = $this->doctor();
        $data = $this->booking($doctor);
        $id = $this->postJson('/api/patient/appointments', $data)->assertCreated()->json('data.id');
        $this->postJson('/api/patient/appointments/'.$id.'/cancel', ['cancellation_reason' => 'Patient request'])->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->getJson('/api/patient/doctors/'.$doctor->id.'/slots?date='.$data['appointment_date'])->assertOk()->assertJsonCount(2, 'data');
        $this->postJson('/api/patient/appointments/'.$id.'/cancel', ['cancellation_reason' => 'Again'])->assertConflict();
        $past = Appointment::factory()->create(['patient_id' => $patient->id, 'appointment_date' => now()->subDay()->toDateString()]);
        $this->postJson('/api/patient/appointments/'.$past->id.'/cancel', ['cancellation_reason' => 'Too late'])->assertConflict();
        $this->putJson('/api/patient/appointments/'.$past->id, $data)->assertConflict();
    }

    public function test_medical_records_and_prescriptions_are_scoped_to_own_patient(): void
    {
        $patient = $this->patient();
        $consultation = $this->consultation($patient);
        $prescription = $this->prescription($consultation);
        $foreign = $this->consultation(Patient::factory()->create());
        $foreignPrescription = $this->prescription($foreign);
        $this->getJson('/api/patient/consultations')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/patient/consultations/'.$foreign->id)->assertForbidden();
        $this->getJson('/api/patient/prescriptions/'.$foreignPrescription->id)->assertForbidden();
        $this->getJson('/api/patient/prescriptions/'.$prescription->id)->assertOk()->assertJsonPath('data.items.0.medicine_name', 'Prescription medicine')->assertJsonMissingPath('data.doctor.user');
        $pdf = $this->get('/api/patient/prescriptions/'.$prescription->id.'/download')->assertOk();
        $this->assertStringStartsWith('%PDF-1.4', $pdf->getContent());
        $this->getJson('/api/patient/prescriptions/'.$foreignPrescription->id.'/download')->assertForbidden();
    }

    public function test_lab_results_and_private_documents_are_only_released_when_completed(): void
    {
        $patient = $this->patient();
        $consultation = $this->consultation($patient);
        $test = $this->lab($consultation, 'processing');
        Storage::fake('local');
        Storage::disk('local')->put('lab/private.pdf', 'private report');
        $report = LabReport::create(['lab_test_id' => $test->id, 'uploaded_by' => User::factory()->create(['role' => 'lab_tech'])->id, 'file_path' => 'lab/private.pdf', 'file_type' => 'pdf', 'file_size' => 14, 'upload_date' => now(), 'report_status' => 'preliminary']);
        $this->getJson('/api/patient/lab-tests/'.$test->id)->assertOk()->assertJsonPath('data.result_summary', null)->assertJsonCount(0, 'data.reports');
        $this->getJson('/api/patient/lab-reports/'.$report->id.'/download')->assertConflict();
        $test->update(['status' => 'completed']);
        $report->update(['report_status' => 'completed']);
        $this->getJson('/api/patient/lab-tests/'.$test->id)->assertOk()->assertJsonPath('data.result_summary', 'Recorded laboratory findings')->assertJsonMissingPath('data.reports.0.file_path');
        $this->get('/api/patient/lab-reports/'.$report->id.'/download')->assertOk();
        $other = $this->patient();
        $this->getJson('/api/patient/lab-reports/'.$report->id.'/download')->assertForbidden();
    }

    public function test_invoices_and_payment_history_are_read_only_and_patient_scoped(): void
    {
        $patient = $this->patient();
        $invoice = $this->invoice($patient);
        $otherInvoice = $this->invoice(Patient::factory()->create());
        $this->getJson('/api/patient/invoices')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonCount(1, 'data.0.items')->assertJsonMissingPath('data.0.payments.0.received_by');
        $this->getJson('/api/patient/invoices/'.$otherInvoice->id)->assertForbidden();
        $this->getJson('/api/patient/payments')->assertOk()->assertJsonPath('meta.total', 1);
        $otherPayment = Payment::where('invoice_id', $otherInvoice->id)->first();
        $this->getJson('/api/patient/payments/'.$otherPayment->id)->assertForbidden();
        $this->get('/api/patient/invoices/'.$invoice->id.'/download')->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->postJson('/api/patient/invoices/'.$invoice->id.'/payments', ['amount' => 75.25])->assertNotFound();
        $this->putJson('/api/patient/invoices/'.$invoice->id, ['status' => 'paid'])->assertStatus(405);
    }

    public function test_profile_updates_cannot_change_identity_or_clinical_history(): void
    {
        $patient = $this->patient();
        $data = $patient->only(['date_of_birth', 'gender', 'blood_group', 'address', 'emergency_contact_name', 'emergency_contact_phone']);
        $data['address'] = 'Updated address';
        $this->putJson('/api/patient/profile', $data)->assertOk()->assertJsonPath('data.address', 'Updated address');
        $this->putJson('/api/patient/profile', $data + ['user_id' => User::factory()->create()->id])->assertUnprocessable();
        $this->putJson('/api/patient/profile', $data + ['medical_histories' => [['condition' => 'Forged clinical record']]])->assertUnprocessable();
        $this->putJson('/api/patient/profile', array_replace($data, ['date_of_birth' => now()->addDay()->toDateString()]))->assertUnprocessable();
        $this->assertSame($patient->user_id, $patient->fresh()->user_id);
    }

    public function test_history_and_dashboard_use_own_database_records_without_placeholder_counts(): void
    {
        $patient = $this->patient();
        $this->getJson('/api/patient/dashboard')->assertOk()->assertJsonPath('data.upcoming_appointments', 0)->assertJsonPath('data.active_prescriptions', 0);
        $doctor = $this->doctor();
        $this->postJson('/api/patient/appointments', $this->booking($doctor))->assertCreated();
        $this->invoice($patient);
        DB::table('patient_allergies')->insert(['patient_id' => $patient->id, 'allergy_name' => 'Recorded allergen', 'severity' => 'mild', 'recorded_date' => today()]);
        DB::table('patient_allergies')->insert(['patient_id' => Patient::factory()->create()->id, 'allergy_name' => 'Private allergy', 'severity' => 'severe', 'recorded_date' => today()]);
        $this->getJson('/api/patient/history')->assertOk()->assertJsonCount(1, 'data.allergies')->assertJsonPath('data.allergies.0.allergy_name', 'Recorded allergen');
        $this->getJson('/api/patient/dashboard')->assertOk()->assertJsonPath('data.upcoming_appointments', 1)->assertJsonPath('data.outstanding_balance', 75.25);
    }

    public function test_permissions_and_account_status_are_enforced_on_server(): void
    {
        $patient = $this->patient(['user_id' => User::factory()->create(['role' => 'patient', 'permissions' => ['view_prescriptions']])->id]);
        $doctor = $this->doctor();
        $this->getJson('/api/patient/prescriptions')->assertOk();
        $this->getJson('/api/patient/invoices')->assertForbidden();
        $this->getJson('/api/patient/history')->assertForbidden();
        $this->postJson('/api/patient/appointments', $this->booking($doctor))->assertForbidden();
        $this->getJson('/api/patient/dashboard')->assertOk()->assertJsonPath('data.outstanding_balance', null);
        $patient->user->update(['account_status' => 'inactive']);
        Sanctum::actingAs($patient->user->fresh());
        $this->getJson('/api/patient/dashboard')->assertUnauthorized();
    }

    public function test_other_role_endpoints_cannot_be_used_by_a_patient(): void
    {
        $this->patient();
        $this->getJson('/api/admin/users')->assertForbidden();
        $this->getJson('/api/doctor/patients')->assertForbidden();
        $this->postJson('/api/patient/consultations', ['diagnosis' => 'Forged'])->assertStatus(405);
        $this->getJson('/api/patient/appointments?patient_id=999')->assertUnprocessable();
    }

    public function test_patient_booking_is_confirmed_and_completed_in_the_doctor_portal(): void
    {
        $patient = $this->patient();
        $doctor = $this->doctor();
        $id = $this->postJson('/api/patient/appointments', $this->booking($doctor))->assertCreated()->json('data.id');
        Sanctum::actingAs($doctor->user);
        $this->postJson('/api/doctor/appointments/'.$id.'/status', ['status' => 'confirmed'])->assertOk();
        $this->travelTo(now()->addDay()->setTime(9, 0));
        $consultation = $this->postJson('/api/doctor/consultations', ['appointment_id' => $id, 'diagnosis' => 'Recorded finding', 'consultation_notes' => 'Recorded notes'])->assertCreated()->json('data.id');
        Sanctum::actingAs($patient->user);
        $this->getJson('/api/patient/consultations/'.$consultation)->assertOk()->assertJsonPath('data.diagnosis', 'Recorded finding');
        $this->getJson('/api/patient/invoices')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/patient/appointments/'.$id)->assertOk()->assertJsonPath('data.status', 'completed')->assertJsonPath('data.can_manage', false);
    }

    public function test_patient_cannot_book_two_doctors_in_the_same_slot(): void
    {
        $this->patient();
        $first = $this->doctor();
        $second = $this->doctor();
        $this->postJson('/api/patient/appointments', $this->booking($first))->assertCreated();
        $this->postJson('/api/patient/appointments', $this->booking($second))->assertConflict();
        $this->assertDatabaseCount('appointments', 1);
    }

    public function test_slots_and_dashboard_exclude_past_times_today(): void
    {
        $this->travelTo(now()->setTime(10, 0));
        $patient = $this->patient();
        $doctor = Doctor::factory()->create();
        DoctorSchedule::create(['doctor_id' => $doctor->id, 'day_of_week' => today()->format('l'), 'start_time' => '09:00:00', 'end_time' => '11:00:00', 'slot_duration' => 30, 'is_available' => true]);
        $this->getJson('/api/patient/doctors/'.$doctor->id.'/slots?date='.today()->toDateString())->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.time', '10:30');
        Appointment::factory()->create(['doctor_id' => $doctor->id, 'patient_id' => $patient->id, 'appointment_date' => today(), 'appointment_time' => '09:00:00', 'status' => 'pending']);
        $this->getJson('/api/patient/dashboard')->assertOk()->assertJsonPath('data.upcoming_appointments', 0)->assertJsonCount(0, 'data.next_appointments');
    }

    public function test_rescheduling_to_another_doctor_notifies_both_providers(): void
    {
        $this->patient();
        $first = $this->doctor();
        $second = $this->doctor();
        $id = $this->postJson('/api/patient/appointments', $this->booking($first))->assertCreated()->json('data.id');
        DB::table('notifications')->delete();
        $this->putJson('/api/patient/appointments/'.$id,$this->booking($second))->assertOk()->assertJsonPath('data.doctor.id',$second->id);
        $this->assertDatabaseHas('notifications',['user_id' => $first->user_id, 'title' => 'Appointment reassigned']);
        $this->assertDatabaseHas('notifications',['user_id' => $second->user_id, 'title' => 'Appointment assigned']);
    }
}
