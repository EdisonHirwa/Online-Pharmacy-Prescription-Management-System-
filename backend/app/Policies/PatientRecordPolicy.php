<?php

namespace App\Policies;

use App\Models\LabReport;
use App\Models\Patient;
use App\Models\Payment;
use App\Models\User;
use App\Services\AuditService;
use App\Services\PatientAccess;
use Illuminate\Database\Eloquent\Model;

class PatientRecordPolicy
{
    public function view(User $user, Model $record): bool
    {
        $patientId = $user->role === 'patient' ? PatientAccess::profile($user)->id : null;
        $ownerId = match (true) {
            $record instanceof Patient => $record->id,$record instanceof Payment => $record->invoice?->patient_id,$record instanceof LabReport => $record->labTest?->patient_id,default => $record->patient_id
        };
        $allowed = $patientId !== null && (int) $ownerId === $patientId;
        if (! $allowed) {
            AuditService::record('unauthorized_access', $record->getTable(), $record->id, 'Attempt to access another patient’s record.');
        }

        return $allowed;
    }
}
