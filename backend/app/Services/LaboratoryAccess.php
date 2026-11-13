<?php

namespace App\Services;

use App\Models\User;

class LaboratoryAccess
{
    public static function canManage(User $user): bool
    {
        return $user->role === 'lab_tech' && $user->account_status === 'active' && (empty($user->permissions) || in_array('manage_laboratory', $user->permissions, true));
    }

    public static function requireManagement(): void
    {
        if (! self::canManage(auth()->user())) {
            AuditService::record('unauthorized_access', 'laboratory', null, 'Laboratory management permission denied.');
            abort(403, 'Your account does not have permission to manage laboratory investigations.');
        }
    }
}
