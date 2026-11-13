<?php

namespace App\Services;

use App\Models\User;

class PharmacyAccess
{
    public static function canManage(User $user): bool
    {
        return $user->role === 'pharmacist' && $user->account_status === 'active' && (empty($user->permissions) || in_array('manage_pharmacy', $user->permissions, true));
    }

    public static function requireManagement(): void
    {
        if (! self::canManage(auth()->user())) {
            AuditService::record('unauthorized_access', 'pharmacy', null, 'Pharmacy management permission denied.');
            abort(403, 'Your account does not have permission to manage pharmacy.');
        }
    }
}
