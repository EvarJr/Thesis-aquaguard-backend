<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SensorData;
use App\Models\Alert;
use App\Models\MLModel;
use App\Models\SystemSetting;
use App\Models\Pipeline;
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

        // 2. CHECK FOR ENCRYPTION (Supports 'ciphertext' or 'cipher')
        $cipherHex = $request->input('ciphertext') ?? $request->input('cipher');
        $nonce = $request->input('nonce');

        if ($cipherHex && $nonce) {
            $isEncrypted = true;
            // file_put_contents($debugFile, "[$timestamp] 2. Decrypting...\n", FILE_APPEND);

            try {
                // 🔐 KEY MUST MATCH ESP32 CONFIG.H EXACTLY (16 bytes / 32 hex chars)
                $keyHex = 'A9F1C43E92ABCDEF76881244B35A9DEE'; 
                $key = hex2bin(str_replace(' ', '', $keyHex));

                // Perform Decryption
                $plaintext = $this->simon_decrypt_ctr($cipherHex, $nonce, $key);
                
                // Log the result to verify it's not garbage
                // file_put_contents($debugFile, "[$timestamp] 🔓 Decrypted: $plaintext\n", FILE_APPEND);

                $data = json_decode($plaintext, true);

                if (!$data) {
                    file_put_contents($debugFile, "[$timestamp] ❌ Error: Decryption produced invalid JSON.\n", FILE_APPEND);
                    Log::error('❌ Decryption invalid JSON', ['plaintext' => $plaintext]);
                    return response()->json(['error' => 'Decryption failed - Invalid JSON'], 400);
                }
            } catch (\Exception $e) {
                file_put_contents($debugFile, "[$timestamp] ❌ Exception: " . $e->getMessage() . "\n", FILE_APPEND);
                Log::error('❌ Decryption Exception: ' . $e->getMessage());
                return response()->json(['error' => 'Decryption error'], 400);
            }
        } else {
            // file_put_contents($debugFile, "[$timestamp] 2. Processing Plain JSON...\n", FILE_APPEND);
            $data = $request->all();
            
            if (!isset($data['f_main']) && !isset($data['p_main'])) {
                file_put_contents($debugFile, "[$timestamp] ❌ Error: Missing sensor data fields.\n", FILE_APPEND);
                return response()->json(['error' => 'Invalid data format.'], 400);
            }
        }

        // 3. SAVE TO DATABASE
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
            ]);
            // file_put_contents($debugFile, "[$timestamp] ✅ SUCCESS: Saved to DB (ID: " . $record->id . ")\n", FILE_APPEND);
            Log::info('✅ Data Saved. ID: ' . $record->id);
        } catch (\Exception $e) {
            file_put_contents($debugFile, "[$timestamp] 🔥 DB FAIL: " . $e->getMessage() . "\n", FILE_APPEND);
            Log::error('🔥 DB Save Failed: ' . $e->getMessage());
            return response()->json(['error' => 'Database Error'], 500);
        }
    
        // 4. BROADCAST REAL-TIME DATA
        $chartData = array_merge($data, [
            'timestamp' => now()->toDateTimeString(),
            'sensorId'  => 'S001' 
        ]);
        broadcast(new SensorUpdated($chartData));

        // 5. ML PREDICTION
        $isLeak = 0;
        $leakLocation = 0;
        $this->runLeakDetection($data, $isLeak, $leakLocation);

        // 6. HANDLE SIMULATED LEAKS (For Training)
        if ($request->has('simulated_leak') && $request->input('simulated_leak') == 1) {
            $isLeak = 1;
            $leakLocation = $request->input('simulated_location') ?? 0;
        }

        // 7. SAVE TO CSV (For Auto-Training)
        $csvPath = storage_path('app/ml_models/pipeline_sensor_data.csv');
        $this->appendToCsv($csvPath, $data, $isLeak, $leakLocation);
        
        // 8. TRIGGER RETRAINING IF THRESHOLD MET
        $this->checkAutoTrainThreshold($csvPath);

        return response()->json([
            'status' => 'success',
            'id' => $record->id,
            'ml_leak_detected' => (bool)$isLeak
        ]);
    }

    // ======================================================
    // 🛠 HELPER FUNCTIONS
    // ======================================================

    private function runLeakDetection($data, &$isLeak, &$leakLocation)
    {
        $activeModel = MLModel::where('status', 'ACTIVE')->first();
        if (!$activeModel) return;

        $inputData = json_encode($data);
        // Auto-detect OS for Python path
        $isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
        $pythonExe = base_path($isWindows ? 'venv\Scripts\python.exe' : 'venv/bin/python');
        $pythonScript = base_path('app/ml/predict_leak.py'); 

        if (!file_exists($pythonScript)) return;

        try {
            $process = new Process([
                $pythonExe, 
                $pythonScript,
                '--detect', base_path($activeModel->file_path_detect),
                '--locate', base_path($activeModel->file_path_locate),
                '--features', base_path($activeModel->file_path_features),
                '--input', $inputData,
            ]);
            
            // Pass Env Vars for Windows
            $process->setEnv(['SystemRoot' => getenv('SystemRoot'), 'PATH' => getenv('PATH'), 'TEMP' => getenv('TEMP')]);
            $process->setTimeout(20);
            $process->run();

            if (!$process->isSuccessful()) {
                Log::error('❌ ML Crash: ' . $process->getErrorOutput());
                return;
            }

            $output = json_decode($process->getOutput(), true);

            if (isset($output['leak_detected']) && $output['leak_detected'] == 1) {
                $isLeak = 1;
                $leakLocation = $output['leak_location'] ?? 0;
                $accuracy = $output['confidence'] ?? 0;

                // Map Location -> Sensor -> Pipeline
                $sensorMap = [1 => 'S001', 2 => 'S002', 3 => 'S003'];
                $targetSensorId = $sensorMap[$leakLocation] ?? 'S001';

                $affectedPipeline = Pipeline::where('from', $targetSensorId)->first();
                $realPipelineId = $affectedPipeline ? $affectedPipeline->id : null;

                Log::warning("🚨 LEAK DETECTED at $targetSensorId. Pipe: " . ($realPipelineId ?? 'Unknown'));

                $alert = Alert::create([
                    'sensor_id'     => $output['sensor_id'] ?? $targetSensorId,
                    'pipeline_id'   => $realPipelineId,
                    'message'       => '🚨 Possible leak detected by ML model',
                    'severity'      => 'Critical',
                    'accuracy'      => $accuracy,
                    'false_positive'=> false,
                ]);
                
                // Use broadcastNow for instant alerts
                broadcast(new LeakDetected($alert));
            }

        } catch (\Exception $e) {
            Log::error('🔥 ML Exception: ' . $e->getMessage());
        }
    }

    private function appendToCsv($filePath, $data, $isLeak, $leakLocation)
    {
        if (!file_exists(dirname($filePath))) mkdir(dirname($filePath), 0777, true);
        
        $fp = false;
        $attempts = 0;
        
        // Retry loop for Windows file locking
        while (!$fp && $attempts < 20) {
            $fp = @fopen($filePath, 'a'); 
            if (!$fp) {
                usleep(rand(50000, 200000));
                $attempts++;
            }
        }

        if ($fp) {
            if (filesize($filePath) == 0) {
                fputcsv($fp, [
                    'f_main', 'f_1', 'f_2', 'f_3',
                    'p_main', 'p_dma1', 'p_dma2', 'p_dma3',
                    'pump_on', 'comp_on', 's1', 's2', 's3', 
                    'solenoid_active', 
                    'leak_detected', 'leak_location'
                ]);
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

    private function checkAutoTrainThreshold($csvPath)
    {
        if (!file_exists($csvPath)) return;
        if (rand(1, 10) !== 1) return; // Optimization: Only check 10% of the time

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

    // ======================================================
    // 🔐 ENCRYPTION HELPERS (FIXED)
    // ======================================================

    private function simon_decrypt_ctr($cipherHex, $nonce, $key) {
        $cipherBytes = hex2bin($cipherHex);
        $len = strlen($cipherBytes);
        
        // 1. Setup Counter Block (16 bytes)
        // C++: Nonce in first 8 bytes (Little Endian), Counter in last 8 bytes
        $nonceBytes = pack('P', intval($nonce)); 
        $ctrBlock = $nonceBytes . str_repeat("\0", 8); 

        $pt = '';
        
        // 2. Process Blocks
        for ($offset = 0; $offset < $len; $offset += 16) {
            // Encrypt Counter to get Keystream
            $keystream = $this->simon_block_encrypt($ctrBlock, $key);
            
            // XOR
            $blockLen = min(16, $len - $offset);
            $cipherChunk = substr($cipherBytes, $offset, $blockLen);
            $pt .= $cipherChunk ^ substr($keystream, 0, $blockLen);
            
            // Increment Counter
            $ctrBlock = $this->increment_ctr_byte_array($ctrBlock);
        }
        
        return $pt;
    }

    // Matches C++ simple_block_xor logic
    private function simon_block_encrypt($block, $key) {
        $res = '';
        $keyLen = strlen($key);
        for ($i = 0; $i < 16; $i++) {
            $k = ord($key[$i % $keyLen]);
            $b = ord($block[$i]);
            $res .= chr($b ^ $k); // Simple XOR block cipher
        }
        return $res;
    }

    // Matches C++ increment_ctr logic
    private function increment_ctr_byte_array($ctrBlock) {
        $bytes = array_values(unpack('C*', $ctrBlock));
        
        // Iterate through all 16 bytes
        for ($i = 0; $i < 16; $i++) {
            $bytes[$i]++;
            if ($bytes[$i] <= 255) {
                break; // No overflow, stop
            }
            $bytes[$i] = 0; // Overflow, carry
        }
        
        return pack('C*', ...$bytes);
    }
}