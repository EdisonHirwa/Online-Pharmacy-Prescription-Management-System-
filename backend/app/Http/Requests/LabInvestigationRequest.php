<?php

namespace App\Http\Requests;

use App\Services\DoctorAccess;
use Illuminate\Foundation\Http\FormRequest;

class LabInvestigationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return DoctorAccess::can($this->user(), 'manage_consultations');
    }

    public function rules(): array
    {
        return ['consultation_id' => 'required|integer|exists:consultations,id,deleted_at,NULL', 'test_type_ids' => 'required|array|min:1|max:30', 'test_type_ids.*' => 'required|integer|distinct|exists:lab_test_types,id', 'patient_id' => 'prohibited', 'doctor_id' => 'prohibited', 'result_summary' => 'prohibited', 'status' => 'prohibited'];
    }
}
