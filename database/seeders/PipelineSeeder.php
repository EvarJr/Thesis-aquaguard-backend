<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PipelineSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('pipelines')->insert([
            [
                'id' => 'P01', 
                'from' => 'S001', 
                'to' => 'WP01', 
                'joints' => null, 
                'created_at' => now(), 
                'updated_at' => now()
            ],
            [
                'id' => 'P02', 
                'from' => 'WP01', 
                'to' => 'H001', 
                'joints' => null, 
                'created_at' => now(), 
                'updated_at' => now()
            ],
            [
                'id' => 'P03', 
                'from' => 'WP01', 
                'to' => 'S002', 
                'joints' => json_encode([['x' => 225, 'y' => 150]]), 
                'created_at' => now(), 
                'updated_at' => now()
            ],
            [
                'id' => 'P04', 
                'from' => 'WP01', 
                'to' => 'S003', 
                'joints' => json_encode([['x' => 225, 'y' => 450]]), 
                'created_at' => now(), 
                'updated_at' => now()
            ],
            [
                'id' => 'P05', 
                'from' => 'S002', 
                'to' => 'H002', 
                'joints' => null, 
                'created_at' => now(), 
                'updated_at' => now()
            ],
            [
                'id' => 'P06', 
                'from' => 'S003', 
                'to' => 'H003', 
                'joints' => null, 
                'created_at' => now(), 
                'updated_at' => now()
            ],
            [
                'id' => 'P07', 
                'from' => 'S002', 
                'to' => 'WP02', 
                'joints' => null, 
                'created_at' => now(), 
                'updated_at' => now()
            ],
            [
                'id' => 'P08', 
                'from' => 'S003', 
                'to' => 'WP02', 
                'joints' => null, 
                'created_at' => now(), 
                'updated_at' => now()
            ],
            [
                'id' => 'P09', 
                'from' => 'WP02', 
                'to' => 'S004', 
                'joints' => null, 
                'created_at' => now(), 
                'updated_at' => now()
            ],
            [
                'id' => 'P10', 
                'from' => 'S004', 
                'to' => 'H004', 
                'joints' => null, 
                'created_at' => now(), 
                'updated_at' => now()
            ],
            [
                'id' => 'P11', 
                'from' => 'S004', 
                'to' => 'H005', 
                'joints' => null, 
                'created_at' => now(), 
                'updated_at' => now()
            ],
        ]);
    }
}