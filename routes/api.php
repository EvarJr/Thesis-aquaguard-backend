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

// ...
Route::get('/debug-ai-models', function () {
    $apiKey = env('GEMINI_API_KEY');
    
    $response = \Illuminate\Support\Facades\Http::withoutVerifying()
        ->get("https://generativelanguage.googleapis.com/v1beta/models?key={$apiKey}");

    return $response->json();
});

Route::post('/map/settings', [App\Http\Controllers\Api\PipelineController::class, 'saveMapSettings']);
Route::get('/map/settings', [App\Http\Controllers\Api\PipelineController::class, 'getMapSettings']);

Route::get('/debug-force-alert', function() {
    try {
        // Try to save a standard alert
        $alert = \App\Models\Alert::create([
            'sensor_id' => 'DEBUG-01',
            'pipeline_id' => 'P-DEBUG',
            'message' => 'Forced Test Alert',
            'severity' => 'Critical',
            'false_positive' => false
        ]);
        return response()->json(['status' => 'success', 'saved_id' => $alert->id]);
    } catch (\Exception $e) {
        // If this prints, your Database Schema is the problem
        return response()->json(['status' => 'error', 'message' => $e->getMessage()]);
    }
});

Route::get('/seed-smart-data', function () {
    $csvPath = storage_path('app/ml_models/pipeline_sensor_data.csv');
    
    // 1. Open CSV in Write Mode ('w' clears previous junk data)
    $file = fopen($csvPath, 'w');
    
    // 2. Add Headers (Must match Python script)
    fputcsv($file, [
        'f_main', 'p_main', 'pump_on', // Features
        'leak_detected', 'leak_location' // Targets
    ]);
    
    // 3. Generate 50 "NORMAL" Rows (High Pressure, Normal Flow)
    for ($i = 0; $i < 50; $i++) {
        fputcsv($file, [
            rand(95, 105), // Flow: Normal (~100)
            rand(48, 52),  // Pressure: High (~50)
            1,             // Pump On
            0,             // ❌ No Leak
            0              // Location 0
        ]);
    }

    // 4. Generate 50 "LEAK" Rows (Low Pressure, High Flow)
    for ($i = 0; $i < 50; $i++) {
        fputcsv($file, [
            rand(110, 130), // Flow: High (Leaking)
            rand(20, 35),   // Pressure: Drops Low
            1,              // Pump On
            1,              // 🚨 LEAK DETECTED
            rand(1, 3)      // Random Location
        ]);
    }
    
    fclose($file);

    // 5. Trigger Training Immediately
    $controller = new MlModelController();
    return $controller->executeRetraining('Simulated Smart Data');
});

Route::get('/debug-auto-train', function() {
    $csvPath = storage_path('app/ml_models/pipeline_sensor_data.csv');
    
    // Count Lines
    $lines = 0;
    if(file_exists($csvPath)) {
        // Simple line counter
        $handle = fopen($csvPath, "r");
        while(!feof($handle)){
            $line = fgets($handle);
            if($line !== false) $lines++;
        }
        fclose($handle);
    }
    
    // Get Settings
    $threshold = \App\Models\SystemSetting::where('key', 'training_target')->value('value');
    $mode = \App\Models\SystemSetting::where('key', 'training_mode')->value('value');
    
    // Check Block
    $stuckModel = \App\Models\MLModel::where('status', 'TRAINING')->first();
    
    return [
        'CSV_File_Exists' => file_exists($csvPath),
        'CSV_Line_Count' => $lines,
        'Threshold_Setting' => $threshold,
        'Mode_Setting' => $mode,
        'Traffic_Jam_Status' => $stuckModel ? "BLOCKED by Model ID {$stuckModel->id}" : "CLEAR (Ready to Train)",
    ];
});

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// ====================================================
// ✅ PUBLIC ROUTES (No Login Required)
// ====================================================
Route::post('/login', [AuthController::class, 'login'])->name('api.login');
Route::post('/logout', [AuthController::class, 'logout'])->name('api.logout');
Route::post('/sensor-data', [SensorDataController::class, 'store']); 
Route::get('/health', fn() => response()->json(['status' => 'ok']));

// 👇 MOVED HERE FOR TESTING (Fixes 404 if Auth is failing)
Route::post('ml-model/manual-retrain', [MlModelController::class, 'retrainWithGA']);

// ====================================================
// 🔐 PROTECTED ROUTES (Login Required)
// ====================================================
Route::middleware(['auth:sanctum'])->group(function () {

    Route::get('/user', fn(Request $request) => $request->user());

    // Resources
    Route::apiResource('sensors', SensorController::class);
    Route::apiResource('households', HouseholdController::class);
    Route::apiResource('pumps', PumpController::class);
    Route::apiResource('pipelines', PipelineController::class);
    Route::apiResource('alerts', AlertController::class)->only(['index']);
    Route::apiResource('users', UserController::class);
    Route::apiResource('logs', LogController::class)->only(['index', 'store']);
    Route::apiResource('forum-topics', ForumTopicController::class);
    Route::apiResource('forum-posts', ForumPostController::class)->only(['store']);

    // Custom Actions
    Route::post('alerts/{alert}/resolve', [AlertController::class, 'resolve']);
    Route::post('alerts/{alert}/mark-false', [AlertController::class, 'markAsFalse']);
    Route::get('sensor-data', [SensorDataController::class, 'index']);
    Route::get('/reports/download', [ReportController::class, 'downloadAlertsReport']);

    // ML Routes
    Route::get('ml-model', [MlModelController::class, 'show']);
    Route::post('ml-model/train', [MlModelController::class, 'train']);
    Route::get('ml-model/progress', [MlModelController::class, 'getTrainingProgress']);
    
    Route::prefix('ml-models')->group(function () {
        Route::get('/', [MlModelController::class, 'index']);
        Route::post('/{id}/activate', [MlModelController::class, 'activate']);
        Route::post('/register-base', [MlModelController::class, 'registerBaseModel']);
    });

    // User Profile
    Route::put('/profile', [AuthController::class, 'updateProfile']);

    // AI Analysis
    Route::get('/analysis/generate', [App\Http\Controllers\Api\AnalysisController::class, 'generate']);

    // Settings
    Route::get('/ml-model/settings', [MlModelController::class, 'getSettings']);
    Route::post('/ml-model/settings', [MlModelController::class, 'saveSettings']);

    Route::get('/simulate-data-fill', function () {
        $path = storage_path('app/ml_models/pipeline_sensor_data.csv');
        
        // Create dummy data
        $file = fopen($path, 'w'); // 'w' overwrites file to start fresh
        fputcsv($file, ['f_main', 'p_main', 'pump_on', 'leak_detected', 'leak_location']); // Headers
        
        // Add 105 rows (Threshold is 100)
        for ($i = 0; $i < 105; $i++) {
            fputcsv($file, [rand(80,120), rand(40,60), 1, 0, 0]);
        }
        fclose($file);

        return "Filled CSV with 105 rows. Next sensor push should trigger training.";
    });

    Route::post('/ml-model/collect', [MlModelController::class, 'collectLabeledData']);

    Route::apiResource('forum-topics', ForumTopicController::class); 
});