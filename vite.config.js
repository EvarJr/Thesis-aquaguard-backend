import { defineConfig, loadEnv } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // ✅ Load environment variables from .env
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      laravel({
        input: ['resources/css/app.css', 'resources/js/index.tsx'],
        refresh: true,
      }),
      react(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'resources/js'),
        '@components': path.resolve(__dirname, 'resources/js/components'),
        '@services': path.resolve(__dirname, 'resources/js/services'),
        '@types': path.resolve(__dirname, 'resources/js/types'),
        '@lib': path.resolve(__dirname, 'resources/js/lib'), // ✅ Echo + utilities
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      open: true,
      watch: {
        usePolling: true, // ✅ Helps detect file changes (for WSL/XAMPP setups)
      },
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          secure: false,
        },
        '/sanctum': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          secure: false,
        },
        '/storage': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    define: {
      // ✅ Make env vars available to client JS (especially for echo.ts)
      'process.env': env,
    },
    build: {
      outDir: 'public/build',
      emptyOutDir: true,
    },
  };
});
