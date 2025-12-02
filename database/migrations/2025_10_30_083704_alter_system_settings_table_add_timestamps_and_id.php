<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Step 1: Drop existing primary key on `key`
        $hasPrimary = DB::select("SHOW INDEX FROM system_settings WHERE Key_name = 'PRIMARY'");
        if (!empty($hasPrimary)) {
            DB::statement('ALTER TABLE system_settings DROP PRIMARY KEY');
        }

        // Step 2: Add new `id` column as auto-increment primary key
        Schema::table('system_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('system_settings', 'id')) {
                $table->id()->first();
            }
        });

        // Step 3: Make sure `key` remains unique
        Schema::table('system_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('system_settings', 'created_at')) {
                $table->timestamps();
            }

            // Add unique index for `key` if not already unique
            $hasKeyIndex = collect(DB::select("SHOW INDEX FROM system_settings WHERE Column_name = 'key' AND Non_unique = 0"))->isNotEmpty();
            if (!$hasKeyIndex) {
                $table->unique('key');
            }
        });
    }

    public function down(): void
    {
        Schema::table('system_settings', function (Blueprint $table) {
            if (Schema::hasColumn('system_settings', 'id')) {
                $table->dropColumn('id');
            }
            if (Schema::hasColumn('system_settings', 'created_at')) {
                $table->dropColumn(['created_at', 'updated_at']);
            }
        });

        // Restore primary key on `key`
        DB::statement('ALTER TABLE system_settings ADD PRIMARY KEY (`key`)');
    }
};
