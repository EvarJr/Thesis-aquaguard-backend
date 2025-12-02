<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            // Core Data (no dependencies on each other)
            UserSeeder::class,
            SensorSeeder::class,
            HouseholdSeeder::class,
            WaterPumpSeeder::class,
            
            // Relational Data (depends on the above)
            PipelineSeeder::class,
            
            // Dependent Data (depends on all of the above)
            AquaGuardSeeder::class, 
        ]);
    }
}