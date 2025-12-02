<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pipelines', function (Blueprint $table) {
            // 1. The error says these don't exist, so we comment them out.
            // $table->dropForeign(['from']);
            // $table->dropForeign(['to']);

            // 2. We just ensure they are simple strings and accept NULL
            // This removes any implicit integer constraints if they existed
            $table->string('from')->nullable()->change();
            $table->string('to')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Ideally we would restore keys here, but for this fix we can leave empty
    }
};