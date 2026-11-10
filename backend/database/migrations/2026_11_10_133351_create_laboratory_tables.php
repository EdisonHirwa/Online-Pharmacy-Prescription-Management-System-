<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 15. lab_test_types
        Schema::create('lab_test_types', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->decimal('price', 10, 2);
            $table->string('expected_turnaround_time', 100);
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();
        });

        // 16. lab_tests
        Schema::create('lab_tests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('doctor_id')->constrained('doctors')->restrictOnDelete();
            $table->foreignId('consultation_id')->constrained('consultations')->restrictOnDelete();
            $table->foreignId('test_type_id')->constrained('lab_test_types')->restrictOnDelete();
            $table->foreignId('assigned_technician_id')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('request_date');
            $table->enum('status', ['requested', 'assigned', 'processing', 'completed', 'cancelled'])->default('requested');
            $table->text('result_summary')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['patient_id', 'status']);
            $table->index('assigned_technician_id');
        });

        // 17. lab_reports
        Schema::create('lab_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lab_test_id')->constrained('lab_tests')->restrictOnDelete();
            $table->foreignId('uploaded_by')->constrained('users')->restrictOnDelete();
            $table->string('file_path', 500);
            $table->string('file_type', 50); // pdf, jpeg, png
            $table->unsignedInteger('file_size'); // in bytes
            $table->dateTime('upload_date');
            $table->enum('report_status', ['preliminary', 'completed'])->default('completed');
            $table->timestamps();
            $table->softDeletes();

            $table->index('lab_test_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lab_reports');
        Schema::dropIfExists('lab_tests');
        Schema::dropIfExists('lab_test_types');
    }
};