<?php

namespace App\Http\Requests;

use App\Services\PatientAccess;
use Illuminate\Foundation\Http\FormRequest;

class PatientAppointmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return PatientAccess::can($this->user(), 'book_appointments');
    }

    public function rules(): array
    {
        return ['doctor_id' => 'required|integer|exists:doctors,id,deleted_at,NULL', 'appointment_date' => 'required|date_format:Y-m-d|after_or_equal:today', 'appointment_time' => 'required|date_format:H:i', 'reason' => 'required|string|min:3|max:5000', 'patient_id' => 'prohibited', 'status' => 'prohibited', 'appointment_number' => 'prohibited', 'cancelled_by' => 'prohibited'];
    }
}
