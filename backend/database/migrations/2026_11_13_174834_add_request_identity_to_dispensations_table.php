<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dispensations', function (Blueprint $table): void {
            $table->uuid('request_key')->nullable()->unique();
            $table->string('request_hash', 64)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('dispensations', function (Blueprint $table): void {
            $table->dropUnique(['request_key']);
            $table->dropColumn(['request_key', 'request_hash']);
        });
    }
};
