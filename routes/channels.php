<?php

use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
|
| This file is used to define private and presence channels. 
| Since 'alerts-channel' is public, no registration is required here.
|
*/
Broadcast::channel('alerts-channel', function () {
    return true;
});


// 🟡 Temporarily disabled for public broadcast
// Broadcast::channel('alerts-channel', function ($user) {
//     return $user !== null;
// });

// Example for later private use:
// Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
//     return (int) $user->id === (int) $id;
// });
