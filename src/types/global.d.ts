export {};

declare global {
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
