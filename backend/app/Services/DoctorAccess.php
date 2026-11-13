<?php

namespace App\Services;

use App\Models\Doctor;
use App\Models\User;

class DoctorAccess
{
    public static function profile(User $user): Doctor
    {
        return Doctor::where('user_id', $user->id)->firstOrFail();
    }

    public static function can(User $user, string $permission): bool
    {
        return $user->role === 'doctor' && $user->account_status === 'active' && (empty($user->permissions) || in_array($permission, $user->permissions, true));
    }

    public static function requirePermission(User $user, string $permission, bool $clinical = false): Doctor
    {
        if (! self::can($user, $permission)) {
            AuditService::record('unauthorized_access', 'doctor', null, 'Doctor permission denied.');
            abort(403, 'Your account does not have permission for this action.');
        }
        $doctor = self::profile($user);
        if ($clinical && $doctor->professional_status !== 'active') {
            abort(403, 'Your professional status must be active to perform clinical actions.');
        }

        return $doctor;
    }
}
