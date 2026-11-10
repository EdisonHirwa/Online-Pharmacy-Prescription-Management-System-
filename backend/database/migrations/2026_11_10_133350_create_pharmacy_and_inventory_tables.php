<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 9. medicines
        Schema::create('medicines', function (Blueprint $table) {
            $table->id();
            $table->string('medicine_code', 100)->unique();
            $table->string('name');
            $table->string('category', 100);
            $table->text('description')->nullable();
            $table->string('unit', 50); // tablet, bottle, vial, capsule
            $table->decimal('unit_price', 10, 2);
            $table->unsignedInteger('available_stock')->default(0);
            $table->unsignedInteger('reorder_level')->default(10);
            $table->date('expiry_date');
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['category', 'status']);
            $table->index('expiry_date');
        });

        // 10. prescriptions
        Schema::create('prescriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('consultation_id')->constrained('consultations')->restrictOnDelete();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('doctor_id')->constrained('doctors')->restrictOnDelete();
            $table->text('prescription_instructions')->nullable();
            $table->dateTime('issue_date');
            $table->enum('status', ['pending', 'partially_dispensed', 'dispensed', 'cancelled'])->default('pending');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['patient_id', 'status']);
        });

        // 11. prescription_items
        Schema::create('prescription_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('prescription_id')->constrained('prescriptions')->cascadeOnDelete();
            $table->foreignId('medicine_id')->constrained('medicines')->restrictOnDelete();
            $table->string('dosage', 100);
            $table->string('frequency', 100);
            $table->string('duration', 100);
            $table->unsignedInteger('quantity');
            $table->decimal('unit_price', 10, 2);
            $table->timestamps();

            $table->index('prescription_id');
        });

        // 12. dispensations
        Schema::create('dispensations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('prescription_id')->constrained('prescriptions')->restrictOnDelete();
            $table->foreignId('pharmacist_id')->constrained('users')->restrictOnDelete();
            $table->dateTime('dispensing_date');
            $table->enum('dispensing_status', ['completed', 'partially_completed']);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['prescription_id', 'pharmacist_id']);
        });

        // 13. dispensation_items
        Schema::create('dispensation_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dispensation_id')->constrained('dispensations')->cascadeOnDelete();
            $table->foreignId('prescription_item_id')->constrained('prescription_items')->restrictOnDelete();
            $table->unsignedInteger('quantity_dispensed');
            $table->decimal('unit_price', 10, 2);
            $table->timestamps();

            $table->index('dispensation_id');
        });

        // 14. medicine_stock_movements
        Schema::create('medicine_stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('medicine_id')->constrained('medicines')->restrictOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->enum('movement_type', ['addition', 'deduction', 'dispensing', 'adjustment', 'expired']);
            $table->integer('quantity');
            $table->unsignedInteger('previous_stock');
            $table->unsignedInteger('resulting_stock');
            $table->text('reason');
            $table->timestamps();

            $table->index(['medicine_id', 'movement_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('medicine_stock_movements');
        Schema::dropIfExists('dispensation_items');
        Schema::dropIfExists('dispensations');
        Schema::dropIfExists('prescription_items');
        Schema::dropIfExists('prescriptions');
        Schema::dropIfExists('medicines');
    }
};