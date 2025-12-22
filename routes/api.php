<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;
use App\Http\Controllers\Api\{
    AuthController,
    AlertController,
    AnalysisController,
    ForumPostController,
    ForumTopicController,
    HouseholdController,
    LogController,
    MlModelController,
    PipelineController,
    PumpController,
    SensorController,
    SensorDataController,
    UserController,
    ReportController
};

// ====================================================
// ✅ PUBLIC ROUTES
// ====================================================
Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout']);
Route::post('/sensor-data', [SensorDataController::class, 'store']); 
Route::get('/health', fn() => response()->json(['status' => 'ok']));

// Testing/Debug Routes
Route::post('ml-model/manual-retrain', [MlModelController::class, 'retrainWithGA']);

// ====================================================
// 🔐 PROTECTED ROUTES (Login Required)
// ====================================================
Route::middleware(['auth:sanctum'])->group(function () {

    Route::post('/alerts/resolve-group', [AlertController::class, 'resolveGroup']);
    Route::post('/alerts/mark-false-group', [AlertController::class, 'markFalseGroup']);

    Route::get('/user', fn(Request $request) => $request->user());

    // Core Resources
    Route::apiResource('sensors', SensorController::class);
    Route::apiResource('households', HouseholdController::class);
    Route::apiResource('pumps', PumpController::class);
    Route::apiResource('pipelines', PipelineController::class);
    Route::apiResource('alerts', AlertController::class)->only(['index']);
    Route::apiResource('users', UserController::class);
    Route::apiResource('logs', LogController::class)->only(['index', 'store']);
    Route::apiResource('forum-topics', ForumTopicController::class);
    Route::apiResource('forum-posts', ForumPostController::class)->only(['store']);

    // Alert Management
    Route::post('alerts/{alert}/resolve', [AlertController::class, 'resolve']);
    Route::post('alerts/{alert}/mark-false', [AlertController::class, 'markAsFalse']);
    Route::get('/reports/download', [ReportController::class, 'downloadAlertsReport']);

    // Sensor History
    Route::get('sensor-data', [SensorDataController::class, 'index']);

    // ML & AI Training Routes
    Route::get('ml-model', [MlModelController::class, 'show']);
    Route::post('ml-model/train', [MlModelController::class, 'train']);
    Route::get('ml-model/progress', [MlModelController::class, 'getTrainingProgress']);
    
    // 👇 THIS IS THE CRITICAL NEW ROUTE FOR SUPERVISED LEARNING
    Route::post('/ml-model/collect', [MlModelController::class, 'collectLabeledData']);

    // Model Management
    Route::prefix('ml-models')->group(function () {
        Route::get('/', [MlModelController::class, 'index']);
        Route::post('/{id}/activate', [MlModelController::class, 'activate']);
    });

    // Settings
    Route::get('/ml-model/settings', [MlModelController::class, 'getSettings']);
    Route::post('/ml-model/settings', [MlModelController::class, 'saveSettings']);
    Route::post('/map/settings', [PipelineController::class, 'saveMapSettings']);
    Route::get('/map/settings', [PipelineController::class, 'getMapSettings']);

    // Profile
    Route::put('/profile', [AuthController::class, 'updateProfile']);
    
    // Analysis
    Route::get('/analysis/generate', [AnalysisController::class, 'generate']);
});