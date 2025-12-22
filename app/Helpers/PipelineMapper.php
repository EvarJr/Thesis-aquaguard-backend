<?php

namespace App\Helpers;

use App\Models\Pipeline;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class PipelineMapper
{
    private static $mapFile = 'ml_models/pipeline_id_map.json';

    /**
     * Get the Integer Label (e.g., 2) for a String ID (e.g., "P008").
     * Automatically assigns a new number if the pipeline is new.
     */
    public static function getLabel($pipelineId)
    {
        $map = self::getMap();
        return $map[$pipelineId] ?? 0; // 0 = Unknown
    }

    /**
     * Get the String ID (e.g., "P008") from an Integer Label (e.g., 2).
     */
    public static function getIdFromLabel($label)
    {
        $map = self::getMap();
        $flip = array_flip($map);
        return $flip[$label] ?? null;
    }

    /**
     * Loads the map from storage and syncs it with the Database.
     * Ensures every Pipeline in the DB has a unique integer ID.
     */
    public static function getMap()
    {
        // 1. Load existing map from JSON file
        $map = [];
        if (Storage::exists(self::$mapFile)) {
            $map = json_decode(Storage::get(self::$mapFile), true);
        }

        // 2. Fetch all current Pipeline IDs from Database
        $dbPipelines = Pipeline::pluck('id')->toArray();
        $hasChanges = false;

        // 3. Find the highest integer currently used
        $maxVal = count($map) > 0 ? max($map) : 0;

        // 4. Assign numbers to NEW pipelines
        foreach ($dbPipelines as $pId) {
            if (!isset($map[$pId])) {
                $maxVal++;
                $map[$pId] = $maxVal;
                $hasChanges = true;
                Log::info("🗺️ PipelineMapper: Assigned New ID [$pId] => $maxVal");
            }
        }

        // 5. Save back to JSON if we added anything
        if ($hasChanges) {
            Storage::put(self::$mapFile, json_encode($map, JSON_PRETTY_PRINT));
        }

        return $map;
    }
    
    /**
     * Helper: Returns the raw array if needed for debugging
     */
    public static function debugMap()
    {
        return self::getMap();
    }
}