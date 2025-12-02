<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sensor;
use App\Models\Pipeline;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SensorController extends Controller
{
    public function index()
    {
        return Sensor::orderBy('id')->get();
    }

    public function store(Request $request)
    {
        $request->validate([
            'location' => 'required|string|max:255',
            'type' => 'required|string|max:50',
            'connectedTo' => 'nullable|array',
        ]);

        return DB::transaction(function () use ($request) {
            // 1. Generate ID (S001, S002...) - Match seeded style
            $lastSensor = Sensor::orderByRaw('LENGTH(id) DESC, id DESC')->first();
            $nextIdNumber = $lastSensor ? (int) substr($lastSensor->id, 1) + 1 : 1;
            $newId = 'S' . str_pad($nextIdNumber, 3, '0', STR_PAD_LEFT); // ✅ 3 Digits

            $sensor = Sensor::create([
                'id' => $newId,
                'location' => $request->location,
                'type' => $request->type,
                'x' => 300,
                'y' => 300,
            ]);

            // 2. Create Pipelines
            if (!empty($request->connectedTo)) {
                $lastPipeline = Pipeline::orderByRaw('LENGTH(id) DESC, id DESC')->first();
                $pipeCounter = $lastPipeline ? (int) substr($lastPipeline->id, 1) : 0;

                foreach ($request->connectedTo as $targetId) {
                    $pipeCounter++;
                    Pipeline::create([
                        'id' => 'P' . str_pad($pipeCounter, 3, '0', STR_PAD_LEFT), // ✅ 3 Digits
                        'from' => $sensor->id,
                        'to' => $targetId,
                        'joints' => json_encode([])
                    ]);
                }
            }

            return response()->json($sensor, 201);
        });
    }

    public function update(Request $request, Sensor $sensor)
    {
        $validated = $request->validate([
            'location' => 'sometimes|string|max:255',
            'type' => 'sometimes|string|max:50',
            'x' => 'sometimes|numeric',
            'y' => 'sometimes|numeric',
            'connectedTo' => 'nullable|array'
        ]);

        return DB::transaction(function () use ($sensor, $request, $validated) {
            $sensor->update($validated);

            if ($request->has('connectedTo')) {
                $newTargets = $request->connectedTo;
                $myId = $sensor->id;

                // Bidirectional Check
                $existingPipelines = Pipeline::where('from', $myId)->orWhere('to', $myId)->get();
                $currentConnectedIds = $existingPipelines->map(function($p) use ($myId) {
                    return $p->from === $myId ? $p->to : $p->from;
                })->toArray();

                $toRemove = array_diff($currentConnectedIds, $newTargets);
                $toAdd = array_diff($newTargets, $currentConnectedIds);

                if (!empty($toRemove)) {
                    Pipeline::where(function($q) use ($myId, $toRemove) {
                        $q->where('from', $myId)->whereIn('to', $toRemove);
                    })->orWhere(function($q) use ($myId, $toRemove) {
                        $q->where('to', $myId)->whereIn('from', $toRemove);
                    })->delete();
                }

                if (!empty($toAdd)) {
                    $lastPipeline = Pipeline::orderByRaw('LENGTH(id) DESC, id DESC')->first();
                    $pipeCounter = $lastPipeline ? (int) substr($lastPipeline->id, 1) : 0;

                    foreach ($toAdd as $targetId) {
                        $pipeCounter++;
                        Pipeline::create([
                            'id' => 'P' . str_pad($pipeCounter, 3, '0', STR_PAD_LEFT), // ✅ 3 Digits
                            'from' => $myId,
                            'to' => $targetId,
                            'joints' => json_encode([])
                        ]);
                    }
                }
            }
            return $sensor;
        });
    }

    public function destroy(Sensor $sensor)
    {
        return DB::transaction(function () use ($sensor) {
            Pipeline::where('from', $sensor->id)->orWhere('to', $sensor->id)->delete();
            $sensor->delete();
            return response()->noContent();
        });
    }
}