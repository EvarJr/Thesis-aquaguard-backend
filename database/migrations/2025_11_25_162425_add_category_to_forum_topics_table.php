<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::table('forum_topics', function (Blueprint $table) {
            // Only add if it doesn't exist
            if (!Schema::hasColumn('forum_topics', 'category')) {
                $table->string('category')->default('General')->after('title');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('forum_topics', function (Blueprint $table) {
            //
        });
    }
};
