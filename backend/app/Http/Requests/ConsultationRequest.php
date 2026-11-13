<?php

namespace App\Http\Requests;

use App\Services\DoctorAccess;
use Illuminate\Foundation\Http\FormRequest;

class ConsultationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return DoctorAccess::can($this->user(), 'manage_consultations');
    }

    public function rules(): array
    {
        return ['appointment_id' => 'required|integer|exists:appointments,id,deleted_at,NULL', 'diagnosis' => 'required|string|max:5000', 'consultation_notes' => 'required|string|max:10000', 'treatment_recommendations' => 'nullable|string|max:5000', 'follow_up_date' => 'nullable|date_format:Y-m-d|after_or_equal:today', 'doctor_id' => 'prohibited', 'patient_id' => 'prohibited'];
    }
}
