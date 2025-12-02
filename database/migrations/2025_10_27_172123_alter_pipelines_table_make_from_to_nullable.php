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
        Schema::table('pipelines', function (Blueprint $table) {
            // ✅ Make 'from' and 'to' columns nullable
            $table->string('from')->nullable()->change();
            $table->string('to')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pipelines', function (Blueprint $table) {
            // 🔙 Revert to NOT NULL if rolled back
            $table->string('from')->nullable(false)->change();
            $table->string('to')->nullable(false)->change();
        });
    }
};
