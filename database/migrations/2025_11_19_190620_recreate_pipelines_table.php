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
        // 1. Disable safety checks
        Schema::disableForeignKeyConstraints();

        // 2. Destroy the old restrictive table
        Schema::dropIfExists('pipelines');

        // 3. Create the new unrestricted table
        Schema::create('pipelines', function (Blueprint $table) {
            $table->string('id')->primary(); // P001, P002...
            $table->string('location')->nullable();
            
            // These are now simple strings. No Foreign Keys. No Rules.
            // This allows Sensor -> Pump, Pump -> Household, etc.
            $table->string('from'); 
            $table->string('to');   
            
            $table->text('joints')->nullable(); // Stores JSON path
            $table->timestamps();
        });

        // 4. Re-enable safety checks
        Schema::enableForeignKeyConstraints();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('pipelines');
        Schema::enableForeignKeyConstraints();
    }
};