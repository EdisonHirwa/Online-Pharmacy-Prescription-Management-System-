<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Specialization;
use Illuminate\Database\Seeder;

class SpecializationSeeder extends Seeder
{
    public function run(): void
    {
        $specializations = [
            'General Medicine' => ['General Practice', 'Internal Medicine'],
            'Pediatrics' => ['General Pediatrics', 'Pediatric Cardiology', 'Neonatology'],
            'Surgery' => ['General Surgery', 'Orthopedic Surgery'],
            'Maternity' => ['Obstetrics and Gynecology'],
            'Dentistry' => ['General Dentistry', 'Orthodontics'],
            'Laboratory' => ['Clinical Pathology'],
            'Pharmacy' => ['Clinical Pharmacy'],
        ];

        foreach ($specializations as $departmentName => $names) {
            $department = Department::firstOrCreate(['name' => $departmentName], ['status' => 'active']);

            foreach ($names as $name) {
                Specialization::firstOrCreate(['name' => $name], [
                    'department_id' => $department->id,
                    'status' => 'active',
                ]);
            }
        }
    }
}
