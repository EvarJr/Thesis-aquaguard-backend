<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS)
    |--------------------------------------------------------------------------
    |
    | This configuration ensures Laravel Sanctum works properly with
    | your React (Vite) frontend during local development and production.
    |
    */

    'paths' => [
        'api/*',                  // All API routes
        'sanctum/csrf-cookie',    // Required for CSRF cookie setup
        'login',                  // Session login
        'logout',                 // Session logout
    ],

    /*
    |--------------------------------------------------------------------------
    | Allowed HTTP Methods
    |--------------------------------------------------------------------------
    */
    'allowed_methods' => ['*'],

    /*
    |--------------------------------------------------------------------------
    | Allowed Origins
    |--------------------------------------------------------------------------
    |
    | Must exactly match your frontend URLs (including port numbers).
    | You can add production URLs later.
    |
    */
    'allowed_origins' => [
        'http://127.0.0.1:5173',
        'http://localhost:5173',
    ],

    /*
    |--------------------------------------------------------------------------
    | Allowed Origin Patterns
    |--------------------------------------------------------------------------
    |
    | Keep empty unless you need wildcard matching for subdomains.
    |
    */
    'allowed_origins_patterns' => [],

    /*
    |--------------------------------------------------------------------------
    | Allowed Headers
    |--------------------------------------------------------------------------
    */
    'allowed_headers' => ['*'],

    /*
    |--------------------------------------------------------------------------
    | Exposed Headers
    |--------------------------------------------------------------------------
    |
    | Leave empty unless you need to expose custom response headers.
    |
    */
    'exposed_headers' => [],

    /*
    |--------------------------------------------------------------------------
    | Max Age
    |--------------------------------------------------------------------------
    |
    | Time (in seconds) that the results of a preflight request can be cached.
    |
    */
    'max_age' => 0,

    /*
    |--------------------------------------------------------------------------
    | Supports Credentials
    |--------------------------------------------------------------------------
    |
    | ⚠️ MUST be TRUE for Sanctum session authentication to work properly.
    |
    */
    'supports_credentials' => true,
];
