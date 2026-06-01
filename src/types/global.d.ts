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
    };
  }
}
