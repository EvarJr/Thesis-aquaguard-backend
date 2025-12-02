<?php

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Cookie\Middleware\EncryptCookies;

return [

    /*
    |--------------------------------------------------------------------------
    | Stateful Domains
    |--------------------------------------------------------------------------
    | Requests from these domains will receive stateful API authentication cookies.
    | Include your local dev URLs (with and without port).
    */
    'stateful' => [
        'localhost',
        '127.0.0.1',
        'localhost:5173',
        '127.0.0.1:5173',
    ],

    /*
    |--------------------------------------------------------------------------
    | Sanctum Guards
    |--------------------------------------------------------------------------
    | Always "web" when using session-based login (not API tokens).
    */
    'guard' => ['web'],

    /*
    |--------------------------------------------------------------------------
    | Expiration (null = no expiry)
    |--------------------------------------------------------------------------
    */
    'expiration' => null,

    /*
    |--------------------------------------------------------------------------
    | Middleware Stack
    |--------------------------------------------------------------------------
    */
    'middleware' => [
        'verify_csrf_token' => VerifyCsrfToken::class,
        'encrypt_cookies' => EncryptCookies::class,
    ],
];
