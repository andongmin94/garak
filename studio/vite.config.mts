import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron/simple';

export default defineConfig({
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        async onstart({ startup }) {
          // The plugin default includes --no-sandbox; Garak must keep the Chromium sandbox on.
          await startup(['.']);
        },
      },
      preload: {
        input: 'electron/preload.ts',
      },
    }),
  ],
});
