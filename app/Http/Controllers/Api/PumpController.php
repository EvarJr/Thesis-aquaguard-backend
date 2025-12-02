<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WaterPump;
use App\Models\Pipeline;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rules\Enum;
use App\Enums\WaterPumpStatus;

class PumpController extends Controller
{
    public function index()
    {
        return WaterPump::orderBy('id')->get();
    }

    public function store(Request $request)
    {
        $status = strtolower($request->input('status', 'active'));
        $request->merge(['status' => $status]);

        $request->validate([
            'location' => 'required|string|max:255',
            'status' => ['required', new Enum(WaterPumpStatus::class)],
            'connectedTo' => 'nullable|array',
        ]);

        return DB::transaction(function () use ($request) {
            // 1. Generate Pump ID (WP01, WP02...)
            $lastPump = WaterPump::orderByRaw('LENGTH(id) DESC, id DESC')->first();
            $nextIdNumber = $lastPump ? (int) substr($lastPump->id, 2) + 1 : 1;
            $newId = 'WP' . str_pad($nextIdNumber, 2, '0', STR_PAD_LEFT);

            $pump = WaterPump::create([
                'id' => $newId,
                'location' => $request->location,
                'status' => $request->status,
                'x' => 250,
                'y' => 250,
            ]);

            // 2. Create Pipelines
            if (!empty($request->connectedTo)) {
                $lastPipeline = Pipeline::orderByRaw('LENGTH(id) DESC, id DESC')->first();
                $pipeCounter = $lastPipeline ? (int) substr($lastPipeline->id, 1) : 0;

                foreach ($request->connectedTo as $targetId) {
                    $pipeCounter++;
                    Pipeline::create([
                        'id' => 'P' . str_pad($pipeCounter, 2, '0', STR_PAD_LEFT),
                        'from' => $pump->id,
                        'to' => $targetId,
                        'joints' => json_encode([])
                    ]);
                }
            }

            return response()->json($pump, 201);
        });
    }

    public function update(Request $request, WaterPump $pump)
    {
        if ($request->has('status')) {
            $request->merge(['status' => strtolower($request->status)]);
        }

        $validated = $request->validate([
            'location' => 'sometimes|string|max:255',
            'status' => ['sometimes', new Enum(WaterPumpStatus::class)],
            'x' => 'sometimes|numeric',
            'y' => 'sometimes|numeric',
            'connectedTo' => 'nullable|array'
        ]);

        return DB::transaction(function () use ($pump, $request, $validated) {
            $pump->update($validated);

            if ($request->has('connectedTo')) {
                $newTargets = $request->connectedTo;
                $myId = $pump->id;

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

                // Robust Add Logic for Update
                if (!empty($toAdd)) {
                    $lastPipeline = Pipeline::orderByRaw('LENGTH(id) DESC, id DESC')->first();
                    $pipeCounter = $lastPipeline ? (int) substr($lastPipeline->id, 1) : 0;

                    foreach ($toAdd as $targetId) {
                        $pipeCounter++;
                        Pipeline::create([
                            'id' => 'P' . str_pad($pipeCounter, 2, '0', STR_PAD_LEFT),
                            'from' => $myId,
                            'to' => $targetId,
                            'joints' => json_encode([])
                        ]);
                    }
                }
            }

            return $pump;
        });
    }

    public function destroy(WaterPump $pump)
    {
        return DB::transaction(function () use ($pump) {
            Pipeline::where('from', $pump->id)->orWhere('to', $pump->id)->delete();
            $pump->delete();
            return response()->noContent();
        });
    }
}