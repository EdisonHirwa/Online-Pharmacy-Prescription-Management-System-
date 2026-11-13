<?php

namespace App\Policies;

use App\Models\LabReport;
use App\Models\LabTest;
use App\Models\User;
use App\Services\AuditService;

class LaboratoryPolicy
{
    public function view(User $user, LabTest|LabReport $record): bool
    {
        $test = $record instanceof LabReport ? $record->labTest : $record;
        $allowed = $user->role === 'lab_tech' && $user->account_status === 'active' && $test && ((int) $test->assigned_technician_id === $user->id || ($record instanceof LabTest && $test->status === 'requested' && $test->assigned_technician_id === null));
        if (! $allowed) {
            AuditService::record('unauthorized_access', $record->getTable(), $record->id, 'Attempt to access an investigation assigned to another laboratory technician.');
        }

        return (bool) $allowed;
    }
}
