<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Only add timestamps if they don't already exist
        Schema::table('system_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('system_settings', 'created_at') &&
                !Schema::hasColumn('system_settings', 'updated_at')) {
                $table->timestamps();
            }
        });
    }

    public function down(): void
    {
        // Remove timestamps if they exist
        Schema::table('system_settings', function (Blueprint $table) {
            if (Schema::hasColumn('system_settings', 'created_at') &&
                Schema::hasColumn('system_settings', 'updated_at')) {
                $table->dropColumn(['created_at', 'updated_at']);
            }
        });
    }
};
