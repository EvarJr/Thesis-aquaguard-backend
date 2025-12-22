<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\SensorData;
use App\Models\Pipeline;
use App\Helpers\PipelineMapper; // ✅ Critical Import
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
    
    /**
     * ✅ RESOLVE SINGLE ALERT
     * Updates DB with correct pipeline location AND trains ML.
     */
    public function resolve(Request $request, $id)
    {
        $alert = Alert::findOrFail($id);
        
        // 1. UPDATE DATABASE (The History Fix)
        // If user corrected the location, overwrite the AI's guess in the DB.
        if ($request->has('actual_pipeline_id')) {
            $newPipelineId = $request->input('actual_pipeline_id');
            
            if ($alert->pipeline_id !== $newPipelineId) {
                Log::info("✍️ User corrected Alert #{$id}: {$alert->pipeline_id} -> {$newPipelineId}");
                $alert->pipeline_id = $newPipelineId;
            }
        }

        $alert->resolved_at = now();
        $alert->save(); // ✅ Saves the CORRECT location to the DB

        // 2. UPDATE TRAINING DATA (The Learning Fix)
        // Pass the corrected ID to the reinforce function
        $this->reinforceModel($alert, true, $alert->pipeline_id);

        return response()->json(['message' => 'Alert resolved, location updated, and ML reinforced']);
    }

    /**
     * ✅ RESOLVE GROUP (Bulk Action)
     * Handles "Resolve All" button
     */
    public function resolveGroup(Request $request)
    {
        // 1. Validate Input
        $request->validate([
            'alert_ids' => 'required|array',
            'alert_ids.*' => 'exists:alerts,id'
        ]);

        $ids = $request->input('alert_ids');
        $pipelineId = $request->input('actual_pipeline_id'); // Optional correction

        // 2. Mark ALL as resolved in DB
        // If pipeline is corrected, update ALL records in this group to the correct pipe
        $updateData = ['resolved_at' => now()];
        if ($pipelineId) {
            $updateData['pipeline_id'] = $pipelineId;
        }

        Alert::whereIn('id', $ids)->update($updateData);

        // 3. Train ML on the LATEST alert only (Representative of the incident)
        $latestAlert = Alert::whereIn('id', $ids)->latest('created_at')->first();
        
        if ($latestAlert) {
            // If user corrected pipeline, ensure we pass that to the trainer
            $pId = $pipelineId ?? $latestAlert->pipeline_id;
            $this->reinforceModel($latestAlert, true, $pId);
        }

        return response()->json(['message' => 'Group resolved and location corrected.']);
    }

    /**
     * ✅ MARK FALSE SINGLE
     */
    public function markAsFalse($id)
    {
        $alert = Alert::findOrFail($id);
        $alert->resolved_at = now();
        $alert->false_positive = true;
        $alert->save();

        // False alert = No leak (Location 0)
        $this->reinforceModel($alert, false, null);

        return response()->json(['message' => 'Marked as false positive']);
    }

    /**
     * ✅ MARK FALSE GROUP (Bulk Action)
     * Handles "False All" button
     */
    public function markFalseGroup(Request $request)
    {
        $request->validate([
            'alert_ids' => 'required|array',
            'alert_ids.*' => 'exists:alerts,id'
        ]);

        $ids = $request->input('alert_ids');

        // 1. Update Database
        Alert::whereIn('id', $ids)->update([
            'resolved_at' => now(), 
            'false_positive' => true
        ]);
        
        // 2. Train ML (only once, using the latest alert as the example)
        $latestAlert = Alert::whereIn('id', $ids)->latest('created_at')->first();
        
        if ($latestAlert) {
            // "False Positive" means the data was SAFE (No Leak)
            $this->reinforceModel($latestAlert, false, null);
        }

        return response()->json(['message' => 'Group marked as false positive.']);
    }

    /**
     * 🧠 HITL LOGIC
     */
    private function reinforceModel($alert, $isRealLeak, $correctedPipelineId = null)
    {
        $csvPath = storage_path('app/ml_models/validated_alerts.csv');
        Log::info("🧠 HITL: Processing Alert ID: {$alert->id}");

        try {
            // 1. Find Sensor Data (with 10s buffer)
            $data = SensorData::where('created_at', '<=', $alert->created_at->addSeconds(10))
                              ->orderBy('created_at', 'desc')
                              ->first();
            
            // Fallback if exact match missing
            if (!$data) $data = SensorData::latest()->first();
            if (!$data) return;

            // 2. Prepare Labels
            $leakDetected = $isRealLeak ? 1 : 0;
            $locationLabel = 0;

            if ($isRealLeak) {
                // ✅ CRITICAL: Use the corrected ID if passed, otherwise use alert's ID
                $targetPId = $correctedPipelineId ?? $alert->pipeline_id;
                
                // ✅ USE PIPELINE MAPPER: Convert String "P009" -> Integer "3"
                $locationLabel = PipelineMapper::getLabel($targetPId);
            }

            // 3. Prepare CSV Row
            $row = [
                $data->f_main ?? 0, $data->f_1 ?? 0, $data->f_2 ?? 0, $data->f_3 ?? 0,
                $data->p_main ?? 0, $data->p_dma1 ?? 0, $data->p_dma2 ?? 0, $data->p_dma3 ?? 0,
                $data->pump_on ?? 1, $data->comp_on ?? 0,
                $data->s1 ?? 0, $data->s2 ?? 0, $data->s3 ?? 0,
                $data->solenoid_active ?? 0,
                $leakDetected,
                $locationLabel
            ];

            // 4. Write to File (Robust)
            if (!file_exists(dirname($csvPath))) mkdir(dirname($csvPath), 0777, true);
            
            $fp = @fopen($csvPath, 'a');
            
            if ($fp) {
                if (filesize($csvPath) == 0) {
                    fputcsv($fp, ['f_main','f_1','f_2','f_3','p_main','p_dma1','p_dma2','p_dma3','pump_on','comp_on','s1','s2','s3','solenoid_active','leak_detected','leak_location']);
                }
                
                // Write 10 times for priority (Oversampling)
                if (flock($fp, LOCK_EX)) { 
                    for ($i = 0; $i < 10; $i++) fputcsv($fp, $row);
                    flock($fp, LOCK_UN); 
                }
                fclose($fp);
                
                Log::info("✅ HITL SUCCESS: Wrote 10 rows. Label: $locationLabel (Pipe: " . ($correctedPipelineId ?? 'None') . ")");
            } else {
                 Log::error("❌ HITL FAILED: Could not open CSV.");
            }

        } catch (\Exception $e) {
            Log::error("🔥 HITL EXCEPTION: " . $e->getMessage());
        }
    }
}