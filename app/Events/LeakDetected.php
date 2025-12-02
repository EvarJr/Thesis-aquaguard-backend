<?php

namespace App\Events;

use App\Models\Alert;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\Channel; 
// 👇 CHANGE 1: Use ShouldBroadcastNow for instant alerts (no queue lag)
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class LeakDetected implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public Alert $alert;

    /**
     * Create a new event instance.
     */
    public function __construct(Alert $alert)
    {
        $this->alert = $alert;
    }

    /**
     * Broadcast on a PUBLIC channel.
     */
    public function broadcastOn(): Channel
    {
        return new Channel('alerts-channel');
    }

    /**
     * Name of the event sent to the frontend.
     */
    public function broadcastAs(): string
    {
        return 'leak.detected';
    }

    /**
     * Data sent to the frontend.
     */
    public function broadcastWith(): array
    {
        return [
            'alert' => [
                'id'         => $this->alert->id,
                'sensorId'   => $this->alert->sensor_id, 
                'pipelineId' => $this->alert->pipeline_id, 
                'message'    => $this->alert->message,
                'severity'   => $this->alert->severity,
                // 👇 CHANGE 2: Send the Accuracy % to the dashboard
                'accuracy'   => $this->alert->accuracy, 
                'createdAt'  => $this->alert->created_at,
            ],
        ];
    }
}