import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { api, hasBackend } from '@/lib/api';
import { useCan } from '@/hooks/useCan';
import { useAuth } from '@/stores/auth';
import { cn } from '@/lib/utils';

type State = 'ok' | 'failed' | 'stale' | 'never' | 'off';
interface Health {
  state: State;
  lastError?: string;
  daysSince: number | null;
}

/** First look a little after start-up (the daily backup runs at one minute). */
const FIRST_CHECK_MS = 90_000;
const EVERY_MS = 3 * 60_000;

/** Other screens can ask for a fresh look, e.g. right after "Back up now". */
export const BACKUP_HEALTH_EVENT = 'pos:backup-health';

/**
 * A strip above every screen when the shop's data is NOT being copied: the last
 * automatic backup failed, there has been none for days, or none at all.
 *
 * A failed backup used to be written only on Settings → Backup, so a full disk
 * or an unplugged cloud folder could stop every backup for weeks and nobody
 * would know until the day they needed one. Everyone sees this (the cashier
 * closing the shift too); only someone who may change backups gets the button.
 * Closing it hides this message until something changes.
 */
export function BackupBanner() {
  const nav = useNavigate();
  const signedIn = useAuth((s) => !!s.currentUserId);
  const canFix = useCan('settings.backup');
  const [health, setHealth] = useState<Health | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!hasBackend()) return;
    try {
      setHealth(await api<Health>('backup.health', {}));
    } catch {
      /* not signed in yet or a transient failure — look again next time */
    }
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    const first = setTimeout(() => void check(), FIRST_CHECK_MS);
    const every = setInterval(() => void check(), EVERY_MS);
    const onAsk = () => void check();
    window.addEventListener(BACKUP_HEALTH_EVENT, onAsk);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      window.removeEventListener(BACKUP_HEALTH_EVENT, onAsk);
    };
  }, [signedIn, check]);

  if (!health || health.state === 'ok' || health.state === 'off') return null;
  const signature = `${health.state}|${health.lastError ?? ''}|${health.daysSince ?? ''}`;
  if (dismissed === signature) return null;

  const failed = health.state === 'failed';
  return (
    <div
      role="alert"
      className={cn(
        'shrink-0 flex items-center gap-3 px-4 py-2 border-b text-sm print:hidden',
        failed
          ? 'bg-destructive/10 border-destructive/30 text-destructive'
          : 'bg-warning/10 border-warning/30 text-warning',
      )}
    >
      <AlertTriangle className="size-5 shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">
        <span className="font-semibold">
          {failed ? (
            <span>The last backup failed.</span>
          ) : health.state === 'never' ? (
            <span>No backup has been taken yet.</span>
          ) : (
            <span>The shop's data has not been backed up for a while.</span>
          )}
        </span>{' '}
        {failed && health.lastError && (
          <span className="text-foreground/80" data-no-i18n>
            {health.lastError}
          </span>
        )}
        {health.state === 'stale' && health.daysSince !== null && (
          <span className="text-foreground/80">
            <span>Days since the last backup:</span> <span className="tabular">{health.daysSince}</span>
          </span>
        )}
        {!canFix && <span className="text-foreground/80"> <span>Please tell the owner.</span></span>}
      </div>
      {canFix && (
        <button
          type="button"
          onClick={() => nav('/settings/backup')}
          className="shrink-0 h-9 px-3 rounded-md bg-card border border-border text-foreground text-sm font-medium hover:bg-secondary focus-ring"
        >
          Open Backup settings
        </button>
      )}
      <button
        type="button"
        onClick={() => setDismissed(signature)}
        title="Hide this message"
        aria-label="Hide this message"
        className="shrink-0 size-9 grid place-items-center rounded-md hover:bg-foreground/10 focus-ring"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
