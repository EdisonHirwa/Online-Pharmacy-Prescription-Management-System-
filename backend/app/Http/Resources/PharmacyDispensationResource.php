<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PharmacyDispensationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'prescription_id' => $this->prescription_id, 'patient_name' => $this->prescription?->patient?->user?->name, 'patient_number' => $this->prescription?->patient?->patient_number, 'pharmacist_name' => $this->pharmacist?->name, 'dispensing_date' => $this->dispensing_date, 'dispensing_status' => $this->dispensing_status, 'notes' => $this->notes, 'items' => $this->items->map(fn ($item) => ['id' => $item->id, 'prescription_item_id' => $item->prescription_item_id, 'medicine_name' => $item->prescriptionItem?->medicine?->name, 'quantity_dispensed' => $item->quantity_dispensed, 'unit_price' => $item->unit_price, 'subtotal' => number_format($item->quantity_dispensed * (float) $item->unit_price, 2, '.', '')]), 'total' => number_format($this->items->sum(fn ($item) => $item->quantity_dispensed * (float) $item->unit_price), 2, '.', '')];
    }
}
