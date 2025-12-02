<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

// Default Laravel example command
Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// ===========================================================
// 🧬 MACHINE LEARNING AUTO-TRAINING COMMAND (GENETIC ALGORITHM)
// ===========================================================

// Manually trigger retraining anytime by running:
// php artisan ml:autotrain

// ✅ Automatically schedule the retraining once per day (3 AM)
Schedule::command('ml:autotrain')
    ->dailyAt('03:00')
    ->withoutOverlapping()
    ->onOneServer()
    ->sendOutputTo(storage_path('logs/ml_autotrain.log'));
