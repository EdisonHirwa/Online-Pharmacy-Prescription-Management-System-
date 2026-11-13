<?php

namespace App\Notifications\Channels;

use App\Notifications\HospitalUpdate;
use Illuminate\Support\Facades\DB;

class HospitalDatabaseChannel
{
    public function send(object $notifiable, HospitalUpdate $notification): void
    {
        DB::table('notifications')->insert(['user_id' => $notifiable->id, 'title' => $notification->title, 'message' => $notification->message, 'notification_type' => $notification->type, 'is_read' => false, 'created_at' => now(), 'updated_at' => now()]);
    }
}
