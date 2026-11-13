<?php

namespace App\Policies;

use App\Models\User;
use App\Services\AuditService;
use App\Services\DoctorAccess;
use Illuminate\Database\Eloquent\Model;

class DoctorRecordPolicy
{
    public function view(User $user, Model $record): bool
    {
        $allowed = $user->role === 'doctor' && (int) $record->doctor_id === DoctorAccess::profile($user)->id;
        if (! $allowed) {
            AuditService::record('unauthorized_access', $record->getTable(), $record->id, 'Attempt to access another doctor’s record.');
        }

        return $allowed;
    }
}
