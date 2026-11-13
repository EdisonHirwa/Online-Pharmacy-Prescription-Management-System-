<?php

namespace App\Services;

use App\Models\Patient;
use App\Models\User;

class PatientAccess
{
    public static function profile(User $user): Patient
    {
        return Patient::where('user_id', $user->id)->firstOrFail();
    }

    public static function can(User $user, string $permission): bool
    {
        return $user->role === 'patient' && $user->account_status === 'active' && (empty($user->permissions) || in_array($permission, $user->permissions, true));
    }

    public static function requirePermission(string $permission): void
    {
        if (! self::can(auth()->user(), $permission)) {
            AuditService::record('unauthorized_access', 'patient', null, 'Patient permission denied.');
            abort(403, 'Your account does not have permission for this action.');
        }
    }
}
