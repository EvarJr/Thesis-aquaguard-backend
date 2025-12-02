<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Alert extends Model
{
    use HasFactory;

    // ❌ REMOVED: public $incrementing = false; (Unless you are generating UUIDs manually)
    // ❌ REMOVED: protected $keyType = 'string';

    // ✅ Database Columns (snake_case)
    protected $fillable = [
        'sensor_id', 
        'pipeline_id', 
        'message', 
        'severity', 
        'resolved_at', 
        'false_positive'
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
        'false_positive' => 'boolean'
    ];

    // =========================================================
    // 🌉 THE BRIDGE: Make PHP look like JS
    // =========================================================
    // This tells Laravel to include these 'fake' fields in the JSON response
    protected $appends = ['sensorId', 'pipelineId', 'falsePositive', 'resolvedAt'];

    // 1. sensor_id -> sensorId
    public function getSensorIdAttribute()
    {
        return $this->attributes['sensor_id'];
    }

    // 2. pipeline_id -> pipelineId
    public function getPipelineIdAttribute()
    {
        return $this->attributes['pipeline_id'];
    }

    // 3. false_positive -> falsePositive
    public function getFalsePositiveAttribute()
    {
        return $this->attributes['false_positive'];
    }

    // 4. resolved_at -> resolvedAt
    public function getResolvedAtAttribute()
    {
        return $this->attributes['resolved_at'];
    }

    // Relationships
    public function sensor()
    {
        return $this->belongsTo(Sensor::class);
    }

    public function pipeline()
    {
        return $this->belongsTo(Pipeline::class);
    }
}