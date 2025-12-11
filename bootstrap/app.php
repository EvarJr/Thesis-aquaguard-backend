<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Console\Scheduling\Schedule;

// ✅ Core middleware from the framework
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Session\Middleware\AuthenticateSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Routing\Middleware\SubstituteBindings;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        channels: __DIR__.'/../routes/channels.php',
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )

    ->withMiddleware(function (Middleware $middleware): void {

        // ✅ EXCLUDE SENSOR DATA FROM CSRF CHECKS (Critical for ESP32 & Testing)
        $middleware->validateCsrfTokens(except: [
            'api/sensor-data',  // Allow ESP32/Postman/Console to POST here
            'sensor-data',
        ]);

        /**
         * ✅ WEB MIDDLEWARE STACK
         */
        $middleware->web(append: [
            EnsureFrontendRequestsAreStateful::class,
            EncryptCookies::class,
            AddQueuedCookiesToResponse::class,
            StartSession::class,
            AuthenticateSession::class,
            ShareErrorsFromSession::class,
            VerifyCsrfToken::class,
            SubstituteBindings::class,
        ]);

        /**
         * ✅ API MIDDLEWARE STACK
         */
        $middleware->api(prepend: [
            EnsureFrontendRequestsAreStateful::class,
            EncryptCookies::class,
            AddQueuedCookiesToResponse::class,
            StartSession::class,
            ShareErrorsFromSession::class,
            VerifyCsrfToken::class,
            SubstituteBindings::class,
        ]);

        $middleware->group('broadcast', [
            EnsureFrontendRequestsAreStateful::class,
            EncryptCookies::class,
            AddQueuedCookiesToResponse::class,
            StartSession::class,
            AuthenticateSession::class,
            ShareErrorsFromSession::class,
            VerifyCsrfToken::class,
            SubstituteBindings::class,
        ]);

        $middleware->alias([
            'verified' => \App\Http\Middleware\EnsureEmailIsVerified::class,
        ]);
    })

    /**
     * ✅ Register custom Artisan commands (ML retraining, etc.)
     */
    ->withCommands([
        App\Console\Commands\AutoTrainModel::class, // 🧠 ML Auto Retraining Command
    ])

    /**
     * ✅ Daily Scheduler — retrains ML model automatically at midnight
     */
    ->withSchedule(function (Schedule $schedule) {
        $schedule->command('ml:autotrain')->dailyAt('00:00');
    })

    ->withExceptions(function (Exceptions $exceptions): void {
        // Optional: add custom exception handling or logging here.
    })

    ->create();
