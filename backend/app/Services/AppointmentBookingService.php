<?php

namespace App\Services;

use App\Events\HospitalActivity;
use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\DoctorSchedule;
use App\Models\Patient;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AppointmentBookingService
{
    public function book(array $data, ?int $id = null, ?string $status = null, bool $selfService = false): Appointment
    {
        return DB::transaction(function () use ($data, $id, $status, $selfService): Appointment {
            $doctor = Doctor::lockForUpdate()->findOrFail($data['doctor_id']);
            $record = $id ? Appointment::lockForUpdate()->findOrFail($id) : null;
            if ($record && (! in_array($record->status, ['pending', 'confirmed'], true) || (int) $data['patient_id'] !== $record->patient_id)) {
                abort(409, 'Only upcoming appointments can be rescheduled for the same patient.');
            }
            if ($selfService && $record) {
                Gate::authorize('patient-record', $record);
                PatientWorkflowService::assertUpcoming($record);
            }
            Patient::lockForUpdate()->findOrFail($data['patient_id']);
            if ($doctor->professional_status !== 'active' || $doctor->user->account_status !== 'active' || $doctor->department->status !== 'active' || $doctor->specialization->status !== 'active') {
                abort(409, 'This doctor is unavailable.');
            }
            $date = Carbon::parse($data['appointment_date'].' '.$data['appointment_time']);
            if ($date->isPast()) {
                throw ValidationException::withMessages(['appointment_time' => 'Choose a future appointment time.']);
            }
            $schedule = DoctorSchedule::where('doctor_id', $doctor->id)->where('day_of_week', $date->format('l'))->where('is_available', true)->whereTime('start_time', '<=', $data['appointment_time'].':00')->whereTime('end_time', '>', $data['appointment_time'].':00')->first();
            if (! $schedule) {
                abort(409, 'The doctor has no available schedule at this time.');
            }
            $start = Carbon::parse($data['appointment_date'].' '.$schedule->start_time);
            $minutes = (int) $start->diffInMinutes($date);
            if ($minutes % $schedule->slot_duration !== 0 || $date->copy()->addMinutes($schedule->slot_duration)->greaterThan(Carbon::parse($data['appointment_date'].' '.$schedule->end_time))) {
                abort(409, 'Choose a valid consultation slot.');
            }
            if (Appointment::when($id, fn ($q) => $q->where('id', '!=', $id))->where('doctor_id', $doctor->id)->whereDate('appointment_date', $data['appointment_date'])->whereTime('appointment_time', $data['appointment_time'].':00')->whereIn('status', ['pending', 'confirmed', 'completed'])->exists()) {
                abort(409, 'This consultation slot is already booked.');
            }
            if (Appointment::when($id, fn ($q) => $q->where('id', '!=', $id))->where('patient_id', $data['patient_id'])->whereDate('appointment_date', $data['appointment_date'])->whereTime('appointment_time', $data['appointment_time'].':00')->whereIn('status', ['pending', 'confirmed'])->exists()) {
                abort(409, 'The patient already has an appointment at this time.');
            }
            if ($status !== null) {
                $data['status'] = $status;
            }
            $previousDoctor = $record && $record->doctor_id !== $doctor->id ? $record->doctor?->user : null;
            $data['appointment_time'] .= ':00';
            $record = $record ? tap($record, fn ($record) => $record->update($data)) : Appointment::create($data + ['appointment_number' => 'APT-'.Str::ulid(), 'status' => $status ?? 'confirmed']);
            AuditService::record($id ? 'appointment_rescheduled' : 'appointment_booked', 'appointments', $record->id);
            HospitalActivity::dispatch($record->patient->user, $record->status === 'pending' ? 'Appointment requested' : 'Appointment confirmed', $record->status === 'pending' ? 'Your appointment request is awaiting confirmation.' : 'Your appointment has been confirmed.', 'appointment');
            HospitalActivity::dispatch($doctor->user, 'Appointment assigned', 'An appointment has been booked or rescheduled in your consultation schedule.', 'appointment');

            if ($previousDoctor) {
                HospitalActivity::dispatch($previousDoctor, 'Appointment reassigned', 'An appointment has been rescheduled to another doctor.', 'appointment');
            }

            return $record;
        }, 3);
    }
}
