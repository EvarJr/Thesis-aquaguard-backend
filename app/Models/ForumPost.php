<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids; // ✅ Import this

class ForumPost extends Model
{
    use HasFactory, HasUuids; // ✅ Use this trait

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 
        'user_id', 
        'forum_topic_id', // This matches the migration default
        'content'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // Renamed to 'topic' for cleaner code usage (optional but recommended)
    public function topic()
    {
        return $this->belongsTo(ForumTopic::class, 'forum_topic_id');
    }
}