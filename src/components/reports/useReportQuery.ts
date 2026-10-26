import { useCallback, useEffect, useRef, useState } from 'react';
import { api, hasBackend } from '@/lib/api';

/**
 * Report data fetcher: `useReport` (src/hooks/useReport.ts) plus `reload()`,
 * and no toast — report pages show the failure inline with a "Try again"
 * button, so a toast as well would be two messages and no action.
 *
 * `payload === null` (or no backend) keeps it idle. Last request wins.
 */
export function useReportQuery<T = unknown>(
  channel: string,
  payload: object | null,
  deps: unknown[],
): { data: T | null; loading: boolean; error: boolean; reload: () => void } {
  const active = payload !== null && hasBackend();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(active);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);
  const reqId = useRef(0);

  useEffect(() => {
    if (!active) {
      setData(null);
      setLoading(false);
      setError(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    setError(false);
    api<T>(channel, payload)
      .then((res) => {
        if (id === reqId.current) setData(res);
      })
      .catch((err) => {
        if (id !== reqId.current) return;
        console.error(`[report] ${channel} failed:`, err);
        // Never show stale or invented figures after a failure.
        setData(null);
        setError(true);
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, active, nonce, ...deps]);

  // Ignore late answers after unmount.
  useEffect(() => () => void (reqId.current += 1), []);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}
