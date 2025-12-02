<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LogEntry;
use Illuminate\Http\Request;

class LogController extends Controller
{
    public function index()
    {
        return LogEntry::with('user')
            ->latest()
            ->take(200)
            ->get()
            ->map(function ($log) {
                return [
                    'id' => $log->id,
                    'timestamp' => $log->created_at->toDateTimeString(),
                    'userId' => $log->user->id ?? null,
                    'userName' => $log->user->name ?? 'System',
                    'userRole' => $log->user->role ?? 'N/A',
                    'action' => $log->action,
                    'details' => $log->details ?? '',
                ];
            });
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'action' => 'required|string|max:255',
            'details' => 'nullable|string', // ✅ allow null details
        ]);

        LogEntry::create([
            'user_id' => auth()->id(), // still records who triggered it
            'action' => $validated['action'],
            'details' => $validated['details'] ?? '', // ✅ fallback empty string
        ]);

        return response()->json(['message' => 'Log created successfully'], 201);
    }
}
