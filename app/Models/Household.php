<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Household extends Model
{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 
        'owner_name', 
        'address', 
        'meter_number',
        'x', // ✅ Added: Required for Map Positioning
        'y'  // ✅ Added: Required for Map Positioning
    ];

    public function waterPumps()
    {
        return $this->hasMany(WaterPump::class);
    }
}