<?php

namespace Database\Factories;

use App\Models\Patient;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class PatientFactory extends Factory
{
    protected $model = Patient::class;

    public function definition(): array
    {
        return ['user_id' => User::factory()->state(['role' => 'patient']), 'patient_number' => fake()->unique()->bothify('PAT-########'), 'date_of_birth' => '1995-01-01', 'gender' => 'Female', 'blood_group' => 'O+', 'address' => fake()->address(), 'emergency_contact_name' => fake()->name(), 'emergency_contact_phone' => '+250788123456'];
    }
}
