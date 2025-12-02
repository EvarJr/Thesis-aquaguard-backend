<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Pipeline extends Model
{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';

    // ✅ FIX: Added 'from', 'to', and 'joints' so Laravel allows saving them.
    protected $fillable = [
        'id', 
        'location', 
        'diameter', 
        'material', 
        'from',    // <--- Was missing
        'to',      // <--- Was missing
        'joints'   // <--- Was missing (Critical for the map!)
    ];

    public function alerts()
    {
        return $this->hasMany(Alert::class);
    }
}