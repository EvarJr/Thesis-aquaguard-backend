<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\WaterPumpStatus;

class WaterPumpSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('water_pumps')->insert([
            ['id' => 'WP01', 'location' => 'Brgy. West Booster', 'status' => 'Active', 'x' => 225, 'y' => 300, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'WP02', 'location' => 'Brgy. East Feeder', 'status' => 'Error', 'x' => 475, 'y' => 300, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }
}