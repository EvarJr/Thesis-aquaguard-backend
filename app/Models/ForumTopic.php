<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids; // ✅ Import this

class ForumTopic extends Model
{
    use HasFactory, HasUuids; // ✅ Use this trait to auto-generate IDs

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 
        'user_id', 
        'title', 
        'content', 
        'category' // ✅ Added Category
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // ✅ Renamed from 'forumPosts' to 'posts' to match your Controller
    public function posts()
    {
        return $this->hasMany(ForumPost::class);
    }
}