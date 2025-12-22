<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SensorData;
use App\Models\Alert;
use App\Models\MLModel;
use App\Models\Pipeline;
use App\Models\SystemSetting;
use App\Helpers\PipelineMapper; // ✅ Critical Import
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;
use App\Events\LeakDetected;
use App\Events\SensorUpdated;

class SensorDataController extends Controller
{
    public function index()
    {
        return SensorData::latest()->take(50)->get();
    }

    public function store(Request $request)
    {
        $data = [];
        $isEncrypted = false;

        // 1. DECRYPTION (If applicable)
        $cipherHex = $request->input('ciphertext') ?? $request->input('cipher');
        $nonce = $request->input('nonce');

        if ($cipherHex && $nonce) {
            $isEncrypted = true;
            try {
                $keyHex = 'A9F1C43E92ABCDEF76881244B35A9DEE'; 
                $key = hex2bin(str_replace(' ', '', $keyHex));

                $plaintext = $this->simon_decrypt_ctr($cipherHex, $nonce, $key);
                $data = json_decode($plaintext, true);

                if (!$data) {
                    Log::error('❌ Decryption invalid JSON', ['plaintext' => $plaintext]);
                    return response()->json(['error' => 'Decryption failed'], 400);
                }
            } catch (\Exception $e) {
                return response()->json(['error' => 'Decryption error'], 400);
            }
        } else {
            $data = $request->all();
            if (!isset($data['f_main'])) {
                return response()->json(['error' => 'Invalid data format.'], 400);
            }
        }

        // 2. 🧠 RUN ML MODEL FIRST (Synchronous)
        // We get the prediction BEFORE saving to DB
        $mlResult = $this->getPredictionFromPython($data);

        $finalIsLeak = $mlResult['leak_detected'];
        $finalLocation = $mlResult['leak_location'];
        $accuracy = $mlResult['confidence'];

        // 3. SAVE TO DATABASE (With ML Validation)
        try {
            $record = SensorData::create([
                'f_main'   => $data['f_main'] ?? 0,
                'f_1'      => $data['f_1'] ?? 0,
                'f_2'      => $data['f_2'] ?? 0,
                'f_3'      => $data['f_3'] ?? 0,
                'p_main'   => $data['p_main'] ?? 0,
                'p_dma1'   => $data['p_dma1'] ?? 0,
                'p_dma2'   => $data['p_dma2'] ?? 0,
                'p_dma3'   => $data['p_dma3'] ?? 0, 
                'pump_on'  => $data['pump_on'] ?? 0,
                'comp_on'  => $data['comp_on'] ?? 0,
                's1'       => $data['s1'] ?? 0,
                's2'       => $data['s2'] ?? 0,
                's3'       => $data['s3'] ?? 0,
                'solenoid_active' => $data['solenoid_active'] ?? 0, 
                
                // ✅ SAVE PREDICTED VALUES
                'is_leak'       => $finalIsLeak,
                'leak_location' => $finalLocation,
                
                // Store metadata
                'details'       => json_encode(['ml_accuracy' => $accuracy])
            ]);
            
        } catch (\Exception $e) {
            Log::error('🔥 DB Save Failed: ' . $e->getMessage());
            return response()->json(['error' => 'Database Error'], 500);
        }
    
        // 4. BROADCAST (Charts)
        $chartData = array_merge($data, [
            'timestamp' => now()->toDateTimeString(),
            'sensorId'  => 'S001',
            'is_leak'   => $finalIsLeak // Send status to UI immediately
        ]);
        broadcast(new SensorUpdated($chartData));

        // 5. CREATE ALERT (If Leak)
        if ($finalIsLeak == 1) {
            $this->createAlert($finalLocation, $accuracy);
        }

        // 6. SAVE TO CSV (For Training)
        // Use simulated truth if available, otherwise use ML result
        $truthLeak = $data['simulated_leak'] ?? $finalIsLeak;
        $truthLoc = $data['simulated_location'] ?? $finalLocation;
        
        $csvPath = storage_path('app/ml_models/pipeline_sensor_data.csv');
        $this->appendToCsv($csvPath, $data, $truthLeak, $truthLoc);
        
        // 7. AUTO TRAIN CHECK
        $this->checkAutoTrainThreshold($csvPath);

        return response()->json([
            'status' => 'success',
            'id' => $record->id,
            'ml_leak_detected' => (bool)$finalIsLeak
        ]);
    }

    // ======================================================
    // 🧠 ML HELPER FUNCTIONS
    // ======================================================

    private function getPredictionFromPython($data)
    {
        $activeModel = MLModel::where('status', 'ACTIVE')->first();
        $result = ['leak_detected' => 0, 'leak_location' => 0, 'confidence' => 0];

        // If manual override exists in data, trust it (for testing)
        if (isset($data['simulated_leak']) && $data['simulated_leak'] == 1) {
             return [
                 'leak_detected' => 1, 
                 'leak_location' => $data['simulated_location'] ?? 0, 
                 'confidence' => 100
             ];
        }

        if (!$activeModel) return $result;

        $inputData = json_encode($data);
        $isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
        $pythonExe = base_path($isWindows ? 'venv\Scripts\python.exe' : 'venv/bin/python');
        $pythonScript = base_path('app/ml/predict_leak.py'); 

        if (!file_exists($pythonScript)) return $result;

        try {
            $process = new Process([
                $pythonExe, 
                $pythonScript,
                '--detect', base_path($activeModel->file_path_detect),
                '--locate', base_path($activeModel->file_path_locate),
                '--features', base_path($activeModel->file_path_features),
                '--input', $inputData,
            ]);
            
            $process->setEnv(['SystemRoot' => getenv('SystemRoot'), 'PATH' => getenv('PATH'), 'TEMP' => getenv('TEMP')]);
            $process->setTimeout(10);
            $process->run();

            if ($process->isSuccessful()) {
                $output = json_decode($process->getOutput(), true);
                if ($output) {
                    $result['leak_detected'] = $output['leak_detected'] ?? 0;
                    $result['leak_location'] = $output['leak_location'] ?? 0;
                    $result['confidence'] = $output['confidence'] ?? 0;
                }
            }
        } catch (\Exception $e) {
            Log::error('ML Prediction Error: ' . $e->getMessage());
        }

        return $result;
    }

