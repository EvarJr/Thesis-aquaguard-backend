<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow; // 👈 IMPORT THIS
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

// 👇 CHANGE THIS LINE from "ShouldBroadcast" to "ShouldBroadcastNow"
class SensorUpdated implements ShouldBroadcastNow 
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $data;

    public function __construct($data)
    {
        $this->data = $data;
    }

    public function broadcastOn()
    {
        // ✅ Ensure this matches the .channel('sensors') in your React code
        return new Channel('sensors');
    }

    public function broadcastAs()
    {
        // ✅ Ensure this matches the .listen('.sensor.updated') in your React code
        return 'sensor.updated';
    }
}