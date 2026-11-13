<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdminRecordResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $data = parent::toArray($request);
        unset($data['password'],$data['remember_token'],$data['file_path']);

        return $data;
    }
}
