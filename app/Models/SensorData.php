<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SensorData extends Model
{
    use HasFactory;

    // ✅ Allow saving these fields
    protected $fillable = [
        'f_main', 'f_1', 'f_2', 'f_3',
        'p_main', 'p_dma1', 'p_dma2', 'p_dma3',
        'pump_on', 'comp_on',
        's1', 's2', 's3',
        'solenoid_active' 
    ];
}