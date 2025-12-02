<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sensor_data', function (Blueprint $table) {
            $table->id();
            
            // Flow Rate Sensors
            $table->float('f_main')->nullable();
            $table->float('f_1')->nullable();
            $table->float('f_2')->nullable();
            $table->float('f_3')->nullable();

            // Pressure Sensors
            $table->float('p_main')->nullable();
            $table->float('p_dma1')->nullable();
            $table->float('p_dma2')->nullable();
            $table->float('p_dma3')->nullable();

            // Status Flags (1 = On, 0 = Off)
            $table->boolean('pump_on')->default(0);
            $table->boolean('comp_on')->default(0);
            
            // ✅ ADD THIS LINE HERE:
            $table->integer('solenoid_active')->default(0);

            // Solenoid/Switch Status
            $table->boolean('s1')->default(0);
            $table->boolean('s2')->default(0);
            $table->boolean('s3')->default(0);

            $table->timestamps(); // created_at, updated_at
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sensor_data');
    }
};