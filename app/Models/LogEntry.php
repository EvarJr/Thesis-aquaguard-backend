<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LogEntry extends Model
{
    use HasFactory;

    // Let Eloquent use the normal auto-incrementing ID
    public $incrementing = true;
    protected $keyType = 'int';

    protected $fillable = [
        'user_id',
        'action',
        'details', // ✅ matches migration
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
