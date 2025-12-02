<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SystemSetting extends Model
{
    use HasFactory;

    protected $table = 'system_settings';
    protected $primaryKey = 'key';
    public $incrementing = false;
    protected $keyType = 'string';

    // ✅ Disable timestamps because the table doesn't have created_at / updated_at
    public $timestamps = false;

    protected $fillable = ['key', 'value'];

    protected $casts = [
        'value' => 'array',
    ];

    /**
     * Use "key" column for route model binding.
     */
    public function getRouteKeyName(): string
    {
        return 'key';
    }
}
