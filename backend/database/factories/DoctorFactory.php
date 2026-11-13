<?php

namespace Database\Factories;

use App\Models\Department;
use App\Models\Doctor;
use App\Models\Specialization;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class DoctorFactory extends Factory
{
    protected $model = Doctor::class;

    public function definition(): array
    {
        return ['user_id' => User::factory()->state(['role' => 'doctor']),
            'department_id' => fn () => Department::firstOrCreate(['name' => 'General Medicine'], ['status' => 'active'])->id,
            'specialization_id' => fn (array $attributes) => Specialization::firstOrCreate(['name' => 'General Practice '.$attributes['department_id']], ['department_id' => $attributes['department_id'], 'status' => 'active'])->id,
            'license_number' => fake()->unique()->bothify('DOC-########'), 'consultation_fee' => '5000.00', 'room_number' => '101', 'professional_status' => 'active'];
    }
}
