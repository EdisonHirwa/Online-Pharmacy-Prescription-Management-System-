<?php

namespace Database\Factories;

use App\Models\Appointment;
use App\Models\Consultation;
use App\Models\LabTest;
use App\Models\LabTestType;
use Illuminate\Database\Eloquent\Factories\Factory;

class LabTestFactory extends Factory
{
    protected $model = LabTest::class;

    public function definition(): array
    {
        return ['consultation_id' => function (): int {
            $appointment = Appointment::factory()->create(['status' => 'completed']);

            return Consultation::create(['appointment_id' => $appointment->id, 'patient_id' => $appointment->patient_id, 'doctor_id' => $appointment->doctor_id, 'diagnosis' => 'Recorded diagnosis', 'consultation_notes' => 'Recorded clinical findings'])->id;
        },
            'patient_id' => fn (array $attributes) => Consultation::findOrFail($attributes['consultation_id'])->patient_id,
            'doctor_id' => fn (array $attributes) => Consultation::findOrFail($attributes['consultation_id'])->doctor_id,
            'test_type_id' => fn () => LabTestType::firstOrCreate(['name' => 'Laboratory Investigation'], ['price' => '1000.00', 'expected_turnaround_time' => '24 hours', 'status' => 'active'])->id,
            'request_date' => now(), 'status' => 'requested'];
    }
}
