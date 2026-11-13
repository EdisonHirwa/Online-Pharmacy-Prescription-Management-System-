<?php

namespace App\Policies;

use App\Models\Appointment;
use App\Models\Consultation;
use App\Models\Patient;
use App\Models\User;
use App\Services\AuditService;
use App\Services\DoctorAccess;

class PatientPolicy
{
    public function view(User $user, Patient $patient): bool
    {
        $doctor = $user->role === 'doctor' ? DoctorAccess::profile($user) : null;
        $allowed = $doctor && (Appointment::where('doctor_id', $doctor->id)->where('patient_id', $patient->id)->whereIn('status', ['pending', 'confirmed', 'completed'])->exists() || Consultation::where('doctor_id', $doctor->id)->where('patient_id', $patient->id)->exists());
        if (! $allowed) {
            AuditService::record('unauthorized_access', 'patients', $patient->id, 'Attempt to access a patient outside the assigned care relationship.');
        }

        return (bool) $allowed;
    }
}
