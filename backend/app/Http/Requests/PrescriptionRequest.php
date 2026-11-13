<?php

namespace App\Http\Requests;

use App\Services\DoctorAccess;
use Illuminate\Foundation\Http\FormRequest;

class PrescriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return DoctorAccess::can($this->user(), 'manage_consultations');
    }

    public function rules(): array
    {
        return ['consultation_id' => $this->isMethod('post') ? 'required|integer|exists:consultations,id,deleted_at,NULL' : 'prohibited', 'prescription_instructions' => 'nullable|string|max:5000', 'items' => 'required|array|min:1|max:50', 'items.*' => ['array:medicine_id,dosage,frequency,duration,quantity'], 'items.*.medicine_id' => 'required|integer|distinct|exists:medicines,id,deleted_at,NULL', 'items.*.dosage' => 'required|string|max:100', 'items.*.frequency' => 'required|string|max:100', 'items.*.duration' => 'required|string|max:100', 'items.*.quantity' => 'required|integer|between:1,100000', 'items.*.unit_price' => 'prohibited', 'patient_id' => 'prohibited', 'doctor_id' => 'prohibited', 'status' => 'prohibited'];
    }
}
