<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'phone_number')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->string('phone_number', 50)->nullable()->unique();
            });
        }
        if (! Schema::hasColumn('users', 'role')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->enum('role', ['admin', 'doctor', 'patient', 'lab_tech', 'pharmacist'])->default('patient');
            });
        }
        if (! Schema::hasColumn('users', 'account_status')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->enum('account_status', ['active', 'inactive'])->default('active');
            });
        }
        if (! Schema::hasColumn('users', 'deleted_at')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->softDeletes();
            });
        }
    }

    public function down(): void
    {
        // Preserve legacy account data; the original users migration owns these columns on fresh installations.
    }
};
