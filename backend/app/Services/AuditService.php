<?php

namespace App\Services;

use App\Models\AuditLog;

class AuditService
{
    public static function record(string $action, string $table, ?int $id = null, ?string $details = null, ?int $actorId = null): void
    {
        AuditLog::create(['user_id' => $actorId ?? auth()->id(), 'action' => $action, 'affected_table' => $table, 'affected_record_id' => $id, 'activity_details' => $details ?? $action.' '.$table, 'ip_address' => request()->ip()]);
    }
}
