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
        Schema::create('water_pumps', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('location');
            $table->string('status'); // Active, Inactive, Error
            $table->decimal('x', 8, 2);
            $table->decimal('y', 8, 2);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('water_pumps');
    }
};