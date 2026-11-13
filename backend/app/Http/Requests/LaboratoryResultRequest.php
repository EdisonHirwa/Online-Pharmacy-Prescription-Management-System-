<?php

namespace App\Http\Requests;

use App\Services\LaboratoryAccess;
use Illuminate\Foundation\Http\FormRequest;

class LaboratoryResultRequest extends FormRequest
{
    public function authorize(): bool
    {
        return LaboratoryAccess::canManage($this->user());
    }

    public function rules(): array
    {
        return ['result_summary' => 'required|string|max:10000', 'status' => 'prohibited', 'assigned_technician_id' => 'prohibited', 'doctor_id' => 'prohibited', 'patient_id' => 'prohibited', 'test_type_id' => 'prohibited'];
    }
}
