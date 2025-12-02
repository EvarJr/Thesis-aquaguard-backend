<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Household;
use App\Models\Pipeline;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HouseholdController extends Controller
{
    public function index()
    {
        return Household::orderBy('id')->get();
    }

    public function store(Request $request)
            {
                // ... validation ...
                return DB::transaction(function () use ($request) {
                    $lastHousehold = Household::orderByRaw('LENGTH(id) DESC, id DESC')->first();
                    $nextIdNumber = $lastHousehold ? (int) substr($lastHousehold->id, 1) + 1 : 1;
                    $newId = 'H' . str_pad($nextIdNumber, 3, '0', STR_PAD_LEFT); // ✅ 3 Digits

                    $household = Household::create([
                        'id' => $newId,
                        'address' => $request->address,
                        'x' => 200,
                        'y' => 200,
                    ]);

                    if (!empty($request->connectedTo)) {
                        $lastPipeline = Pipeline::orderByRaw('LENGTH(id) DESC, id DESC')->first();
                        $pipeCounter = $lastPipeline ? (int) substr($lastPipeline->id, 1) : 0;

                        foreach ($request->connectedTo as $targetId) {
                            $pipeCounter++;
                            Pipeline::create([
                                'id' => 'P' . str_pad($pipeCounter, 3, '0', STR_PAD_LEFT), // ✅ 3 Digits
                                'from' => $household->id,
                                'to' => $targetId,
                                'joints' => json_encode([])
                            ]);
                        }
                    }
                    return response()->json($household, 201);
                });
            }

    // ... (keep your update and destroy methods as they were in the previous step)
    public function update(Request $request, Household $household)
    {
        $validated = $request->validate([
            'address' => 'sometimes|string|max:255',
            
            // ✅ FIX 1: Allow x and y coordinates to be updated
            'x' => 'sometimes|numeric',
            'y' => 'sometimes|numeric',
            
            'connectedTo' => 'nullable|array'
        ]);

        return DB::transaction(function () use ($household, $request, $validated) {
            // Now $validated contains x and y, so they will be saved!
            $household->update($validated);

            if ($request->has('connectedTo')) {
                $newTargets = $request->connectedTo;
                $myId = $household->id;

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
                            // ✅ FIX 2: Changed padding to 3 to match 'store' method (P001)
                            'id' => 'P' . str_pad($pipeCounter, 3, '0', STR_PAD_LEFT),
                            'from' => $myId,
                            'to' => $targetId,
                            'joints' => json_encode([])
                        ]);
                    }
                }
            }
            return $household;
        });
    }
    
    public function destroy(Household $household)
    {
        return DB::transaction(function () use ($household) {
            Pipeline::where('from', $household->id)->orWhere('to', $household->id)->delete();
            $household->delete();
            return response()->noContent();
        });
    }
}