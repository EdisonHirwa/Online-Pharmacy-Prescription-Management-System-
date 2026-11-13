<?php

namespace App\Http\Requests;

use App\Services\AuditService;
use App\Services\PharmacyAccess;
use Illuminate\Foundation\Http\FormRequest;

class PharmacyDispenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return PharmacyAccess::canManage($this->user());
    }

    protected function failedAuthorization(): void
    {
        AuditService::record('unauthorized_access', 'pharmacy', null, 'Pharmacy management permission denied.');
        parent::failedAuthorization();
    }

    public function rules(): array
    {
        return ['request_key' => 'required|uuid', 'version' => 'required|string|size:64', 'items' => 'required|array|min:1|max:100', 'items.*' => 'array:prescription_item_id,quantity', 'items.*.prescription_item_id' => 'required|integer|distinct', 'items.*.quantity' => 'required|integer|min:1|max:1000000', 'notes' => 'nullable|string|max:5000', 'allergies_reviewed' => 'required|accepted', 'pharmacist_id' => 'prohibited', 'status' => 'prohibited', 'unit_price' => 'prohibited'];
    }
}
