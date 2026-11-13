<?php

namespace App\Http\Requests;

use App\Services\AuditService;
use App\Services\PharmacyAccess;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PharmacyMedicineRequest extends FormRequest
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
        return ['medicine_code' => ['required', 'string', 'max:100', Rule::unique('medicines', 'medicine_code')->ignore($this->route('id'))], 'name' => 'required|string|max:255', 'category' => 'required|string|max:100', 'description' => 'nullable|string|max:5000', 'unit' => 'required|string|max:50', 'unit_price' => 'required|numeric|min:0|max:99999999.99|decimal:0,2', 'reorder_level' => 'required|integer|min:0|max:1000000000', 'expiry_date' => 'required|date_format:Y-m-d', 'status' => 'required|in:active,inactive', 'available_stock' => 'prohibited'];
    }
}
