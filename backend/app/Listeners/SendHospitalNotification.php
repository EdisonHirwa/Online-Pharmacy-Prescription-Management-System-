<?php

namespace App\Listeners;

use App\Events\HospitalActivity;
use App\Notifications\HospitalUpdate;

class SendHospitalNotification
{
    public function handle(HospitalActivity $event): void
    {
        $event->recipient->notify(new HospitalUpdate($event->title, $event->message, $event->type));
    }
}
