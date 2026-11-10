<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 3. departments
        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();
        });

        // 4. specializations
        Schema::create('specializations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('department_id')->constrained('departments')->restrictOnDelete();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();
        });

        // 2. patients
        Schema::create('patients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->string('patient_number', 100)->unique();
            $table->date('date_of_birth');
            $table->enum('gender', ['Male', 'Female', 'Other']);
            $table->string('blood_group', 10)->nullable();
            $table->text('address');
            $table->string('emergency_contact_name');
            $table->string('emergency_contact_phone', 50);
            $table->timestamps();
            $table->softDeletes();

            $table->index('patient_number');
        });

        // 5. doctors
        Schema::create('doctors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->foreignId('department_id')->constrained('departments')->restrictOnDelete();
            $table->foreignId('specialization_id')->constrained('specializations')->restrictOnDelete();
            $table->string('license_number', 100)->unique();
            $table->decimal('consultation_fee', 10, 2)->default(0.00);
            $table->string('room_number', 50)->nullable();
            $table->enum('professional_status', ['active', 'on_leave', 'inactive'])->default('active');
            $table->text('bio')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['department_id', 'specialization_id', 'professional_status'], 'doc_dept_spec_status_idx');
        });

        // 6. doctor_schedules
        Schema::create('doctor_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('doctor_id')->constrained('doctors')->cascadeOnDelete();
            $table->enum('day_of_week', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
            $table->time('start_time');
            $table->time('end_time');
            $table->unsignedInteger('slot_duration')->default(30); // in minutes
            $table->boolean('is_available')->default(true);
            $table->timestamps();

            $table->index(['doctor_id', 'day_of_week']);
        });

        // 27. patient_allergies
        Schema::create('patient_allergies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients')->cascadeOnDelete();
            $table->string('allergy_name');
            $table->enum('severity', ['mild', 'moderate', 'severe']);
            $table->text('reaction_description')->nullable();
            $table->date('recorded_date');
            $table->timestamps();

            $table->index('patient_id');
        });

        // 28. patient_medical_histories
        Schema::create('patient_medical_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients')->cascadeOnDelete();
            $table->string('condition');
            $table->text('diagnosis_details');
            $table->text('treatment_history')->nullable();
            $table->date('recorded_date');
            $table->timestamps();

            $table->index('patient_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patient_medical_histories');
        Schema::dropIfExists('patient_allergies');
        Schema::dropIfExists('doctor_schedules');
        Schema::dropIfExists('doctors');
        Schema::dropIfExists('patients');
        Schema::dropIfExists('specializations');
        Schema::dropIfExists('departments');
    }
};