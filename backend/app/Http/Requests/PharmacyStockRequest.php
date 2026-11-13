<?php

namespace App\Http\Requests;

use App\Services\AuditService;
use App\Services\PharmacyAccess;
use Illuminate\Foundation\Http\FormRequest;

class PharmacyStockRequest extends FormRequest
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
        return ['quantity' => 'required|integer|not_in:0|between:-1000000,1000000', 'reason' => 'required|string|min:3|max:1000', 'available_stock' => 'prohibited', 'user_id' => 'prohibited', 'movement_type' => 'prohibited'];
    }
}
