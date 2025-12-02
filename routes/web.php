<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Http\Request;
use App\Http\Controllers\SpaController;
use App\Http\Controllers\Api\AuthController;
use Illuminate\Session\Middleware\AuthenticateSession;
use Laravel\Sanctum\Sanctum;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| These routes serve as the entry points for your React SPA and handle
| Sanctum-based session authentication. They belong to the "web"
| middleware group, which includes session, CSRF, and cookies.
|
*/

// Add this line:
Route::get('/login', [SpaController::class, 'index'])->name('login');

// ✅ Initialize CSRF cookie for Sanctum
Route::get('/sanctum/csrf-cookie', function () {
    return response()->noContent(); // Sanctum sets XSRF-TOKEN cookie
});

// ✅ Authentication routes (session-based)
Route::post('/api/login', [AuthController::class, 'login'])->name('api.login');
Route::post('/api/logout', [AuthController::class, 'logout'])->name('api.logout');

// ✅ Authenticated user endpoint (used by React to check session)
Route::middleware('auth:sanctum')
    ->withoutMiddleware([AuthenticateSession::class])
    ->get('/api/user', function (Request $request) {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        return response()->json($user);
    })
    ->name('api.user');

/*
|--------------------------------------------------------------------------
| 🔊 BROADCAST AUTH ROUTES
|--------------------------------------------------------------------------
| Enables authentication for private/presence channels (Echo + Pusher).
| These use the "broadcast" middleware group we defined in bootstrap/app.php.
| This ensures Sanctum cookies & CSRF are properly applied.
|
*/

Broadcast::routes(['middleware' => ['broadcast', 'auth:sanctum']]);

/*
|--------------------------------------------------------------------------
| ⚛️ React SPA Fallback
|--------------------------------------------------------------------------
| All non-API routes fall back to the SPA entry point (index.html).
|
*/

Route::get('/{any}', [SpaController::class, 'index'])
    ->where('any', '^(?!api|sanctum|broadcasting).*$')
    ->name('spa.index');
