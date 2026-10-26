import { ReactNode, useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useBackup, type BackupConfig } from '@/stores/backup';
import { useDateFormat } from '@/lib/formatDate';
import { cn } from '@/lib/utils';

/** A backup older than this is shown as a warning. */
const STALE_DAYS = 3;

type Tone = 'success' | 'warning' | 'danger';

interface Status {
  tone: Tone;
  /** Whole phrase, its own text node (Bangla). */
  text: string;
  /** Optional date shown after the phrase. */
  at?: string;
}

function statusOf(c: BackupConfig): Status {
  if (!c.folder) return { tone: 'warning', text: 'Choose a backup folder first' };
  if (c.lastError) return { tone: 'danger', text: 'The last backup did not finish' };
  if (!c.lastBackupAt) return { tone: 'warning', text: 'No backup yet' };
  const age = Date.now() - new Date(c.lastBackupAt).getTime();
  if (!(age < STALE_DAYS * 86_400_000))
    return { tone: 'warning', text: 'Last backup is more than 3 days old', at: c.lastBackupAt };
  return { tone: 'success', text: 'Last backup', at: c.lastBackupAt };
}

const TONE: Record<Tone, { cls: string; icon: typeof CheckCircle2 }> = {
  success: { cls: 'text-success', icon: CheckCircle2 },
  warning: { cls: 'text-warning', icon: AlertTriangle },
  danger: { cls: 'text-destructive', icon: AlertCircle },
};

/** Load the backup status once; `null` until the backend has answered. */
function useBackupStatus(): Status | null {
  const config = useBackup((s) => s.config);
  const hydrate = useBackup((s) => s.hydrate);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    void hydrate().finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [hydrate]);
  return loaded ? statusOf(config) : null;
}

/** One line for the Backup tile on the Settings hub. Icon + words, never colour alone. */
export function BackupStatusLine({ className }: { className?: string }) {
  const st = useBackupStatus();
  const { dateTime } = useDateFormat();
  if (!st) return null;
  const { cls, icon: Icon } = TONE[st.tone];
  return (
    <div className={cn('flex items-center gap-1.5 text-xs font-medium', cls, className)}>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span>{st.text}</span>
      {st.at && <span className="tabular" data-no-i18n>{dateTime(st.at)}</span>}
    </div>
  );
}

/**
 * The first thing on the Backup page: "am I safe?" in words, with the one
 * primary action next to it.
 */
export function BackupStatusBanner({ extra }: { extra?: ReactNode }) {
  const st = useBackupStatus();
  const config = useBackup((s) => s.config);
  const busy = useBackup((s) => s.busy);
  const runNow = useBackup((s) => s.runNow);
  const chooseFolder = useBackup((s) => s.chooseFolder);
  const { dateTime } = useDateFormat();
  const tone = st?.tone ?? 'success';
  const { cls, icon: Icon } = TONE[tone];
  const size = config.lastBackupBytes;

  return (
    <div
      className={cn(
        'rounded-lg border p-5 flex flex-wrap items-center gap-4',
        tone === 'success' && 'border-success/40 bg-success/5',
        tone === 'warning' && 'border-warning/40 bg-warning/5',
        tone === 'danger' && 'border-destructive/40 bg-destructive/5',
      )}
    >
      <Icon className={cn('size-8 shrink-0', cls)} aria-hidden />
      <div className="flex-1 min-w-[16rem]">
        {st ? (
          <div className="text-lg font-semibold flex flex-wrap items-baseline gap-x-2">
            <span>{st.text}</span>
            {st.at && (
              <span className="tabular" data-no-i18n>
                {dateTime(st.at)}
              </span>
            )}
            {st.at && size != null && (
              <span className="text-sm font-normal text-muted-foreground tabular" data-no-i18n>
                ({formatBytes(size)})
              </span>
            )}
          </div>
        ) : (
          <div className="text-lg font-semibold text-muted-foreground">Checking…</div>
        )}
        {config.lastError && (
          <div className="text-sm text-destructive mt-1 break-words" data-no-i18n>
            {config.lastError}
          </div>
        )}
        {extra && <div className="text-sm text-muted-foreground mt-1">{extra}</div>}
      </div>
      {config.folder ? (
        <Button size="lg" onClick={() => void runNow()} disabled={busy}>
          <Download className="size-5" /> Back up now
        </Button>
      ) : (
        <Button size="lg" onClick={() => void chooseFolder()} disabled={busy}>
          Choose folder…
        </Button>
      )}
    </div>
  );
}

export function formatBytes(bytes?: number | null): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
