<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pipeline;
use Illuminate\Http\Request;

class PipelineController extends Controller
{
    public function index()
    {
        return Pipeline::all();
    }

    public function store(Request $request)
        {
            $validated = $request->validate([
                'from' => 'required|string|max:10',
                'to'   => 'required|string|max:10|different:from',
            ]);

            // Check for duplicates (Bidirectional)
            $exists = Pipeline::where(function ($query) use ($validated) {
                $query->where('from', $validated['from'])->where('to', $validated['to']);
            })->orWhere(function ($query) use ($validated) {
                $query->where('from', $validated['to'])->where('to', $validated['from']);
            })->exists();

            if ($exists) {
                // Return a specific message for duplicates
                return response()->json(['message' => 'Connection already exists.'], 409);
            }

            // 3. Standardized ID Generation (3 Digits)
            $lastPipeline = Pipeline::orderByRaw('LENGTH(id) DESC, id DESC')->first();
            $nextIdNumber = $lastPipeline ? (int) substr($lastPipeline->id, 1) + 1 : 1;
            
            // ✅ CHANGED: 2 -> 3. Now generates P001, P002... matches SensorController
            $newId = 'P' . str_pad($nextIdNumber, 3, '0', STR_PAD_LEFT);

            $pipeline = Pipeline::create([
                'id'   => $newId,
                'from' => $validated['from'],
                'to'   => $validated['to'],
                'joints' => json_encode([]),
            ]);

            return response()->json($pipeline, 201);
        }

    public function update(Request $request, $id)
    {
        $pipeline = Pipeline::findOrFail($id);

        // Handle Joints
        if ($request->has('joints')) {
            $joints = $request->joints;
            // Force array to JSON string
            $pipeline->joints = is_array($joints) ? json_encode($joints) : $joints;
            $pipeline->save();
        }

        return response()->json($pipeline);
    }

    public function destroy($id)
    {
        $pipeline = Pipeline::findOrFail($id);
        $pipeline->delete();
        return response()->noContent();
    }


    public function saveMapSettings(Request $request)
    {
        $settings = $request->all(); // Contains mode, lat, lng, zoom, or imageUrl

        // Handle Image Upload if present
        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('maps', 'public');
            $settings['imageUrl'] = '/storage/' . $path;
        }

        // Save as JSON in system_settings table
        \App\Models\SystemSetting::updateOrCreate(
            ['key' => 'pipeline_map_config'],
            ['value' => json_encode($settings)]
        );

        return response()->json(['status' => 'success', 'config' => $settings]);
    }

    public function getMapSettings()
    {
        $setting = \App\Models\SystemSetting::where('key', 'pipeline_map_config')->value('value');
        return response()->json($setting ? json_decode($setting, true) : null);
    }
}