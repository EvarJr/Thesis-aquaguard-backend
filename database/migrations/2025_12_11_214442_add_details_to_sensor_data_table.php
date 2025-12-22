<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sensor_data', function (Blueprint $table) {
            // Check if column exists before adding to prevent errors
            if (!Schema::hasColumn('sensor_data', 'is_leak')) {
                $table->boolean('is_leak')->default(0);
            }
            if (!Schema::hasColumn('sensor_data', 'leak_location')) {
                $table->integer('leak_location')->default(0);
            }
            if (!Schema::hasColumn('sensor_data', 'details')) {
                $table->text('details')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('sensor_data', function (Blueprint $table) {
            $table->dropColumn(['is_leak', 'leak_location', 'details']);
        });
    }
};