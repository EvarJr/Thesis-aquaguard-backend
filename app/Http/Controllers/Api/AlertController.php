<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\SensorData;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AlertController extends Controller
{
    public function index(Request $request)
    {
        if ($request->query('all')) {
            return Alert::latest('created_at')->get();
        }
        return Alert::whereNull('resolved_at')->latest('created_at')->get();
    }
    
    public function resolve(Alert $alert)
    {
        $alert->resolved_at = now();
        $alert->save();
        $this->reinforceModel($alert, isRealLeak: true);
        return response()->json(['message' => 'Alert resolved and ML reinforced']);
    }

    public function markAsFalse(Alert $alert)
    {
        $alert->resolved_at = now();
        $alert->false_positive = true;
        $alert->save();
        $this->reinforceModel($alert, isRealLeak: false);
        return response()->json(['message' => 'Marked as false positive and ML corrected']);
    }

    /**
     * 🧠 HITL: Writes to a SEPARATE file to avoid locking.
     */
    private function reinforceModel($alert, $isRealLeak)
    {
        // ✅ NEW FILENAME: validated_alerts.csv
        $csvPath = storage_path('app/ml_models/validated_alerts.csv');
        Log::info("🧠 HITL: New Logic Starting for Alert ID: {$alert->id}");

        try {
            // 1. Find Sensor Data
            $data = SensorData::where('created_at', '<=', $alert->created_at->addSeconds(10))
                              ->orderBy('created_at', 'desc')
                              ->first();

            if (!$data) {
                $data = SensorData::latest()->first();
                Log::warning("⚠️ HITL: Using latest sensor data as fallback.");
            }

            if (!$data) {
                Log::error("❌ HITL FAILED: No SensorData found.");
                return;
            }

            // 2. Prepare Labels
            $leakDetected = $isRealLeak ? 1 : 0;
            $locationLabel = 0;
            if ($isRealLeak) {
                $locMap = ['S001' => 1, 'MASTER_NODE' => 1, 'S002' => 2, 'S003' => 3];
                $locationLabel = $locMap[$alert->sensor_id] ?? 0;
            }

            // 3. Prepare Data
            $row = [
                $data->f_main ?? 0, $data->f_1 ?? 0, $data->f_2 ?? 0, $data->f_3 ?? 0,
                $data->p_main ?? 0, $data->p_dma1 ?? 0, $data->p_dma2 ?? 0, $data->p_dma3 ?? 0,
                $data->pump_on ?? 1, $data->comp_on ?? 0,
                $data->s1 ?? 0, $data->s2 ?? 0, $data->s3 ?? 0,
                $data->solenoid_active ?? 0,
                $leakDetected,
                $locationLabel
            ];

            // 4. Write to SEPARATE File (No retry loop needed, no locking issues)
            if (!file_exists(dirname($csvPath))) mkdir(dirname($csvPath), 0777, true);

            $file = fopen($csvPath, 'a');

            // If file is brand new, add headers
            if (filesize($csvPath) == 0) {
                fputcsv($file, [
                    'f_main', 'f_1', 'f_2', 'f_3',
                    'p_main', 'p_dma1', 'p_dma2', 'p_dma3',
                    'pump_on', 'comp_on', 's1', 's2', 's3', 
                    'solenoid_active', 
                    'leak_detected', 'leak_location'
                ]);
            }

            // Write 10 copies
            for ($i = 0; $i < 10; $i++) { 
                fputcsv($file, $row);
            }
            
            fclose($file);
            
            // ✅ LOOK FOR THIS SPECIFIC MESSAGE IN YOUR LOGS
            Log::info("✅ HITL SUCCESS: Created/Updated validated_alerts.csv for Alert #{$alert->id}");

        } catch (\Exception $e) {
            Log::error("🔥 HITL EXCEPTION: " . $e->getMessage());
        }
    }
}