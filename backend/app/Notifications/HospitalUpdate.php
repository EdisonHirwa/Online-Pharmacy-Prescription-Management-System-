<?php

namespace App\Notifications;

use App\Notifications\Channels\HospitalDatabaseChannel;
use Illuminate\Notifications\Notification;

class HospitalUpdate extends Notification
{
    public function __construct(public string $title, public string $message, public string $type) {}

    public function via(object $notifiable): array
    {
        return [HospitalDatabaseChannel::class];
    }
}
