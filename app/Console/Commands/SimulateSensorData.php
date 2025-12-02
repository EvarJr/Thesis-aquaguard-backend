<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\SensorData;
use App\Models\Alert;
use App\Models\Sensor;
use App\Models\Pipeline;
use App\Events\SensorUpdated;
use App\Events\LeakDetected;

class SimulateSensorData extends Command
{
    /**
     * The name and signature of the console command.
     * Usage: php artisan simulate:sensor --count=5 --interval=2
     */
    protected $signature = 'simulate:sensor {--count=10 : Number of readings to generate} {--interval=2 : Seconds between readings}';

    /**
     * The console command description.
     */
    protected $description = 'Simulate sensor data flow to test Dashboard, Map, and ML Training';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $count = $this->option('count');
        $interval = $this->option('interval');

        $this->info("🚀 Starting Simulation: Generating {$count} readings...");

        // 1. Find a REAL Sensor and Pipeline to target
        // This ensures the Map knows exactly which pipe to turn RED.
        $targetSensor = Sensor::first();
        
        if (!$targetSensor) {
            $this->error("❌ No sensors found! Please create a sensor in the Management page first.");
            return;
        }

        // Find a pipeline connected to this sensor
        $targetPipeline = Pipeline::where('from', $targetSensor->id)
            ->orWhere('to', $targetSensor->id)
            ->first();

        if (!$targetPipeline) {
            $this->error("❌ Sensor {$targetSensor->id} has no pipelines! Please connect it in the Map first.");
            return;
        }

        $this->info("🎯 Targeting Sensor: {$targetSensor->id}");
        $this->info("🔥 Targeting Pipeline: {$targetPipeline->id} (This should turn RED)");

        for ($i = 1; $i <= $count; $i++) {
            // 2. Simulate Data (High Flow + Low Pressure = Leak)
            $pressure = rand(200, 300) / 10; // Low: 20-30 PSI
            $flow = rand(130, 150);          // High: 130-150 L/min

            $data = [
                'f_main' => $flow,
                'p_main' => $pressure,
                // Fill noise data for other fields
                'f_1' => rand(10, 20), 'f_2' => rand(10, 20), 'f_3' => rand(10, 20),
                'p_dma1' => rand(40, 50), 'p_dma2' => rand(40, 50), 'p_dma3' => rand(40, 50),
                'pump_on' => 1, 'comp_on' => 0, 
                's1' => 0, 's2' => 0, 's3' => 0
            ];

            // 3. Save to DB (History)
            SensorData::create($data);

            // 4. Broadcast to Dashboard (Charts move)
            broadcast(new SensorUpdated([
                'timestamp' => now()->toDateTimeString(),
                'pressure'  => $pressure,
                'flowRate'  => $flow,
                'sensorId'  => $targetSensor->id
            ]));

            // 5. Trigger Leak Alert (Map turns Red)
            // ✅ FIX 1: Generate a manual ID string
            $alertId = 'ALT-' . rand(10000, 99999);

            $alert = Alert::create([
                'id' => $alertId, 
                
                // ✅ FIX 2: Use snake_case to match your database columns
                'sensor_id'   => $targetSensor->id,   
                'pipeline_id' => $targetPipeline->id, 
                
                'message'     => "🚨 SIMULATED LEAK: Pipeline {$targetPipeline->id}",
                'severity'    => 'Critical',
                'created_at'  => now()
            ]);
            
            // Broadcast the event so the frontend receives it
            broadcast(new LeakDetected($alert));
            
            $this->line("[$i/$count] 📡 Data Sent | 🚨 Alert Broadcasted: {$alertId} for {$targetPipeline->id}");
            
            // 6. Save to CSV (For ML Retraining)
            $this->appendToCsv($data, 1, 0); // 1 = Leak Detected

            sleep($interval);
        }

        $this->info("✅ Simulation Complete.");
    }

    /**
     * Helper to save data to CSV for ML Training
     */
    private function appendToCsv($data, $isLeak, $leakLocation)
    {
        $filePath = storage_path('app/ml_models/pipeline_sensor_data.csv');
        
        // Create directory if missing
        if (!file_exists(dirname($filePath))) mkdir(dirname($filePath), 0777, true);
        
        $isNewFile = !file_exists($filePath);
        $file = fopen($filePath, 'a');
        
        // Add Header if new
        if ($isNewFile) {
            fputcsv($file, ['f_main', 'f_1', 'f_2', 'f_3', 'p_main', 'p_dma1', 'p_dma2', 'p_dma3', 'pump_on', 'comp_on', 's1', 's2', 's3', 'leak_detected', 'leak_location']);
        }

        $row = [
            $data['f_main'], $data['f_1'], $data['f_2'], $data['f_3'],
            $data['p_main'], $data['p_dma1'], $data['p_dma2'], $data['p_dma3'],
            $data['pump_on'], $data['comp_on'], $data['s1'], $data['s2'], $data['s3'],
            $isLeak, 
            $leakLocation
        ];
        
        fputcsv($file, $row);
        fclose($file);
    }
}