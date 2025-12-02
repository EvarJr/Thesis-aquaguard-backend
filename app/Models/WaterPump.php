<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WaterPump extends Model
{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';

    // ✅ Updated fillable list to match controller and database
    protected $fillable = [
        'id',
        'location',
        'status',
        'x',
        'y',
        'household_id', // keep this if your schema includes it
        'flow_rate',    // keep this if used elsewhere
    ];

    public function household()
    {
        return $this->belongsTo(Household::class);
    }

    public function alerts()
    {
        return $this->hasMany(Alert::class);
    }
}
