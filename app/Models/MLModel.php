<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MLModel extends Model
{
    use HasFactory;

    protected $table = 'ml_models';

    // ✅ FIX: Added 'name', 'description', and 'is_active'
    protected $fillable = [
        'name',              
        'description',       
        'is_active',         
        'version',
        'file_path_detect',
        'file_path_locate',
        'file_path_features',
        'accuracy',
        'status',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
        'is_active' => 'boolean', 
        'accuracy' => 'float',
    ];
}