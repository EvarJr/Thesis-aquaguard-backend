<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MLModel;
use App\Models\SystemSetting;
use App\Models\Pipeline;
use Illuminate\Http\Request;
use Symfony\Component\Process\Process;
use Illuminate\Support\Facades\Log;
use App\Helpers\PipelineMapper;

class MlModelController extends Controller
{
    public function index()
    {
        $models = MLModel::orderBy('version', 'desc')->get();
        $active = MLModel::where('status', 'ACTIVE')->first();

        return response()->json([
            'models' => $models,
            'active' => $active,
        ]);
    }

    public function show()
    {
        $activeModel = MLModel::where('status', 'ACTIVE')->first();
        if (!$activeModel) {
            $activeModel = MLModel::where('status', 'TRAINED')->latest('created_at')->first();
        }

        if (!$activeModel) {
            return response()->json([
                'status' => 'NOT_TRAINED',
                'version' => 'v0.0',
                'accuracy' => 'N/A',
                'updated_at' => 'Never',
                'message' => 'No active ML model found.',
            ]);
        }

        return response()->json([
            'status' => $activeModel->status,
            'version' => $activeModel->version,
            'accuracy' => $activeModel->accuracy,
            'updated_at' => $activeModel->updated_at->diffForHumans(),
        ]);
    }

    public function getSettings()
    {
        $mode = SystemSetting::where('key', 'training_mode')->value('value') ?? 'manual';
        $target = SystemSetting::where('key', 'training_target')->value('value') ?? '100';

        return response()->json([
            'mode' => $mode,
            'target' => (int)$target
        ]);
    }

    public function saveSettings(Request $request)
    {
        $request->validate([
            'mode' => 'required|in:auto,manual',
            'target' => 'required|integer|min:1' 
        ]);

        SystemSetting::updateOrCreate(['key' => 'training_mode'], ['value' => $request->mode]);
        SystemSetting::updateOrCreate(['key' => 'training_target'], ['value' => $request->target]);

        return response()->json(['status' => 'success', 'message' => 'Settings updated.']);
    }

    public function activate($id)
    {
        MLModel::query()->update(['status' => 'TRAINED', 'is_active' => false]);
        $model = MLModel::findOrFail($id);
        $model->update(['status' => 'ACTIVE', 'is_active' => true]);
        
        return response()->json(['status' => 'success', 'message' => "v{$model->version} Activated"]);
    }

    public function train(Request $request)
    {
        return $this->executeRetraining('Manual Admin Trigger');
    }

    public function retrainWithGA(Request $request)
    {
        return $this->executeRetraining('Manual API Trigger');
    }

