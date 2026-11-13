<?php

namespace Database\Factories;

use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\Patient;
use Illuminate\Database\Eloquent\Factories\Factory;

class AppointmentFactory extends Factory
{
    protected $model = Appointment::class;

    public function definition(): array
    {
        return ['doctor_id' => Doctor::factory(), 'patient_id' => Patient::factory(), 'appointment_number' => fake()->unique()->bothify('APT-########'), 'appointment_date' => today()->toDateString(), 'appointment_time' => '09:00:00', 'status' => 'confirmed', 'reason' => 'Consultation'];
    }
}
