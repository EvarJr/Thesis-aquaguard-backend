<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('alerts', function (Blueprint $table) {
            // ✅ CHANGE: Use standard auto-incrementing ID (1, 2, 3...)
            // Instead of manual strings like 'A01'
            $table->id(); 
            
            $table->string('sensor_id');
            $table->string('pipeline_id')->nullable();
            $table->string('message');
            $table->string('severity');
            $table->timestamp('resolved_at')->nullable();
            $table->boolean('false_positive')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('alerts');
    }
};