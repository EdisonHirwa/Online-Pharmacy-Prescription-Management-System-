<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LaboratoryReportResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $mime = $this->file_type;
        $extension = match ($mime) {
            'application/pdf','pdf' => 'pdf','image/png','png' => 'png',default => 'jpg'
        };

        return ['id' => $this->id, 'name' => 'Report-'.$this->id.'.'.$extension, 'file_type' => $mime, 'file_size' => $this->file_size, 'upload_date' => $this->upload_date, 'report_status' => $this->report_status];
    }
}
