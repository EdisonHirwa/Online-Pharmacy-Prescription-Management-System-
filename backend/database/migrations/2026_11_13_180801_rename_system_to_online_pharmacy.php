<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('system_settings')->updateOrInsert(['key' => 'hospital_name'], ['value' => 'Online Pharmacy', 'updated_at' => now()]);
    }

    public function down(): void
    {
        DB::table('system_settings')->where('key', 'hospital_name')->where('value', 'Online Pharmacy')->update(['value' => 'MediCare Hospital', 'updated_at' => now()]);
    }
};
