<?php

namespace App\Http\Resources;

use App\Services\PharmacyAccess;
use App\Services\PharmacyWorkflowService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\DB;

class PharmacyPrescriptionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $detail = $this->relationLoaded('items');

        return ['id' => $this->id, 'status' => $this->status, 'issue_date' => $this->issue_date, 'prescription_instructions' => $this->prescription_instructions, 'patient' => ['name' => $this->patient?->user?->name, 'patient_number' => $this->patient?->patient_number, 'date_of_birth' => $this->patient?->date_of_birth, 'gender' => $this->patient?->gender], 'doctor_name' => $this->doctor?->user?->name, 'can_dispense' => PharmacyAccess::canManage($request->user()) && in_array($this->status, ['pending', 'partially_dispensed'], true),
            'version' => $detail ? PharmacyWorkflowService::version($this->resource) : null,
            'allergies' => $detail ? DB::table('patient_allergies')->where('patient_id', $this->patient_id)->get(['allergy_name', 'severity', 'reaction_description']) : [],
            'items' => $detail ? $this->items->map(fn ($item) => ['id' => $item->id, 'medicine_id' => $item->medicine_id, 'medicine_name' => $item->medicine?->name ?? 'Unavailable medicine', 'medicine_code' => $item->medicine?->medicine_code, 'unit' => $item->medicine?->unit, 'dosage' => $item->dosage, 'frequency' => $item->frequency, 'duration' => $item->duration, 'quantity' => $item->quantity, 'unit_price' => $item->unit_price, 'dispensed_quantity' => (int) $item->dispensed_quantity, 'remaining_quantity' => max(0, $item->quantity - (int) $item->dispensed_quantity), 'available_stock' => $item->medicine?->available_stock ?? 0, 'expiry_date' => $item->medicine?->expiry_date, 'available' => $item->medicine && $item->medicine->status === 'active' && $item->medicine->expiry_date >= today()->toDateString()]) : [],
            'dispensations' => $this->whenLoaded('dispensations', fn () => PharmacyDispensationResource::collection($this->dispensations))];
    }
}
