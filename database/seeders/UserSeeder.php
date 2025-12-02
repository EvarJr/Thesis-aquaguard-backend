<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        User::create([
            'name' => 'Admin User',
            'email' => 'admin@aquaguard.com',
            'password' => Hash::make('password123'),
            'role' => 'Admin',
        ]);

        User::create([
            'name' => 'Stakeholder User',
            'email' => 'user@aquaguard.com',
            'password' => Hash::make('password123'),
            'role' => 'User',
        ]);
    }
}