<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 18. wards
        Schema::create('wards', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('ward_type', 100);
            $table->text('description')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();
        });

        // 19. hospital_beds
        Schema::create('hospital_beds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ward_id')->constrained('wards')->restrictOnDelete();
            $table->string('bed_number', 50)->unique();
            $table->string('bed_type', 100);
            $table->enum('availability_status', ['available', 'occupied', 'unavailable'])->default('available');
            $table->timestamps();

            $table->index(['ward_id', 'availability_status']);
        });

        // 20. admissions
        Schema::create('admissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('bed_id')->constrained('hospital_beds')->restrictOnDelete();
            $table->foreignId('admitting_user_id')->constrained('users')->restrictOnDelete();
            $table->dateTime('admission_date');
            $table->dateTime('discharge_date')->nullable();
            $table->enum('status', ['admitted', 'discharged'])->default('admitted');
            $table->text('admission_notes')->nullable();
            $table->text('discharge_summary')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['patient_id', 'status']);
            $table->index(['bed_id', 'status']);
        });

        // 21. invoices
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('invoice_number', 100)->unique();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('appointment_id')->nullable()->constrained('appointments')->nullOnDelete();
            $table->decimal('total_amount', 10, 2)->default(0.00);
            $table->decimal('amount_paid', 10, 2)->default(0.00);
            $table->decimal('outstanding_balance', 10, 2)->default(0.00);
            $table->enum('status', ['unpaid', 'partially_paid', 'paid', 'cancelled'])->default('unpaid');
            $table->date('issue_date');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['patient_id', 'status']);
            $table->index('issue_date');
        });

        // 22. invoice_items
        Schema::create('invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->string('service_description');
            $table->enum('service_type', ['consultation', 'lab_test', 'medicine', 'admission']);
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('unit_price', 10, 2);
            $table->decimal('subtotal', 10, 2);
            $table->timestamps();

            $table->index(['invoice_id', 'service_type']);
        });

        // 23. payments
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained('invoices')->restrictOnDelete();
            $table->string('payment_reference', 100)->unique();
            $table->decimal('amount', 10, 2);
            $table->enum('payment_method', ['cash', 'card', 'mobile_money']);
            $table->enum('transaction_status', ['completed', 'pending', 'failed'])->default('completed');
            $table->foreignId('received_by')->constrained('users')->restrictOnDelete();
            $table->dateTime('payment_date');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['invoice_id', 'payment_method']);
            $table->index('payment_date');
        });

        // 24. notifications
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->text('message');
            $table->string('notification_type', 50);
            $table->boolean('is_read')->default(false);
            $table->timestamps();

            $table->index(['user_id', 'is_read']);
        });

        // 25. audit_logs
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 100);
            $table->string('affected_table', 100);
            $table->unsignedBigInteger('affected_record_id')->nullable();
            $table->text('activity_details')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'action', 'affected_table']);
        });

        // 26. login_attempts
        Schema::create('login_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('email');
            $table->string('ip_address', 45);
            $table->enum('attempt_status', ['success', 'failed', 'suspicious_lockout']);
            $table->dateTime('attempt_date');

            $table->index(['email', 'ip_address', 'attempt_status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('login_attempts');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('invoice_items');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('admissions');
        Schema::dropIfExists('hospital_beds');
        Schema::dropIfExists('wards');
    }
};