<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('forum_posts', function (Blueprint $table) {
            // ✅ FIX 1: Use UUID for the post ID
            $table->uuid('id')->primary();
            
            // ✅ FIX 2: Use foreignUuid to link to the topic (must match topic ID type)
            $table->foreignUuid('forum_topic_id')->constrained('forum_topics')->onDelete('cascade');
            
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->text('content');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('forum_posts');
    }
};