import { useEffect, useRef, useState } from 'react';
import { api, hasBackend } from '@/lib/api';
import { useBranches } from '@/stores/branches';
import { toast } from '@/stores/toast';

/**
 * SHARED REPORTS DATA HOOK
 *
 * A tiny, reusable read-only fetcher for the Reports slice. Every report page
 * passes a backend channel + payload and gets back `{ data, loading, backend,
 * error }`.
 *
 * Contract:
 *  - When the Electron backend bridge is unavailable (browser dev) OR `payload`
 *    is null, it returns `{ data: null, loading: false, backend: false,
 *    error: false }` so the page keeps its EXISTING mock computation untouched.
 *    This is legitimate dev mode — mock is expected there.
 *  - When backed and payload !== null, it fetches `api<T>(channel, payload)` on
 *    mount and whenever `deps` change. Stale responses are ignored via a
 *    monotonically-increasing request id (last-write-wins).
 *  - ON ERROR under a real backend it does NOT silently degrade to mock: it
 *    surfaces a toast (once per fetch attempt) and flips `error: true` so the
 *    page can show an empty/error state instead of MOCK numbers. A real backend
 *    failure must never masquerade as real data.
 */
export function useReport<T = unknown>(
  channel: string,
  payload: object | null,
  deps: unknown[],
): { data: T | null; loading: boolean; backend: boolean; error: boolean } {
  const backend = hasBackend();
  const active = backend && payload !== null;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(active);
  const [error, setError] = useState(false);

  // Guard against out-of-order responses / unmount.
  const reqIdRef = useRef(0);
  // Ensures we only toast once per fetch attempt (not on every re-render).
  const toastedRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setData(null);
      setLoading(false);
      setError(false);
      return;
    }

    const reqId = ++reqIdRef.current;
    let cancelled = false;
    setLoading(true);
    setError(false);
    toastedRef.current = false;

    (async () => {
      try {
        const res = await api<T>(channel, payload);
        if (cancelled || reqId !== reqIdRef.current) return;
        setData(res);
        setError(false);
      } catch (err) {
        // Backend error: surface it. Do NOT fall back to mock — flip `error` so
        // the page renders an empty/error state, and toast once per attempt.
        if (!cancelled && reqId === reqIdRef.current) {
          console.error(`[useReport] ${channel} fetch failed:`, err);
          setData(null);
          setError(true);
          if (!toastedRef.current) {
            toastedRef.current = true;
            toast.error(err instanceof Error ? err.message : `Failed to load ${channel}`);
          }
        }
      } finally {
        if (!cancelled && reqId === reqIdRef.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, active, ...deps]);

  return { data, loading, backend, error };
}

/**
 * Resolve a branch DISPLAY NAME (as used by the ReportToolbar picker) into a
 * backend branch ID. The toolbar value is a branch name with '' meaning "all
 * branches"; the backend wants a branch id with undefined / 'all' meaning all.
 * Returns `undefined` for the all-branches case so it can be spread straight
 * into a `{ range, branchId }` payload.
 */
export function resolveBranchId(
  branches: { id: string; name: string }[],
  name: string,
): string | undefined {
  if (!name) return undefined; // '' = all branches
  return branches.find((b) => b.name === name)?.id;
}

/** Hook form of {@link resolveBranchId} bound to the branches store. */
export function useBranchId(name: string): string | undefined {
  const branches = useBranches((s) => s.items);
  return resolveBranchId(branches, name);
}
