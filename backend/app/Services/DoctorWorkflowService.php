<?php

namespace App\Services;

use App\Events\HospitalActivity;
use App\Models\Appointment;
use App\Models\Consultation;
use App\Models\Dispensation;
use App\Models\Doctor;
use App\Models\DoctorSchedule;
use App\Models\LabTest;
use App\Models\LabTestType;
use App\Models\Medicine;
use App\Models\Prescription;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class DoctorWorkflowService
{
    public function __construct(private ClinicalBillingService $billing) {}

    private function clinician(): Doctor
    {
        return DoctorAccess::requirePermission(auth()->user(), 'manage_consultations', true);
    }

    public function schedule(array $data, ?int $id = null, bool $delete = false): ?DoctorSchedule
    {
        $doctor = DoctorAccess::requirePermission(auth()->user(), 'manage_schedules');

        return DB::transaction(function () use ($doctor, $data, $id, $delete): ?DoctorSchedule {
            Doctor::whereKey($doctor->id)->lockForUpdate()->firstOrFail();
            $record = $id ? DoctorSchedule::lockForUpdate()->findOrFail($id) : new DoctorSchedule;
            if ($id) {
                Gate::authorize('view', $record);
                $upcoming = Appointment::where('doctor_id', $doctor->id)->whereIn('status', ['pending', 'confirmed'])->whereDate('appointment_date', '>=', today())->get();
                if ($upcoming->contains(fn ($a) => Carbon::parse($a->appointment_date)->format('l') === $record->day_of_week)) {
                    abort(409, 'Resolve upcoming appointments on this consultation day before changing its schedule.');
                }
            }
            if ($delete) {
                $record->delete();
                AuditService::record('schedule_deleted', 'doctor_schedules', $id);

                return null;
            }
            if ($data['is_available']) {
                $overlap = DoctorSchedule::where('doctor_id', $doctor->id)->where('day_of_week', $data['day_of_week'])->where('is_available', true)->whereTime('start_time', '<', $data['end_time'].':00')->whereTime('end_time', '>', $data['start_time'].':00')->when($id, fn ($q) => $q->where('id', '!=', $id))->exists();
                if ($overlap) {
                    throw ValidationException::withMessages(['start_time' => 'This schedule overlaps an available consultation period.']);
                }
            }
            $data['start_time'] .= ':00';
            $data['end_time'] .= ':00';
            $record->fill($data + ['doctor_id' => $doctor->id])->save();
            AuditService::record($id ? 'schedule_updated' : 'schedule_created', 'doctor_schedules', $record->id);

            return $record;
        }, 3);
    }

    public function consultation(array $data): Consultation
    {
        $doctor = $this->clinician();

        return DB::transaction(function () use ($doctor, $data): Consultation {
            Doctor::whereKey($doctor->id)->lockForUpdate()->firstOrFail();
            $appointment = Appointment::lockForUpdate()->findOrFail($data['appointment_id']);
            Gate::authorize('view', $appointment);
            if ($appointment->status !== 'confirmed' || Carbon::parse($appointment->appointment_date)->startOfDay()->isAfter(today())) {
                abort(409, 'Only confirmed appointments dated today or earlier can be completed.');
            }
            if (Consultation::where('appointment_id', $appointment->id)->exists()) {
                abort(409, 'A consultation already exists for this appointment.');
            }
            $consultation = Consultation::create($data + ['doctor_id' => $doctor->id, 'patient_id' => $appointment->patient_id]);
            $appointment->update(['status' => 'completed']);
            $this->billing->charge($consultation, 'consultation', $consultation->id, 'Doctor consultation', (string) $doctor->consultation_fee);
            AuditService::record('consultation_completed', 'consultations', $consultation->id);
            HospitalActivity::dispatch($appointment->patient->user, 'Consultation completed', 'Your consultation record is available.', 'consultation');

            return $consultation;
        }, 3);
    }

    public function prescription(array $data, ?int $id = null): Prescription
    {
        $doctor = $this->clinician();

        return DB::transaction(function () use ($doctor, $data, $id): Prescription {
            Doctor::whereKey($doctor->id)->lockForUpdate()->firstOrFail();
            $prescription = $id ? Prescription::lockForUpdate()->findOrFail($id) : null;
            if ($prescription) {
                Gate::authorize('view', $prescription);
                $this->ensureUndispensed($prescription);
            }
            $consultation = Consultation::lockForUpdate()->findOrFail($prescription?->consultation_id ?? $data['consultation_id']);
            Gate::authorize('view', $consultation);
            $items = $data['items'];
            unset($data['items']);
            $medicines = Medicine::whereIn('id', array_column($items, 'medicine_id'))->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            foreach ($items as $i => $item) {
                $medicine = $medicines->get($item['medicine_id']);
                if (! $medicine || $medicine->status !== 'active' || Carbon::parse($medicine->expiry_date)->isBefore(today())) {
                    throw ValidationException::withMessages(['items.'.$i.'.medicine_id' => 'Select an active, unexpired medicine.']);
                }
                $items[$i]['unit_price'] = $medicine->unit_price;
            }
            if ($prescription) {
                $prescription->update(['prescription_instructions' => $data['prescription_instructions'] ?? null]);
                $prescription->items()->delete();
            } else {
                $prescription = Prescription::create(['consultation_id' => $consultation->id, 'doctor_id' => $doctor->id, 'patient_id' => $consultation->patient_id, 'prescription_instructions' => $data['prescription_instructions'] ?? null, 'issue_date' => now(), 'status' => 'pending']);
            }
            $prescription->items()->createMany($items);
            AuditService::record($id ? 'prescription_updated' : 'prescription_issued', 'prescriptions', $prescription->id);
            HospitalActivity::dispatch($consultation->patient->user, 'Prescription available', 'Your prescription has been sent to pharmacy.', 'prescription');
            $this->notifyRole('pharmacist', 'Prescription awaiting dispensing', 'A prescription is ready for pharmacy review.', 'prescription');

            return $prescription->load('items.medicine', 'patient.user', 'consultation');
        }, 3);
    }

    private function ensureUndispensed(Prescription $prescription): void
    {
        if ($prescription->status !== 'pending' || Dispensation::where('prescription_id', $prescription->id)->exists()) {
            abort(409, 'Only prescriptions without any dispensing activity can be changed or cancelled.');
        }
    }

    public function cancelPrescription(int $id): Prescription
    {
        $this->clinician();

        return DB::transaction(function () use ($id): Prescription {
            $record = Prescription::lockForUpdate()->findOrFail($id);
            Gate::authorize('view', $record);
            $this->ensureUndispensed($record);
            $record->update(['status' => 'cancelled']);
            AuditService::record('prescription_cancelled', 'prescriptions', $id);
            HospitalActivity::dispatch($record->patient->user, 'Prescription cancelled', 'A prescription has been cancelled by your doctor.', 'prescription');
            $this->notifyRole('pharmacist', 'Prescription cancelled', 'A queued prescription has been cancelled.', 'prescription');

            return $record;
        }, 3);
    }

    public function laboratory(array $data): array
    {
        $doctor = $this->clinician();

        return DB::transaction(function () use ($doctor, $data): array {
            $consultation = Consultation::lockForUpdate()->findOrFail($data['consultation_id']);
            Gate::authorize('view', $consultation);
            $records = [];
            foreach ($data['test_type_ids'] as $typeId) {
                $type = LabTestType::findOrFail($typeId);
                if ($type->status !== 'active') {
                    throw ValidationException::withMessages(['test_type_ids' => 'One of the selected laboratory tests is inactive.']);
                }
                if (LabTest::where('consultation_id', $consultation->id)->where('test_type_id', $typeId)->whereIn('status', ['requested', 'assigned', 'processing'])->exists()) {
                    abort(409, 'An active request for this test already exists for the consultation.');
                }
                $test = LabTest::create(['consultation_id' => $consultation->id, 'doctor_id' => $doctor->id, 'patient_id' => $consultation->patient_id, 'test_type_id' => $typeId, 'request_date' => now(), 'status' => 'requested']);
                $this->billing->charge($consultation, 'lab_test', $test->id, $type->name, (string) $type->price);
                AuditService::record('lab_investigation_requested', 'lab_tests', $test->id);
                $records[] = $test;
            }
            $this->notifyRole('lab_tech', 'Laboratory investigation requested', 'New investigations are ready for laboratory processing.', 'laboratory');
            HospitalActivity::dispatch($consultation->patient->user, 'Laboratory investigation requested', 'Your doctor has requested laboratory investigations.', 'laboratory');

            return $records;
        }, 3);
    }

    public function cancelLab(int $id): LabTest
    {
        $this->clinician();

        return DB::transaction(function () use ($id): LabTest {
            $test = LabTest::lockForUpdate()->findOrFail($id);
            Gate::authorize('view', $test);
            if ($test->status !== 'requested') {
                abort(409, 'Only laboratory requests not yet assigned or processed can be cancelled.');
            }
            $this->billing->cancelLabCharge($test);
            $test->update(['status' => 'cancelled']);
            AuditService::record('lab_request_cancelled', 'lab_tests', $id);
            $this->notifyRole('lab_tech', 'Laboratory request cancelled', 'A pending investigation was cancelled by its requesting doctor.', 'laboratory');
            HospitalActivity::dispatch($test->patient->user, 'Laboratory request cancelled', 'A pending laboratory investigation has been cancelled.', 'laboratory');

            return $test;
        }, 3);
    }

    private function notifyRole(string $role, string $title, string $message, string $type): void
    {
        User::where('role', $role)->where('account_status', 'active')->each(fn (User $user) => HospitalActivity::dispatch($user, $title, $message, $type));
    }
}
