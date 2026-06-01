import { useState } from 'react';
import {
  Save,
  CloudUpload,
  CloudOff,
  HardDrive,
  Download,
  Upload,
  RotateCcw,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Database,
  FileDown,
} from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { useSettings, type BackupSettings } from '@/stores/settings';
import { cn } from '@/lib/utils';

const PROVIDERS: {
  id: BackupSettings['cloudProvider'];
  label: string;
  hint: string;
}[] = [
  { id: 'none', label: 'None', hint: 'Local backup only' },
  { id: 'supabase', label: 'Supabase', hint: 'Self-hosted or cloud Postgres' },
  { id: 's3', label: 'AWS S3 / Compatible', hint: 'Wasabi, Backblaze, MinIO' },
  { id: 'google-drive', label: 'Google Drive', hint: 'Personal Google account' },
];

function formatTime(iso?: string): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BackupPage() {
  const b = useSettings((s) => s.backup);
  const set = useSettings((s) => s.setBackup);

  const [showHistory, setShowHistory] = useState(false);

  const runLocalBackup = () => {
    set({ lastLocalBackupAt: new Date().toISOString() });
    alert('Local backup written to ~/Documents/HardwarePOS/backups/');
  };
  const runCloudSync = () => {
    if (b.cloudProvider === 'none' || !b.cloudConnected) {
      alert('Connect a cloud provider first.');
      return;
    }
    set({ lastCloudSyncAt: new Date().toISOString() });
    alert('Sync completed.');
  };

  return (
    <div>
      <SettingsHeader
        title="Backup & Sync"
        subtitle="Local backup, cloud sync, and data export"
        actions={
          <Button onClick={() => alert('Saved.')}>
            <Save className="size-4" /> Saved
          </Button>
        }
      />

      <div className="p-6 max-w-5xl grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Local backup */}
        <Card className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-md bg-secondary grid place-items-center text-muted-foreground">
              <HardDrive className="size-5" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Local backup</div>
              <div className="text-xs text-muted-foreground">
                A SQLite snapshot saved to your computer. Use this if you have no internet.
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                Last local backup
              </div>
              <div className="text-sm font-medium mt-0.5">{formatTime(b.lastLocalBackupAt)}</div>
            </div>
            <Button onClick={runLocalBackup}>
              <Download className="size-4" /> Backup now
            </Button>
          </div>

          <div>
            <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em] mb-1">
              Auto backup
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['off', 'daily', 'on-shift-close'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => set({ autoBackup: opt })}
                  className={cn(
                    'h-12 rounded-md border text-xs font-medium transition px-2',
                    b.autoBackup === opt
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-secondary',
                  )}
                >
                  {opt === 'off'
                    ? 'Off'
                    : opt === 'daily'
                      ? 'Daily 02:00'
                      : 'On shift close'}
                </button>
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1.5">
              Recommended: <span className="font-semibold">On shift close</span>. Captures the day's
              data right after Z-Report.
            </div>
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
              Restore from file
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => alert('Pick a .pos-backup file (mock).')}
              >
                <Upload className="size-4" /> Choose backup file…
              </Button>
              <span className="text-[11px] text-muted-foreground">
                The shop will close for ~30s while restoring.
              </span>
            </div>
          </div>
        </Card>

        {/* Cloud sync */}
        <Card className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-md bg-secondary grid place-items-center text-muted-foreground">
              {b.cloudConnected ? <CloudUpload className="size-5" /> : <CloudOff className="size-5" />}
            </div>
            <div className="flex-1">
              <div className="font-semibold flex items-center gap-2">
                Cloud sync
                {b.cloudConnected ? (
                  <Badge variant="success">
                    <CheckCircle2 className="size-3" /> Connected
                  </Badge>
                ) : (
                  <Badge variant="default">Not connected</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Mirror your shop data to the cloud across multiple devices.
              </div>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em] mb-1">
              Provider
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    set({ cloudProvider: p.id, cloudConnected: false, cloudAccount: undefined });
                  }}
                  className={cn(
                    'rounded-md border p-2.5 text-left transition',
                    b.cloudProvider === p.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-secondary',
                  )}
                >
                  <div className="text-sm font-semibold inline-flex items-center gap-1">
                    <Cloud className="size-3.5" /> {p.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{p.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {b.cloudProvider !== 'none' && (
            <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
              {b.cloudConnected ? (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-success" />
                    <span className="font-medium">Signed in as</span>
                    <span className="font-mono">{b.cloudAccount ?? 'shop@example.com'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Last sync: {formatTime(b.lastCloudSyncAt)}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={runCloudSync}
                        className="px-2 h-7 rounded border border-border hover:bg-secondary text-xs"
                      >
                        <RotateCcw className="size-3 inline" /> Sync now
                      </button>
                      <button
                        onClick={() =>
                          set({ cloudConnected: false, cloudAccount: undefined })
                        }
                        className="px-2 h-7 rounded border border-border hover:bg-destructive/10 hover:text-destructive text-xs"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={() =>
                    set({
                      cloudConnected: true,
                      cloudAccount: 'shop@example.com',
                      lastCloudSyncAt: new Date().toISOString(),
                    })
                  }
                >
                  <Cloud className="size-4" /> Connect {PROVIDERS.find((p) => p.id === b.cloudProvider)?.label}
                </Button>
              )}
            </div>
          )}

          {b.cloudProvider === 'none' && (
            <div className="rounded-md border border-dashed border-border p-3 text-[12px] text-muted-foreground flex items-start gap-2">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              <div>
                Cloud sync is disabled. Pick a provider above to enable cross-device sync. You can
                still use Local backup without connecting a provider.
              </div>
            </div>
          )}

          <div className="border-t border-border pt-3 space-y-1">
            <ToggleRow
              label="Show sync history"
              checked={showHistory}
              onChange={setShowHistory}
            />
            {showHistory && (
              <div className="text-[12px] divide-y divide-border rounded-md border border-border">
                {[
                  { when: 'Today, 14:32', size: '1.2 MB', status: 'ok' as const },
                  { when: 'Today, 09:11', size: '1.2 MB', status: 'ok' as const },
                  { when: 'Yesterday, 22:01', size: '1.1 MB', status: 'failed' as const },
                  { when: 'Yesterday, 09:08', size: '1.1 MB', status: 'ok' as const },
                ].map((row, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2">
                    {row.status === 'ok' ? (
                      <CheckCircle2 className="size-3.5 text-success" />
                    ) : (
                      <AlertCircle className="size-3.5 text-destructive" />
                    )}
                    <span className="font-mono text-muted-foreground">{row.when}</span>
                    <span className="ml-auto text-muted-foreground">{row.size}</span>
                    {row.status === 'failed' && (
                      <button className="px-2 h-6 rounded border border-border hover:bg-secondary text-[11px]">
                        Retry
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Data export */}
        <Card className="p-5 space-y-3 xl:col-span-2">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-md bg-secondary grid place-items-center text-muted-foreground">
              <Database className="size-5" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Data export</div>
              <div className="text-xs text-muted-foreground">
                Download CSV exports for accounting, audits, or migration.
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {['Sales', 'Purchases', 'Products', 'Customers', 'Suppliers', 'Stock'].map((kind) => (
              <button
                key={kind}
                onClick={() => alert(`Exporting ${kind}.csv (mock)`)}
                className="flex items-center justify-between gap-2 px-3 h-10 rounded-md border border-border hover:bg-secondary text-sm"
              >
                <span>{kind}</span>
                <FileDown className="size-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Need a full snapshot? Use the Local backup button — that captures everything in one
            file.
          </div>
        </Card>
      </div>
    </div>
  );
}