    private function createAlert($locationInt, $accuracy)
    {
        // ✅ FIX: Use Dynamic Mapping (Integer -> String ID)
        $realPipelineId = PipelineMapper::getIdFromLabel($locationInt);
        
        // Find corresponding sensor
        $targetSensorId = 'S001'; // Default
        if ($realPipelineId) {
            $pipe = Pipeline::find($realPipelineId);
            if ($pipe) $targetSensorId = $pipe->from;
        }

        // Prevent Duplicate Alerts (Spam protection)
        $exists = Alert::where('pipeline_id', $realPipelineId)
                       ->whereNull('resolved_at')
                       ->where('created_at', '>', now()->subMinutes(1))
                       ->exists();

        if (!$exists) {
            $alert = Alert::create([
                'sensor_id'     => $targetSensorId,
                'pipeline_id'   => $realPipelineId, // Saves P009, not "3"
                'message'       => '🚨 Possible leak detected by ML model',
                'severity'      => 'Critical',
                'accuracy'      => $accuracy,
                'false_positive'=> false,
            ]);
            
            broadcast(new LeakDetected($alert));
            Log::info("📡 Alert Created: Pipeline $realPipelineId");
        }
    }

    private function appendToCsv($filePath, $data, $isLeak, $leakLocation)
    {
        if (!file_exists(dirname($filePath))) mkdir(dirname($filePath), 0777, true);
        
        $fp = false;
        $attempts = 0;
        // Robust File Locking for Windows
        while (!$fp && $attempts < 10) { 
            $fp = @fopen($filePath, 'a'); 
            if (!$fp) { usleep(100000); $attempts++; } 
        }

        if ($fp) {
            if (filesize($filePath) == 0) {
                fputcsv($fp, ['f_main', 'f_1', 'f_2', 'f_3', 'p_main', 'p_dma1', 'p_dma2', 'p_dma3', 'pump_on', 'comp_on', 's1', 's2', 's3', 'solenoid_active', 'leak_detected', 'leak_location']);
            }
            if (flock($fp, LOCK_EX)) {
                fputcsv($fp, [
                    $data['f_main'] ?? 0, $data['f_1'] ?? 0, $data['f_2'] ?? 0, $data['f_3'] ?? 0,
                    $data['p_main'] ?? 0, $data['p_dma1'] ?? 0, $data['p_dma2'] ?? 0, $data['p_dma3'] ?? 0,
                    $data['pump_on'] ?? 0, $data['comp_on'] ?? 0,
                    $data['s1'] ?? 0, $data['s2'] ?? 0, $data['s3'] ?? 0,
                    $data['solenoid_active'] ?? 0, 
                    $isLeak, $leakLocation
                ]);
                flock($fp, LOCK_UN);
            }
            fclose($fp);
        }
    }

    private function checkAutoTrainThreshold($csvPath) {
        if (!file_exists($csvPath)) return;
        // Optimization: Only check line count 10% of the time to save IO
        if (rand(1, 10) !== 1) return;
        try {
            $target = (int) (SystemSetting::where('key', 'training_target')->value('value') ?? 100);
            $mode = SystemSetting::where('key', 'training_mode')->value('value') ?? 'manual';
            if ($mode === 'auto') {
                $lineCount = count(file($csvPath));
                if ($lineCount >= $target) {
                    $isTraining = MLModel::where('status', 'TRAINING')->exists();
                    if (!$isTraining) {
                        Log::info("🤖 Auto-Triggering ML Training");
                        $controller = new \App\Http\Controllers\Api\MlModelController();
                        $controller->executeRetraining('Automatic Threshold');
                    }
                }
            }
        } catch (\Exception $e) {}
    }

    private function simon_decrypt_ctr($cipherHex, $nonce, $key) {
        $cipherBytes = hex2bin($cipherHex); $len = strlen($cipherBytes);
        $nonceBytes = pack('P', intval($nonce)); $ctrBlock = $nonceBytes . str_repeat("\0", 8); 
        $pt = '';
        for ($offset = 0; $offset < $len; $offset += 16) {
            $keystream = $this->simon_block_encrypt($ctrBlock, $key);
            $blockLen = min(16, $len - $offset);
            $cipherChunk = substr($cipherBytes, $offset, $blockLen);
            $pt .= $cipherChunk ^ substr($keystream, 0, $blockLen);
            $ctrBlock = $this->increment_ctr_byte_array($ctrBlock);
        }
        return $pt;
    }
    private function simon_block_encrypt($block, $key) {
        $res = ''; $keyLen = strlen($key);
        for ($i = 0; $i < 16; $i++) {
            $k = ord($key[$i % $keyLen]); $b = ord($block[$i]); $res .= chr($b ^ $k);
        }
        return $res;
    }
    private function increment_ctr_byte_array($ctrBlock) {
        $bytes = array_values(unpack('C*', $ctrBlock));
        for ($i = 0; $i < 16; $i++) { $bytes[$i]++; if ($bytes[$i] <= 255) { break; } $bytes[$i] = 0; }
        return pack('C*', ...$bytes);
    }
}