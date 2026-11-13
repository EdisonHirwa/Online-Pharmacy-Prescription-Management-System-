<?php

namespace App\Http\Resources;

use App\Services\LaboratoryAccess;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LaboratoryTestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $owner = (int) $this->assigned_technician_id === $request->user()->id;
        $manage = $owner && LaboratoryAccess::canManage($request->user());

        return ['id' => $this->id, 'status' => $this->status, 'request_date' => $this->request_date, 'completed_at' => $this->status === 'completed' ? $this->updated_at?->toIso8601String() : null,
            'patient' => ['id' => $this->patient_id, 'name' => $this->patient?->user?->name, 'patient_number' => $this->patient?->patient_number, 'date_of_birth' => $this->patient?->date_of_birth, 'gender' => $this->patient?->gender],
            'doctor' => ['name' => $this->doctor?->user?->name, 'department' => $this->doctor?->department?->name],
            'test_type' => $this->test_type?->only(['id', 'name', 'description', 'expected_turnaround_time']),
            'assigned_to_me' => $owner, 'clinical_context' => $owner ? $this->consultation?->diagnosis : null, 'result_summary' => $owner ? $this->result_summary : null,
            'reports' => $owner ? LaboratoryReportResource::collection($this->reports) : [],
            'actions' => ['claim' => LaboratoryAccess::canManage($request->user()) && $this->status === 'requested' && $this->assigned_technician_id === null, 'start' => $manage && $this->status === 'assigned', 'release' => $manage && $this->status === 'assigned', 'edit' => $manage && $this->status === 'processing', 'complete' => $manage && $this->status === 'processing'],
        ];
    }
}
