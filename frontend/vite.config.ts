import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const backendTarget = 'http://127.0.0.1:8001';

const backendRoutes = [
  '/admin',
  '/admins',
  '/me',
  '/employees',
  '/departments',
  '/positions',
  '/doors',
  '/attendance-policy',
  '/attendance-events',
  '/attendance-poller',
  '/reports',
  '/work-permissions',
  '/hikvision',
  '/computers',
  '/computer-agent',
  '/computer-activity',
  '/productivity',
  '/categories',
  '/app-config',
  '/shifts',
  '/holidays',
  '/audit',
  '/uploads',
  '/system',
  '/zones',
  '/rooms',
  '/cameras',
  '/internal',
  '/static'
];

const backendProxy = () => ({
  target: backendTarget,
  bypass: (req: import('http').IncomingMessage) => {
    if (req.headers.accept?.includes('text/html')) {
      return '/index.html';
    }
  },
});

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      ...Object.fromEntries(backendRoutes.map((route) => [route, backendProxy()])),
      '/api': {
        target: backendTarget,
        rewrite: (routePath) => routePath.replace(/^\/api/, ''),
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
      },
    },
  },
  plugins: [react(), tailwindcss()]
});

