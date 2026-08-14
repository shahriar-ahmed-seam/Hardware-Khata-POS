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
  build: {
    /**
     * SPLIT THE VENDOR CODE OUT OF THE APP BUNDLE.
     *
     * It was one ~1.7 MB file, which the low-end shop PC had to read, parse and
     * compile as a single blocking unit on every launch. Splitting does not
     * reduce the total bytes, but it lets Chromium parse the pieces in parallel
     * and — because the vendor chunks change far less often than app code — an
     * update only invalidates the parts that actually changed, so the V8 code
     * cache for React/recharts survives.
     *
     * Grouped by how often each changes, NOT one chunk per package: hundreds of
     * tiny chunks would cost more in requests than they save in parsing.
     */
    rollupOptions: {
      output: {
        manualChunks: {
          // Never changes unless React itself is upgraded.
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // NOTE: `recharts` is deliberately NOT named here. Naming it produced a
          // `vendor-charts` chunk that Vite then added to index.html as a
          // <link rel="modulepreload">, so the browser fetched AND compiled
          // ~410 KB of charting code during startup — exactly what lazy-loading
          // the widgets was meant to avoid. Left unnamed, it is folded into the
          // dynamically-imported widgets chunk and only loads with it.
          // Icons: a large module graph, but tree-shaken and stable.
          'vendor-icons': ['lucide-react'],
          'vendor-data': ['@tanstack/react-query', 'zustand', 'date-fns'],
        },
      },
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
