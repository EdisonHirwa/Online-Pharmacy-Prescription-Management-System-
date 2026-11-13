<?php

namespace App\Services;

use App\Events\HospitalActivity;
use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\DoctorSchedule;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class PatientWorkflowService
{
    public function __construct(private AppointmentBookingService $booking) {}

    public static function assertUpcoming(Appointment $appointment): void
    {
        if (! in_array($appointment->status, ['pending', 'confirmed'], true) || Carbon::parse($appointment->appointment_date.' '.$appointment->appointment_time)->lessThanOrEqualTo(now())) {
            abort(409, 'Only pending or confirmed appointments that have not started can be changed.');
        }
    }

    public function book(array $data, ?int $id = null): Appointment
    {
        PatientAccess::requirePermission('book_appointments');
        if ($id) {
            $record = Appointment::findOrFail($id);
            Gate::authorize('patient-record', $record);
            self::assertUpcoming($record);
        }

        return $this->booking->book($data + ['patient_id' => PatientAccess::profile(auth()->user())->id], $id, 'pending', true);
    }

    public function cancel(int $id, string $reason): Appointment
    {
        PatientAccess::requirePermission('book_appointments');

        return DB::transaction(function () use ($id, $reason): Appointment {
            $record = Appointment::lockForUpdate()->findOrFail($id);
            Gate::authorize('patient-record', $record);
            self::assertUpcoming($record);
            $record->update(['status' => 'cancelled', 'cancellation_reason' => $reason, 'cancelled_by' => auth()->id()]);
            AuditService::record('appointment_cancelled', 'appointments', $id);
            HospitalActivity::dispatch($record->patient->user, 'Appointment cancelled', 'Your appointment has been cancelled.', 'appointment');
            if ($record->doctor?->user) {
                HospitalActivity::dispatch($record->doctor->user, 'Appointment cancelled', 'A patient cancelled an assigned appointment.', 'appointment');
            }

            return $record;
        }, 3);
    }

    public function slots(Doctor $doctor, string $date, ?int $exclude = null): array
    {
        $day = Carbon::parse($date);
        $schedules = DoctorSchedule::where('doctor_id', $doctor->id)->where('day_of_week', $day->format('l'))->where('is_available', true)->orderBy('start_time')->get();
        $blocked = Appointment::whereDate('appointment_date', $date)->where('doctor_id', $doctor->id)->whereIn('status', ['pending', 'confirmed', 'completed'])->when($exclude, fn ($q) => $q->where('id', '!=', $exclude))->pluck('appointment_time')->map(fn ($t) => substr($t, 0, 5))->all();
        $patientBlocked = Appointment::whereDate('appointment_date', $date)->where('patient_id', PatientAccess::profile(auth()->user())->id)->whereIn('status', ['pending', 'confirmed'])->when($exclude, fn ($q) => $q->where('id', '!=', $exclude))->pluck('appointment_time')->map(fn ($t) => substr($t, 0, 5))->all();
        $slots = [];
        foreach ($schedules as $schedule) {
            if ($schedule->slot_duration < 5) {
                continue;
            }
            $cursor = Carbon::parse($date.' '.$schedule->start_time);
            $end = Carbon::parse($date.' '.$schedule->end_time);
            while ($cursor->copy()->addMinutes($schedule->slot_duration)->lessThanOrEqualTo($end)) {
                $time = $cursor->format('H:i');
                if ($cursor->isFuture() && ! in_array($time, $blocked, true) && ! in_array($time, $patientBlocked, true)) {
                    $slots[$time] = ['time' => $time, 'duration' => $schedule->slot_duration];
                }
                $cursor->addMinutes($schedule->slot_duration);
            }
        }
        ksort($slots);

        return array_values($slots);
    }
}
