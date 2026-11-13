<?php

namespace App\Policies;

use App\Models\User;

class PharmacyPolicy
{
    public function view(User $user): bool
    {
        return $user->role === 'pharmacist' && $user->account_status === 'active';
    }
}
