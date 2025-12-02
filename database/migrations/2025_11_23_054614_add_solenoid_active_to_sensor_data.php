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
            Schema::table('sensor_data', function (Blueprint $table) {
                // 0 = Closed (No usage expected), 1 = Open (Usage expected)
                $table->boolean('solenoid_active')->default(0)->after('s3');
            });
        }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sensor_data', function (Blueprint $table) {
            //
        });
    }
};
