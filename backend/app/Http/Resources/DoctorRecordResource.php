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
