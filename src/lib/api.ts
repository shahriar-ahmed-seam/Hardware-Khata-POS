/**
 * Renderer-side backend client. Wraps window.api.db.invoke with:
 *  - a clean throwing interface (callers get data or an Error)
 *  - a typed channel call
 *  - graceful handling when running outside Electron (e.g. browser dev)
 *
 * Frontend hooks (TanStack Query) call `api(channel, payload)`.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public channel: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** True when the Electron backend bridge is available. */
export function hasBackend(): boolean {
  return typeof window !== 'undefined' && !!window.api?.db;
}

export async function api<T = unknown>(channel: string, payload?: unknown): Promise<T> {
  if (!hasBackend()) {
    throw new ApiError('Backend not available (running outside Electron)', channel);
  }
  const res = await window.api!.db.invoke<T>(channel, payload);
  if (!res.ok) throw new ApiError(res.error, channel);
  return res.data;
}

/** Fire-and-forget variant that swallows errors (for non-critical calls). */
export async function apiSafe<T = unknown>(channel: string, payload?: unknown): Promise<T | null> {
  try {
    return await api<T>(channel, payload);
  } catch {
    return null;
  }
}
