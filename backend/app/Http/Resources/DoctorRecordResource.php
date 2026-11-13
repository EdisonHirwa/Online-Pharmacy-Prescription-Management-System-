<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DoctorRecordResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return $this->sanitize(parent::toArray($request));
    }

    private function sanitize(array $data): array
    {
        if (isset($data['test_type_id'], $data['request_date'])) {
            if (($data['status'] ?? null) !== 'completed') {
                $data['result_summary'] = null;
                $data['reports'] = [];
            } elseif (isset($data['reports'])) {
                $data['reports'] = array_values(array_filter($data['reports'], fn ($report) => ($report['report_status'] ?? null) === 'completed'));
            }
        }
        foreach ($data as $key => $value) {
            if (in_array($key, ['password', 'remember_token', 'permissions', 'file_path', 'deleted_at', 'email_verified_at'], true)) {
                unset($data[$key]);

                continue;
            }
            if (is_array($value)) {
                $data[$key] = $this->sanitize($value);
            }
        }

        return $data;
    }
}
