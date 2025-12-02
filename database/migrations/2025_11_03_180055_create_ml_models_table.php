<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
{
    Schema::create('ml_models', function (Blueprint $table) {
        $table->id();
        $table->string('version')->unique();
        $table->string('name')->nullable();
        $table->string('description')->nullable();
        $table->string('file_path_detect')->nullable();
        $table->string('file_path_locate')->nullable();
        $table->string('file_path_features')->nullable();
        $table->float('accuracy')->default(0.0);
        
        // ✅ FIX: Changed from enum(...) to string(...)
        // This allows 'TRAINING', 'FAILED', 'ACTIVE', etc. without crashing.
        $table->string('status')->default('INACTIVE'); 
        
        $table->boolean('is_active')->default(false); // Changed default to false to be safe
        $table->json('metadata')->nullable();
        $table->timestamps();
    });
}

    public function down(): void
    {
        Schema::dropIfExists('ml_models');
    }
};
