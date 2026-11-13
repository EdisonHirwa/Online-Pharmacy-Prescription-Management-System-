<?php

namespace App\Events;

use App\Models\User;
use Illuminate\Foundation\Events\Dispatchable;

class HospitalActivity
{
    use Dispatchable;

    public function __construct(public User $recipient, public string $title, public string $message, public string $type) {}
}
