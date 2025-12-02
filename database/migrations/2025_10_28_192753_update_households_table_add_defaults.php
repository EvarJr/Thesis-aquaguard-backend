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
        Schema::table('households', function (Blueprint $table) {
            $table->decimal('x', 8, 2)->default(200)->change();
            $table->decimal('y', 8, 2)->default(200)->change();
        });
    }

    public function down(): void
    {
        Schema::table('households', function (Blueprint $table) {
            $table->decimal('x', 8, 2)->nullable(false)->change();
            $table->decimal('y', 8, 2)->nullable(false)->change();
        });
    }
};
