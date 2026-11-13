<?php

namespace App\Http\Requests;

use App\Services\DoctorAccess;
use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class DoctorScheduleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return DoctorAccess::can($this->user(), 'manage_schedules');
    }

    public function rules(): array
    {
        return ['day_of_week' => 'required|in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday', 'start_time' => 'required|date_format:H:i', 'end_time' => 'required|date_format:H:i|after:start_time', 'slot_duration' => 'required|integer|between:5,240', 'is_available' => 'required|boolean', 'doctor_id' => 'prohibited'];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            $start = Carbon::createFromFormat('!H:i', $this->input('start_time'));
            $end = Carbon::createFromFormat('!H:i', $this->input('end_time'));
            if ($start->diffInMinutes($end) < $this->integer('slot_duration')) {
                $validator->errors()->add('slot_duration', 'The appointment duration cannot exceed the consultation period.');
            }
        }];
    }
}
