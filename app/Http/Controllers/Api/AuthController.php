<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * 🔐 Handle login request (session-based with Sanctum)
     */
    public function login(Request $request)
    {
        // ✅ Validate credentials
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        // ✅ Attempt authentication with the "web" guard (for Sanctum session cookies)
        if (!Auth::guard('web')->attempt($credentials, true)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        // ✅ Regenerate session to prevent fixation
        $request->session()->regenerate();

        // ✅ Return authenticated user data
        $user = Auth::user();

        return response()->json([
            'message' => 'Login successful',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role ?? 'User', // Default to "User" if not set
            ],
        ]);
    }

    /**
     * 🧠 Fetch the current authenticated user (used by /api/user)
     */
    public function getUser(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role ?? 'User',
        ]);
    }

    /**
     * 🚪 Handle logout request
     */
    public function logout(Request $request)
    {
        // ✅ Logout and invalidate session
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logged out successfully']);
    }

    /**
     * 🧾 Optional route to check authentication status
     */
    public function checkAuth(Request $request)
    {
        return response()->json([
            'authenticated' => Auth::check(),
            'user' => Auth::check() ? [
                'id' => Auth::user()->id,
                'name' => Auth::user()->name,
                'email' => Auth::user()->email,
                'role' => Auth::user()->role ?? 'User',
            ] : null,
        ]);
    }

    /**
     * 👤 Update Profile (Name, Email, Password)
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'name'  => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,' . $user->id,
            'password' => 'nullable|string|min:8|confirmed', // 'confirmed' looks for password_confirmation field
        ]);

        $user->name = $validated['name'];
        $user->email = $validated['email'];

        // Only update password if provided
        if (!empty($validated['password'])) {
            $user->password = \Illuminate\Support\Facades\Hash::make($validated['password']);
        }

        $user->save();

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user' => $user
        ]);
    }
}
