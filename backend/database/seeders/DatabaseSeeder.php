<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\HospitalService;
use App\Models\LabTestType;
use App\Models\SystemSetting;
use App\Models\Ward;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['General Medicine', 'Pediatrics', 'Surgery', 'Maternity', 'Dentistry', 'Laboratory', 'Pharmacy'] as $name) {
            Department::firstOrCreate(['name' => $name], ['status' => 'active']);
        }
        $this->call(SpecializationSeeder::class);

        foreach (['General', 'Maternity', 'Pediatric'] as $name) {
            Ward::firstOrCreate(['name' => $name], ['ward_type' => $name, 'status' => 'active']);
        }
        HospitalService::firstOrCreate(['name' => 'General consultation'], ['service_type' => 'consultation', 'price' => 5000, 'status' => 'active']);
        LabTestType::firstOrCreate(['name' => 'Complete blood count'], ['price' => 10000, 'expected_turnaround_time' => '24 hours', 'status' => 'active']);
        foreach (['hospital_name' => 'Online Pharmacy', 'currency' => 'RWF', 'timezone' => 'Africa/Kigali'] as $key => $value) {
            SystemSetting::firstOrCreate(['key' => $key], ['value' => $value]);
        }
    }
}
