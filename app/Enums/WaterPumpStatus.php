<?php

namespace App\Enums;

enum WaterPumpStatus: string
{
    case ACTIVE = 'active';
    case INACTIVE = 'inactive';
    case ERROR = 'error';
}
