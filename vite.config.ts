import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'node:path';
import fs from 'node:fs';

// Copy electron/splash.html into dist-electron so packaged builds find it.
function copySplash() {
  return {
    name: 'copy-splash',
    closeBundle() {
      try {
        const src = path.resolve(__dirname, 'electron/splash.html');
        const dest = path.resolve(__dirname, 'dist-electron/splash.html');
        if (fs.existsSync(src)) {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(src, dest);
        }
      } catch (e) {
        console.warn('[copy-splash] failed:', e);
      }
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              // Native module — must not be bundled; loaded via require at runtime.
              external: ['better-sqlite3'],
            },
          },
          plugins: [copySplash()],
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: { outDir: 'dist-electron' },
        },
      },
    ]),
    renderer(),
  ],
  server: {
    port: 5173,
  },
});
