<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Skip if 'logs' table does not exist
        if (!Schema::hasTable('logs')) {
            return;
        }

        Schema::table('logs', function (Blueprint $table) {
            $table->text('details')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Skip if 'logs' table does not exist
        if (!Schema::hasTable('logs')) {
            return;
        }

        Schema::table('logs', function (Blueprint $table) {
            $table->text('details')->nullable(false)->change();
        });
    }
};
