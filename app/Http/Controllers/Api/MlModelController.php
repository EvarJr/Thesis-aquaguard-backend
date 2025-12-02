<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MLModel;
use App\Models\SystemSetting;
use App\Models\Pipeline; // ✅ Imported Pipeline
use Illuminate\Http\Request;
use Symfony\Component\Process\Process;
use Illuminate\Support\Facades\Log;

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
        // Get the currently ACTIVE model
        $activeModel = MLModel::where('status', 'ACTIVE')->first();

        // If no active model, try to get the latest TRAINED model as fallback
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
        // Deactivate all
        MLModel::query()->update(['status' => 'TRAINED', 'is_active' => false]);
        
        // Activate selected
        $model = MLModel::findOrFail($id);
        $model->update(['status' => 'ACTIVE', 'is_active' => true]);
        
        return response()->json(['status' => 'success', 'message' => "v{$model->version} Activated"]);
    }

    /**
     * Triggered by the "Start Training" button in Frontend
     */
    public function train(Request $request)
    {
        return $this->executeRetraining('Manual Admin Trigger');
    }

    /**
     * Triggered via API route for testing
     */
    public function retrainWithGA(Request $request)
    {
        return $this->executeRetraining('Manual API Trigger');
    }

    /**
     * Core Logic to Run Python Script in Background
     */
    public function executeRetraining($triggeredBy = 'Automatic')
    {
        $isTraining = MLModel::where('status', 'TRAINING')->exists();
        if ($isTraining) {
            return response()->json(['status' => 'skipped', 'message' => 'Training already in progress.']);
        }

        // 1. Define Paths
        $scriptPath = base_path('app/ml/train_with_ga.py');
        $pythonExe = base_path('venv\Scripts\python.exe'); // Windows Path
        
        if (!file_exists($scriptPath)) {
            return response()->json(['status' => 'error', 'message' => 'Script missing at: ' . $scriptPath], 404);
        }

        // 2. Create Database Entry
        $currentVersion = ((float) MLModel::max('version') ?? 1.0);
        $newVersion = round($currentVersion + 0.1, 1);

        MLModel::create([
            'name' => 'GA Optimized Model',
            'version' => $newVersion,
            'description' => "Retrained via {$triggeredBy}",
            'status' => 'TRAINING',
            'is_active' => false,
            'accuracy' => 0,
            'file_path_detect' => 'storage/app/ml_models/rf_leak_detect_ga.joblib',
            'file_path_locate' => 'storage/app/ml_models/rf_leak_locate_ga.joblib',
            'file_path_features' => 'storage/app/ml_models/feature_cols.joblib',
        ]);

        // 3. Execute Python (Background Mode)
        try {
            $cmd = "\"{$pythonExe}\" \"{$scriptPath}\"";

            if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
                pclose(popen("start /B " . $cmd, "r"));
            } else {
                exec($cmd . " > /dev/null 2>&1 &");
            }

            Log::info("🧬 GA Retraining STARTED (v{$newVersion}) - Trigger: {$triggeredBy}");

            return response()->json([
                'status' => 'in_progress',
                'message' => 'Genetic Algorithm retraining started.',
                'new_version' => $newVersion
            ]);

        } catch (\Exception $e) {
            Log::error("GA Retraining Launch Failed: " . $e->getMessage());
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }

    public function getTrainingProgress()
    {
        $progressPath = storage_path('app/ml_models/train_progress.json');
        $resultPath = storage_path('app/ml_models/train_result.json');

        if (file_exists($progressPath)) {
            $progressData = json_decode(file_get_contents($progressPath), true);

            // Check completion
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

                    return response()->json([
                        'progress' => 100,
                        'status' => 'completed',
                        'message' => 'Training successfully finished.',
                        'result' => $result
                    ]);
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
            $data = $request->all();
            
            // 1. Validate Input
            $label = $request->input('manual_label'); 
            $pipelineId = $request->input('manual_pipeline_id'); 
            
            $isLeak = ($label === 'leak') ? 1 : 0;
            $leakLoc = 0;

            // 2. LOGIC: Map Pipeline ID to ML Integer Class
            if ($isLeak && $pipelineId) {
                $pipeline = Pipeline::find($pipelineId);
                
                if ($pipeline) {
                    if ($pipeline->from === 'S001') $leakLoc = 1;
                    elseif ($pipeline->from === 'S002') $leakLoc = 2;
                    elseif ($pipeline->from === 'S003') $leakLoc = 3;
                    else $leakLoc = 1;
                } else {
                    Log::warning("HitL: Pipeline ID $pipelineId not found in DB. Defaulting loc to 0.");
                }
            }

            // 3. Prepare Row
            $row = [
                $data['f_main'] ?? 0, $data['f_1'] ?? 0, $data['f_2'] ?? 0, $data['f_3'] ?? 0,
                $data['p_main'] ?? 0, $data['p_dma1'] ?? 0, $data['p_dma2'] ?? 0, $data['p_dma3'] ?? 0,
                $data['pump_on'] ?? 1, $data['comp_on'] ?? 0,
                $data['s1'] ?? 0, $data['s2'] ?? 0, $data['s3'] ?? 0,
                $data['solenoid_active'] ?? 0,
                $isLeak,
                $leakLoc
            ];

            // 4. Write to the PRIORITY CSV (With Safety Checks)
            $csvPath = storage_path('app/ml_models/validated_alerts.csv');
            
            if (!file_exists(dirname($csvPath))) mkdir(dirname($csvPath), 0777, true);

            // ✅ ROBUST RETRY LOGIC FOR WINDOWS FILE LOCKING
            $fp = false;
            $attempts = 0;
            
            while (!$fp && $attempts < 10) {
                $fp = @fopen($csvPath, 'a'); // Suppress warning with @
                if (!$fp) {
                    usleep(100000); // Wait 0.1 seconds
                    $attempts++;
                }
            }
            
            if ($fp === false) {
                throw new \Exception("Could not open CSV file. It might be locked by another process.");
            }

            // Add header if new
            if (filesize($csvPath) == 0) {
                fputcsv($fp, [
                    'f_main', 'f_1', 'f_2', 'f_3',
                    'p_main', 'p_dma1', 'p_dma2', 'p_dma3',
                    'pump_on', 'comp_on', 's1', 's2', 's3', 
                    'solenoid_active', 
                    'leak_detected', 'leak_location'
                ]);
            }

            // Write 10 times (Priority)
            if (flock($fp, LOCK_EX)) { 
                for ($i = 0; $i < 10; $i++) { 
                    fputcsv($fp, $row);
                }
                flock($fp, LOCK_UN); 
            } else {
                throw new \Exception("Could not lock file for writing.");
            }
            
            fclose($fp);

            return response()->json(['message' => 'Data labeled and saved successfully.']);

        } catch (\Exception $e) {
            Log::error("🔥 Manual Data Collection Failed: " . $e->getMessage());
            return response()->json(['status' => 'error', 'message' => 'Server Error: ' . $e->getMessage()], 500);
        }
    }
}