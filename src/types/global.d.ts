export {};

/**
 * The two Vite build flags this app uses.
 *
 * Declared by hand rather than by adding `vite/client` to tsconfig `types`:
 * setting `types` at all would stop @types/node being picked up automatically,
 * and `tsconfig.json` also covers `electron/`, which relies on Node's ambient
 * globals.
 *
 * `DEV` matters because Vite REPLACES it at build time with a literal, so
 * `if (import.meta.env.DEV) { … }` is removed from the production bundle
 * entirely — see src/lib/browserMock.ts, which uses that to guarantee the
 * browser-preview sample data cannot exist in a shipped build.
 */
declare global {
  interface ImportMetaEnv {
    readonly DEV: boolean;
    readonly PROD: boolean;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface Window {
    api?: {
      window: {
        minimize: () => Promise<void>;
        toggleMaximize: () => Promise<boolean>;
        close: () => Promise<void>;
        isMaximized: () => Promise<boolean>;
        onMaximizeChange: (cb: (max: boolean) => void) => () => void;
        /**
         * Schedule a full repaint of the window. Optional so a renderer running
         * against an older preload does not crash — see electron/main.ts.
         */
        repaint?: () => Promise<boolean>;
      };
      theme: {
        set: (mode: 'light' | 'dark' | 'system') => Promise<boolean>;
        get: () => Promise<{ source: 'light' | 'dark' | 'system'; dark: boolean }>;
      };
      db: {
        invoke: <T = unknown>(
          channel: string,
          payload?: unknown,
        ) => Promise<{ ok: true; data: T } | { ok: false; error: string }>;
        channels: () => Promise<string[]>;
      };
      /**
       * PUSH channel for update progress. The update COMMANDS go through
       * `db.invoke` like everything else so they pass the permission gate; this
       * exists only because download progress arrives unprompted from the main
       * process. Returns an unsubscribe function.
       */
      updates?: {
        onState: (cb: (state: unknown) => void) => () => void;
      };
    };
  }
}
