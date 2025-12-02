<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use Illuminate\Support\Str; // ✅ Import Str for UUID generation

class AquaGuardSeeder extends Seeder
{
    /**
     * Run the database seeds.
     * This seeder should run AFTER fundamental seeders like User, Sensor, Household, etc.
     */
    public function run(): void
    {
        // --- 1. ALERTS ---
        // ✅ FIX: Removed 'id' => 'A01'. Let the database Auto-Increment the ID.
        DB::table('alerts')->insert([
            [
                'sensor_id' => 'S002', 
                'pipeline_id' => 'P007', // Ensure P007 exists in your PipelineSeeder
                'message' => 'Unusual pressure drop detected.', 
                'severity' => 'High', 
                'created_at' => now()->subHour(), 
                'updated_at' => now()->subHour(), 
                'resolved_at' => null, 
                'false_positive' => false,
                'accuracy' => 88.5 // Optional: Seed accuracy if you want
            ],
            [
                'sensor_id' => 'S003', 
                'pipeline_id' => 'P006', 
                'message' => 'Sustained high flow rate anomaly.', 
                'severity' => 'Critical', 
                'created_at' => now()->subMinutes(2), 
                'updated_at' => now()->subMinutes(2), 
                'resolved_at' => null, 
                'false_positive' => false,
                'accuracy' => 92.1
            ],
            [
                'sensor_id' => 'S001', 
                'pipeline_id' => null, 
                'message' => 'Minor flow fluctuation outside of normal hours.', 
                'severity' => 'Medium', 
                'created_at' => now()->subDay(), 
                'updated_at' => now()->subDay(), 
                'resolved_at' => now()->subHours(20), 
                'false_positive' => false,
                'accuracy' => 75.0
            ],
        ]);
        
        // --- 2. ML MODEL SETTINGS ---
        // Use updateOrCreate to prevent duplicates if ran multiple times
        DB::table('system_settings')->updateOrInsert(
            ['key' => 'ml_model_info'],
            [
                'value' => json_encode([
                    'status' => 'Not Trained',
                    'result' => null
                ])
            ]
        );

        // --- 3. FORUM ---
        // ✅ FIX: Use UUIDs since we migrated the table to use them.
        $adminUser = User::where('email', 'admin@aquaguard.com')->first();
        
        if ($adminUser) {
            // Generate a UUID for the topic
            $topicId = Str::uuid()->toString();

            DB::table('forum_topics')->insert([
                'id' => $topicId, // Explicitly set UUID
                'title' => 'Welcome to the AquaGuard Community Forum!',
                'category' => 'Announcements',
                'user_id' => $adminUser->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('forum_posts')->insert([
                'id' => Str::uuid()->toString(), // Explicitly set UUID for post
                'forum_topic_id' => $topicId,
                'user_id' => $adminUser->id,
                'content' => 'This forum is for discussing system status, maintenance schedules, and community questions. Please be respectful to all members.',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}