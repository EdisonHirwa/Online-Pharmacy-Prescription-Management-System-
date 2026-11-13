<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->json('permissions')->nullable();
        });
        Schema::create('hospital_services', function (Blueprint $table): void {
            $table->id();
            $table->string('name')->unique();
            $table->string('service_type');
            $table->text('description')->nullable();
            $table->decimal('price', 10, 2);
            $table->string('status')->default('active');
            $table->timestamps();
        });
        Schema::create('system_settings', function (Blueprint $table): void {
            $table->id();
            $table->string('key')->unique();
            $table->text('value');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_settings');
        Schema::dropIfExists('hospital_services');
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('permissions');
        });
    }
};
