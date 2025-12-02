<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>AquaGuard Dashboard</title>

    <!-- Vite integration for React -->
    @viteReactRefresh
    @vite(['resources/js/index.tsx', 'resources/css/app.css'])
</head>
<body class="antialiased">
    <div id="app"></div>
</body>
</html>
