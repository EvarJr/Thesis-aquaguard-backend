<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Enums\Role;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function index()
    {
        return User::all();
    }

    public function store(Request $request)
    {
        // 🧩 Normalize the role to match Enum values
        $normalizedRole = ucfirst(strtolower($request->input('role')));

        try {
            $request->merge(['role' => $normalizedRole]);

            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'email' => 'required|string|email|max:255|unique:users',
                'password' => 'required|string|min:6',
                'role' => ['required', 'in:' . implode(',', array_column(Role::cases(), 'value'))],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        }

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
        ]);

        return response()->json($user, 201);
    }

    public function update(Request $request, User $user)
    {
        // 🧩 Normalize role if provided
        if ($request->has('role')) {
            $request->merge([
                'role' => ucfirst(strtolower($request->input('role')))
            ]);
        }

        try {
            $validated = $request->validate([
                'name' => 'sometimes|string|max:255',
                'role' => ['sometimes', 'in:' . implode(',', array_column(Role::cases(), 'value'))],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        }

        $user->update($validated);
        return response()->json($user, 200);
    }

    public function destroy(User $user)
    {
        // 🔒 Prevent self-deletion
        if ($user->id === auth()->id()) {
            return response()->json([
                'message' => 'You cannot delete your own account.'
            ], 403);
        }

        $user->delete();
        return response()->noContent();
    }
}
