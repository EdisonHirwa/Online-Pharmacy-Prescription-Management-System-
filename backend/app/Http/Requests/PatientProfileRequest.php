<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PatientProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->role === 'patient';
    }

    public function rules(): array
    {
        return ['date_of_birth' => 'required|date_format:Y-m-d|before_or_equal:today', 'gender' => 'required|in:Male,Female,Other', 'blood_group' => 'nullable|in:A+,A-,B+,B-,AB+,AB-,O+,O-', 'address' => 'required|string|max:5000', 'emergency_contact_name' => 'required|string|max:255', 'emergency_contact_phone' => ['required', 'regex:/^\\+?[0-9]{9,15}$/'], 'user_id' => 'prohibited', 'patient_number' => 'prohibited', 'role' => 'prohibited', 'account_status' => 'prohibited', 'allergies' => 'prohibited', 'medical_histories' => 'prohibited'];
    }
}
