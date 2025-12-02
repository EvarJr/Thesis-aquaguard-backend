<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\Alert;
use App\Models\SensorData;

class AnalysisController extends Controller
{
    public function generate(Request $request)
    {
        // 1. Gather Data
        $activeAlerts = Alert::whereNull('resolved_at')->count();
        $latestData = SensorData::latest()->first();
        
        $pressure = $latestData ? round($latestData->p_main, 2) : 0;
        $flow = $latestData ? round($latestData->f_main, 2) : 0;
        
        // 2. Build Prompt
        $systemState = $activeAlerts > 0 ? "CRITICAL" : "STABLE";
        $prompt = "You are AquaGuard AI. Analyze this water system telemetry:
        - Status: $systemState
        - Active Leaks: $activeAlerts
        - Pressure: $pressure PSI
        - Flow: $flow L/m.
        Write a professional 1-sentence summary for the dashboard admin. Do not use markdown.";

        try {
            $apiKey = env('GEMINI_API_KEY');
            
            if (empty($apiKey)) {
                throw new \Exception("API Key missing");
            }

            // ✅ FIX: Using 'gemini-2.0-flash' which exists in your list
            $model = 'gemini-2.0-flash';
            
            $response = Http::withoutVerifying()
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}", [
                    "contents" => [[
                        "parts" => [["text" => $prompt]]
                    ]]
                ]);

            if ($response->failed()) {
                Log::error("Gemini API Error: " . $response->body());
                throw new \Exception("Google API Error: " . $response->status());
            }

            $json = $response->json();
            $analysisText = $json['candidates'][0]['content']['parts'][0]['text'] ?? "System monitoring active.";

            return response()->json([
                'status' => 'success',
                'analysis' => $analysisText,
                'timestamp' => now()->toDateTimeString()
            ]);

        } catch (\Exception $e) {
            Log::error("Gemini Exception: " . $e->getMessage());
            return response()->json([
                'status' => 'error',
                'analysis' => "AI service currently unreachable. System monitoring continues normally.",
                'timestamp' => now()->toDateTimeString()
            ]);
        }
    }
}