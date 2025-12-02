<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SensorSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('sensors')->insert([
            [
                'id' => 'S001', 
                'location' => 'Brgy. Central Pumping Station',
                'description' => 'Main reservoir outlet', 
                'x' => 100, 
                'y' => 300, 
                'created_at' => now(), 
                'updated_at' => now()
            ],
            [
                'id' => 'S002', 
                'location' => 'Maple Ave. & Oak St. Junction', 
                'description' => 'District A feeder line', 
                'x' => 350, 
                'y' => 150, 
                'created_at' => now(), 'updated_at' => now()
            ],
            [
                'id' => 'S003', 'location' => 'Brgy. East Residential Area', 
                'description' => 'Booster pump inlet', 
                'x' => 350, 
                'y' => 450, 
                'created_at' => now(), 
                'updated_at' => now()
            ],
            [
                'id' => 'S004', 
                'location' => 'Downtown Commercial District', 
                'description' => 'High-volume supply line', 
                'x' => 600, 
                'y' => 300, 
                'created_at' => now(), 
                'updated_at' => now()
            ],
        ]);
    }
}