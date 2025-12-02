<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ForumPost;
use App\Models\ForumTopic;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB; // ✅ Import DB

class ForumTopicController extends Controller
{
    public function index(Request $request)
    {
        $query = ForumTopic::with('user:id,name')->latest();

        // Allow filtering, but if 'All' is sent (or no category), show everything
        if ($request->has('category') && $request->category !== 'All') {
            $query->where('category', $request->category);
        }

        return $query->get()
            ->map(fn($topic) => [
                'id' => $topic->id,
                'title' => $topic->title,
                'category' => $topic->category,
                'authorId' => $topic->user->id,
                'authorName' => $topic->user->name,
                'createdAt' => $topic->created_at->toDateTimeString(),
                'posts' => [], 
            ]);
    }
    
    public function store(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'category' => 'required|string',
        ]);
        
        // ✅ Use Transaction: If post creation fails, topic won't be created
        $topic = DB::transaction(function () use ($request) {
            $topic = ForumTopic::create([
                'user_id' => auth()->id(),
                'title' => $request->title,
                'category' => $request->category,
            ]);
            
            $topic->posts()->create([
                'user_id' => auth()->id(),
                'content' => $request->content,
            ]);

            return $topic;
        });
        
        return response()->json([
            'id' => $topic->id,
            'title' => $topic->title,
            'category' => $topic->category,
            'authorId' => auth()->id(),
            'authorName' => auth()->user()->name,
            'createdAt' => $topic->created_at->toDateTimeString(),
            'posts' => [], 
        ], 201);
    }

    public function show(ForumTopic $forumTopic)
    {
        $forumTopic->load('user:id,name', 'posts.user:id,name');
        return [
            'id' => $forumTopic->id,
            'title' => $forumTopic->title,
            'category' => $forumTopic->category,
            'authorId' => $forumTopic->user->id,
            'authorName' => $forumTopic->user->name,
            'createdAt' => $forumTopic->created_at->toDateTimeString(),
            'posts' => $forumTopic->posts->map(fn($post) => [
                'id' => $post->id,
                'authorId' => $post->user->id,
                'authorName' => $post->user->name,
                'content' => $post->content,
                'createdAt' => $post->created_at->toDateTimeString(),
            ]),
        ];
    }


    // ... existing methods ...

    public function update(Request $request, $id)
    {
        $topic = ForumTopic::findOrFail($id);

        // 🔒 Security Check: Only Author or Admin can edit
        if ($request->user()->id !== $topic->user_id && $request->user()->role !== 'Admin') {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'category' => 'required|string',
        ]);

        $topic->update($validated);

        return response()->json(['message' => 'Topic updated successfully', 'topic' => $topic]);
    }

    public function destroy(Request $request, $id)
    {
        $topic = ForumTopic::findOrFail($id);

        // 🔒 Security Check: Only Author or Admin can delete
        if ($request->user()->id !== $topic->user_id && $request->user()->role !== 'Admin') {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $topic->delete(); // Database 'onDelete cascade' will remove the posts automatically

        return response()->json(['message' => 'Topic deleted successfully']);
    }
}