    public function executeRetraining($triggeredBy = 'Automatic')
    {
        // 1. Check if already training
        $isTraining = MLModel::where('status', 'TRAINING')->exists();
        if ($isTraining) {
            return response()->json(['status' => 'skipped', 'message' => 'Training already in progress.']);
        }

        // 2. Setup Paths
        $scriptPath = base_path('app/ml/train_with_ga.py');
        $isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
        $pythonExe = base_path($isWindows ? 'venv\Scripts\python.exe' : 'venv/bin/python');
        
        if (!file_exists($pythonExe)) {
             // Fallback for global python if venv not found
             $pythonExe = 'python'; 
        }
        
        if (!file_exists($scriptPath)) {
            return response()->json(['status' => 'error', 'message' => 'Script missing at: ' . $scriptPath], 404);
        }

        // 3. Cleanup Old Temp Files
        $filesToDelete = [
            storage_path('app/ml_models/train_progress.json'),
            storage_path('app/ml_models/train_result.json')
        ];
        foreach ($filesToDelete as $file) {
            if (file_exists($file)) @unlink($file);
        }

        // 4. Calculate Version
        $currentVersion = ((float) MLModel::max('version') ?? 1.0);
        $newVersionVal = round($currentVersion + 0.1, 1);
        
        // ✅ DEFINED HERE: used for filenames and command argument
        $versionTag = "v" . str_replace('.', '_', (string)$newVersionVal); 

        // 5. Create DB Record
        MLModel::create([
            'name' => 'GA Optimized Model',
            'version' => $newVersionVal,
            'description' => "Retrained via {$triggeredBy}",
            'status' => 'TRAINING',
            'is_active' => false,
            'accuracy' => 0,
            'file_path_detect' => "storage/app/ml_models/rf_leak_detect_{$versionTag}.joblib",
            'file_path_locate' => "storage/app/ml_models/rf_leak_locate_{$versionTag}.joblib",
            'file_path_features' => 'storage/app/ml_models/feature_cols.joblib',
        ]);

        // Initialize Progress File
        $progPath = storage_path('app/ml_models/train_progress.json');
        file_put_contents($progPath, json_encode(['progress' => 0, 'status' => 'starting', 'message' => 'Initializing Python...']));

        // 6. Execute Python (Background Mode)
        try {
            // ✅ CMD CONSTRUCTION
            // We pass the python executable, the script path, and the version tag
            $cmd = "\"{$pythonExe}\" \"{$scriptPath}\" \"{$versionTag}\"";

            if ($isWindows) {
                // Windows Background: start /B "" command
                pclose(popen("start /B \"\" " . $cmd, "r"));
            } else {
                // Linux Background: command > /dev/null &
                exec($cmd . " > /dev/null 2>&1 &");
            }

            Log::info("🧬 GA Retraining STARTED (v{$newVersionVal}) tag: {$versionTag}");

            return response()->json([
                'status' => 'in_progress',
                'message' => 'Genetic Algorithm retraining started.',
                'new_version' => $newVersionVal
            ]);

        } catch (\Exception $e) {
            Log::error("GA Retraining Launch Failed: " . $e->getMessage());
            
            // Mark DB as failed
            MLModel::where('status', 'TRAINING')->update(['status' => 'FAILED']);
            
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }

    public function getTrainingProgress()
    {
        $progressPath = storage_path('app/ml_models/train_progress.json');
        $resultPath = storage_path('app/ml_models/train_result.json');

        if (file_exists($progressPath)) {
            $progressData = json_decode(file_get_contents($progressPath), true);

            if (isset($progressData['progress']) && $progressData['progress'] >= 100) {
                if (file_exists($resultPath)) {
                    $result = json_decode(file_get_contents($resultPath), true);
                    $trainingModel = MLModel::where('status', 'TRAINING')->latest()->first();
                    if ($trainingModel) {
                        $trainingModel->update([
                            'accuracy' => $result['accuracy'] ?? 0,
                            'status' => 'TRAINED',
                            'is_active' => false
                        ]);
                    }
                    return response()->json(['progress' => 100, 'status' => 'completed', 'message' => 'Training finished.']);
                }
            }
            return response()->json($progressData);
        }

        return response()->json(['progress' => 0, 'status' => 'idle', 'message' => 'Ready to train.']);
    }

    /**
     * 🧠 SUPERVISED LEARNING: Manually label live data
     * Saves to 'validated_alerts.csv' (High Priority Ground Truth)
     */
    public function collectLabeledData(Request $request)
    {
        try {
            $input = $request->all();
            Log::info("🧠 HITL Raw Input:", $input); // Debug log

            // 1. SMART DATA EXTRACTION
            // Sometimes data is at root, sometimes inside 'data' wrapper
            $sensorSource = null;

            if (isset($input['f_main'])) {
                $sensorSource = $input;
            } elseif (isset($input['data']) && isset($input['data']['f_main'])) {
                $sensorSource = $input['data'];
            }

            // ❌ Validation: If we didn't find sensor data, STOP.
            if (!$sensorSource) {
                Log::error("❌ HITL Error: No sensor data found in payload.");
                return response()->json(['status' => 'error', 'message' => 'Invalid payload structure'], 400);
            }

            // 2. Extract Labels
            $label = $input['manual_label'] ?? null;
            $pipelineId = $input['manual_pipeline_id'] ?? null;
            
            $isLeak = ($label === 'leak') ? 1 : 0;
            
            // 3. Map Pipeline ID
            $leakLoc = 0;
            if ($isLeak && $pipelineId) {
                // Ensure Mapper is imported at top: use App\Helpers\PipelineMapper;
                $leakLoc = PipelineMapper::getLabel($pipelineId);
                if ($leakLoc == 0) Log::warning("⚠️ Pipeline ID '$pipelineId' not found in Map.");
            }

            // 4. Prepare Row (Explicit Float Casting)
            $row = [
                (float) ($sensorSource['f_main'] ?? 0),
                (float) ($sensorSource['f_1'] ?? 0),
                (float) ($sensorSource['f_2'] ?? 0),
                (float) ($sensorSource['f_3'] ?? 0),
                (float) ($sensorSource['p_main'] ?? 0),
                (float) ($sensorSource['p_dma1'] ?? 0),
                (float) ($sensorSource['p_dma2'] ?? 0),
                (float) ($sensorSource['p_dma3'] ?? 0),
                (int)   ($sensorSource['pump_on'] ?? 1),
                (int)   ($sensorSource['comp_on'] ?? 0),
                (int)   ($sensorSource['s1'] ?? 0),
                (int)   ($sensorSource['s2'] ?? 0),
                (int)   ($sensorSource['s3'] ?? 0),
                (int)   ($sensorSource['solenoid_active'] ?? 0),
                $isLeak,
                $leakLoc
            ];

            // 5. Write to CSV (With Locking)
            $csvPath = storage_path('app/ml_models/validated_alerts.csv');
            if (!file_exists(dirname($csvPath))) mkdir(dirname($csvPath), 0777, true);
            
            $fp = false; 
            $attempts = 0;
            // Retry loop
            while (!$fp && $attempts < 10) { 
                $fp = @fopen($csvPath, 'a'); 
                if (!$fp) { usleep(100000); $attempts++; } 
            }
            
            if ($fp) {
                // Header if new
                if (filesize($csvPath) == 0) {
                    fputcsv($fp, ['f_main','f_1','f_2','f_3','p_main','p_dma1','p_dma2','p_dma3','pump_on','comp_on','s1','s2','s3','solenoid_active','leak_detected','leak_location']);
                }

                // Write 10 times (Priority)
                if (flock($fp, LOCK_EX)) { 
                    for ($i = 0; $i < 10; $i++) fputcsv($fp, $row);
                    flock($fp, LOCK_UN); 
                }
                fclose($fp);
                
                Log::info("✅ HITL Saved: P_Main=" . $row[4] . " | Loc=" . $row[15]);
            } else {
                throw new \Exception("Could not open CSV file (Locked).");
            }

            return response()->json(['message' => 'Data labeled and saved successfully.']);

        } catch (\Exception $e) {
            Log::error("🔥 Manual Data Collection Failed: " . $e->getMessage());
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }
}