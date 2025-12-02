<?php

namespace App\Enums;

enum MLModelStatus: string
{
    case NOT_TRAINED = 'NOT_TRAINED';
    case TRAINING = 'TRAINING';
    case TRAINED = 'TRAINED';
    case FAILED = 'FAILED';
}
