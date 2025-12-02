<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class HouseholdSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('households')->insert([
            ['id' => 'H001', 'address' => '123 Aqua St, Brgy. Central', 'x' => 250, 'y' => 280, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'H002', 'address' => '456 Flow Ave, Brgy. North', 'x' => 500, 'y' => 120, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'H003', 'address' => '789 Pipe Ln, Brgy. East', 'x' => 500, 'y' => 480, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'H004', 'address' => '101 Leak Ct, Brgy. West', 'x' => 750, 'y' => 250, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 'H005', 'address' => '202 Pressure Pl, Brgy. West', 'x' => 750, 'y' => 350, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }
}