import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// relative base works for the APK (Capacitor) and GitHub Pages (/repo/). Two pages: the game and the QR download page.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: { input: { app: resolve(__dirname, 'index.html'), download: resolve(__dirname, 'download.html') } },
  },
});
