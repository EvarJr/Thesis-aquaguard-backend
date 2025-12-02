<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\MlModel;
use App\Models\Sensor;
use App\Models\SensorData;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function downloadAlertsReport()
    {
        // 1. General Stats
        $now = Carbon::now();
        $startOfMonth = $now->copy()->startOfMonth();

        $totalAlerts = Alert::where('created_at', '>=', $startOfMonth)->count();
        $resolvedAlerts = Alert::where('created_at', '>=', $startOfMonth)
                               ->whereNotNull('resolved_at') 
                               ->count();
        $falsePositives = Alert::where('created_at', '>=', $startOfMonth)
                               ->where('false_positive', true)
                               ->count();

        // 2. ML Stats
        $currentModel = MlModel::where('status', 'ACTIVE')->first();
        $trainingHistory = MlModel::orderBy('created_at', 'desc')->get(); 
        $totalSensors = Sensor::count();
        
        // 3. FETCH ALERTS WITH SNAPSHOT DATA
        // We get the last 50 alerts to ensure we catch recent incidents
        $rawAlerts = Alert::with('pipeline')
                             ->orderBy('created_at', 'desc')
                             ->take(50) 
                             ->get();

        // 4. ENHANCE ALERTS DATA (Telemetry & Grouping)
        $pipelineStats = []; // To count leaks per pipeline
        
        $enhancedAlerts = $rawAlerts->map(function ($alert) use (&$pipelineStats) {
            // A. Fetch Snapshot Data (Sensor reading at time of alert)
            // We look for data +/- 10 seconds around the alert
            $snapshot = SensorData::where('created_at', '<=', $alert->created_at->addSeconds(10))
                ->orderBy('created_at', 'desc')
                ->first();

            // Attach data to alert object for the view
            $alert->snapshot_pressure = $snapshot ? round($snapshot->p_main, 2) : 'N/A';
            $alert->snapshot_flow = $snapshot ? round($snapshot->f_main, 2) : 'N/A';
            $alert->status_label = $alert->resolved_at ? 'Resolved' : 'Active';
            
            // B. Build Stats for Charts
            if ($alert->pipeline_id) {
                if (!isset($pipelineStats[$alert->pipeline_id])) {
                    $pipelineStats[$alert->pipeline_id] = 0;
                }
                $pipelineStats[$alert->pipeline_id]++;
            }

            return $alert;
        });

        // 5. Calculate Health Score (Simple Algorithm)
        // Base 100, minus 5 for every active alert, minus 1 for resolved
        $activeCount = $totalAlerts - $resolvedAlerts;
        $healthScore = max(0, 100 - ($activeCount * 5) - ($resolvedAlerts * 1));

        // 6. Prepare Pipeline Distribution for Charts
        // Calculate percentages
        $distribution = [];
        $totalTracked = array_sum($pipelineStats);
        foreach($pipelineStats as $pid => $count) {
            $distribution[] = [
                'name' => $pid,
                'count' => $count,
                'pct' => $totalTracked > 0 ? round(($count / $totalTracked) * 100) : 0
            ];
        }

        $data = [
            'date' => $now->format('F d, Y H:i A'),
            'total_alerts' => $totalAlerts,
            'resolved_alerts' => $resolvedAlerts,
            'false_positives' => $falsePositives,
            'health_score' => $healthScore,
            'current_model_version' => $currentModel ? $currentModel->version : 'N/A',
            'current_accuracy' => $currentModel ? $currentModel->accuracy : 0,
            'trainingHistory' => $trainingHistory,
            'total_sensors' => $totalSensors,
            'alerts' => $enhancedAlerts, // Now includes pressure/flow/accuracy
            'distribution' => $distribution // For the bar charts
        ];

        // 7. Generate PDF
        $pdf = Pdf::loadView('reports.system_report', $data);

        return $pdf->download('AquaGuard_System_Report_' . $now->format('Y-m-d') . '.pdf');
    }
}