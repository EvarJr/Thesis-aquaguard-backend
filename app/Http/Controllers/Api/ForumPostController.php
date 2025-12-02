<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ForumPost;
use Illuminate\Http\Request;

class ForumPostController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'topic_id' => 'required|exists:forum_topics,id',
            'content' => 'required|string',
        ]);

        $post = ForumPost::create([
            'forum_topic_id' => $request->topic_id,
            'user_id' => auth()->id(),
            'content' => $request->content,
        ]);
        
        // Return a shape the frontend expects
        return response()->json([
            'id' => $post->id,
            'authorId' => $post->user->id,
            'authorName' => $post->user->name,
            'content' => $post->content,
            'createdAt' => $post->created_at->toDateTimeString(),
        ], 201);
    }
}