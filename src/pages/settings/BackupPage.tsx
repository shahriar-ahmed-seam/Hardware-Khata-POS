import { useEffect } from 'react';
import {
  CloudUpload,
  HardDrive,
  Upload,
  RotateCcw,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Database,
  FileDown,
  FileText,
  History,
  Usb,
} from 'lucide-react';
import { PendriveBackup } from '@/components/dashboard/PendriveBackup';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { BackupStatusBanner, formatBytes } from '@/components/settings/BackupStatus';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBackup, type BackupConfig, type ExportKind } from '@/stores/backup';
import { confirm } from '@/stores/confirm';
import { useDateFormat } from '@/lib/formatDate';
import { cn } from '@/lib/utils';

/**
 * BACKUP
 *
 * Every number and every path on this screen is read back from the backend after
 * each action — nothing is assumed to have worked. A backup screen that reports
 * optimistic success is worse than no screen, because the owner stops checking.
 *
 * Order: "am I safe?" first (status banner + Back up now), then the pendrive
 * copy, where backups go and when, CSV export, and — apart, at the bottom —
 * bringing old data back, which replaces everything.
 *
 * "Cloud" is a folder the owner's own OneDrive / Google Drive / Dropbox client
 * already syncs; this app sends nothing over the internet.
 */

type Auto = BackupConfig['auto'];

const AUTO_OPTIONS: { id: Auto; label: string; hint: string }[] = [
  { id: 'off', label: 'Off', hint: 'Only when you press Back up now' },
  { id: 'daily', label: 'Daily', hint: 'Once a day, after 2 AM' },
  { id: 'on-shift-close', label: 'On shift close', hint: 'Right after the Z-Report' },
];

const KEEP_OPTIONS = ['7', '14', '30', '90'] as const;

const EXPORTS: { kind: ExportKind; label: string }[] = [
  { kind: 'sales', label: 'Sales' },
  { kind: 'purchases', label: 'Purchases' },
  { kind: 'products', label: 'Products' },
  { kind: 'customers', label: 'Customers' },
  { kind: 'suppliers', label: 'Suppliers' },
  { kind: 'stock', label: 'Stock' },
  { kind: 'expenses', label: 'Expenses' },
];

export default function BackupPage() {
  const config = useBackup((s) => s.config);
  const snapshots = useBackup((s) => s.snapshots);
  const folderReady = useBackup((s) => s.folderReady);
  const folderOptions = useBackup((s) => s.folderOptions);
  const busy = useBackup((s) => s.busy);
  const hydrate = useBackup((s) => s.hydrate);
  const loadFolderOptions = useBackup((s) => s.loadFolderOptions);
  const configure = useBackup((s) => s.configure);
  const setFolder = useBackup((s) => s.setFolder);
  const chooseFolder = useBackup((s) => s.chooseFolder);
  const reveal = useBackup((s) => s.reveal);
  const choosePdfFolder = useBackup((s) => s.choosePdfFolder);
  const revealPdfFolder = useBackup((s) => s.revealPdfFolder);
  const invoicePdfs = useBackup((s) => s.invoicePdfs);
  const loadInvoicePdfs = useBackup((s) => s.loadInvoicePdfs);
  const openInvoicePdf = useBackup((s) => s.openInvoicePdf);
  const restore = useBackup((s) => s.restore);
  const exportCsv = useBackup((s) => s.exportCsv);
  const { dateTime } = useDateFormat();

  // The status banner hydrates the backup config itself.
  useEffect(() => {
    void loadFolderOptions();
    void loadInvoicePdfs();
  }, [loadFolderOptions, loadInvoicePdfs]);

  const cloudRoots = folderOptions.filter((o) => o.cloud);
  const autoLabel = AUTO_OPTIONS.find((o) => o.id === config.auto)?.label ?? 'Off';

  // In-app (Bangla-capable) warning first; the main process asks once more.
  const askRestore = async (file?: string) => {
    const ok = await confirm({
      title: 'Replace all shop data with this backup?',
      message: 'A copy of the current data is saved first, then the app restarts.',
      confirmLabel: 'Restore',
      variant: 'destructive',
    });
    if (ok) await restore(file);
  };

  return (
    <div>
      <SettingsHeader title="Backup" />

      <div className="p-6 max-w-5xl space-y-6">
        <BackupStatusBanner
          extra={
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="inline-flex gap-1.5">
                <span>Pendrive copy</span>
                <span className="text-foreground" data-no-i18n={config.lastUsbBackupAt ? true : undefined}>
                  {config.lastUsbBackupAt ? dateTime(config.lastUsbBackupAt) : 'Never'}
                </span>
              </span>
              <span className="inline-flex gap-1.5">
                <span>Automatic backup</span>
                <span className="text-foreground">{autoLabel}</span>
              </span>
            </span>
          }
        />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* ---------------- Pendrive (off-site copy) ---------------- */}
          {/* The folder backup and the cloud copy both die with the building. This
              is the copy that leaves it. */}
          <Card className="p-5 space-y-3 xl:col-span-2">
            <div className="flex flex-wrap items-start gap-3">
              <div className="size-10 rounded-md bg-secondary grid place-items-center text-muted-foreground">
                <Usb className="size-5" />
              </div>
              <div className="flex-1 min-w-[14rem]">
                <div className="font-semibold">Copy to a pendrive</div>
                <div className="text-xs text-muted-foreground">
                  Take it home — that is the copy that survives a stolen or dead computer.
                </div>
                {config.lastUsbBackupPath && (
                  <div className="font-mono text-xs break-all text-muted-foreground mt-1" data-no-i18n>
                    {config.lastUsbBackupPath}
                    {config.lastUsbLabel ? ` · ${config.lastUsbLabel}` : ''}
                  </div>
                )}
              </div>
              <PendriveBackup />
            </div>
          </Card>

          {/* ---------------- Where backups go ---------------- */}
          <Card className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-md bg-secondary grid place-items-center text-muted-foreground shrink-0">
                {config.cloudFolder ? <CloudUpload className="size-5" /> : <HardDrive className="size-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold flex flex-wrap items-center gap-2">
                  <span>Backup folder</span>
                  {config.cloudFolder ? (
                    <Badge variant="success">
                      <CheckCircle2 className="size-3.5" /> Cloud synced
                      {config.cloudLabel ? ` · ${config.cloudLabel}` : ''}
                    </Badge>
                  ) : (
                    <Badge variant="default">This computer only</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Pick a folder your OneDrive, Google Drive or Dropbox app syncs to keep a copy online.
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
              <div className="font-mono text-xs break-all" data-no-i18n>
                {config.folder || '—'}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => void chooseFolder()}>
                  <FolderOpen className="size-4" /> Change folder…
                </Button>
                <Button variant="outline" onClick={() => void reveal()} disabled={!config.folder}>
                  <FolderOpen className="size-4" /> Open folder
                </Button>
              </div>
              {!folderReady && config.folder && (
                <div className="text-sm text-destructive flex items-center gap-1.5">
                  <AlertCircle className="size-4" /> This folder cannot be written to.
                </div>
              )}
            </div>

            {cloudRoots.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Cloud folders found on this computer
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {cloudRoots.map((o) => {
                    const active = config.folder === o.path;
                    return (
                      <button
                        key={o.id + o.path}
                        type="button"
                        onClick={() => void setFolder(o.path)}
                        aria-pressed={active}
                        className={cn(
                          'rounded-md border p-3 text-left transition focus-ring',
                          active ? 'border-primary ring-1 ring-primary' : 'border-border hover:bg-secondary',
                        )}
                      >
                        <div className="text-sm font-semibold inline-flex items-center gap-1.5">
                          {active ? <CheckCircle2 className="size-4 text-primary" /> : <CloudUpload className="size-4" />}
                          {o.label}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 font-mono break-all" data-no-i18n>
                          {o.path}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              This app never sends your data over the internet by itself.
            </div>
          </Card>

          {/* ---------------- Schedule ---------------- */}
          <Card className="p-5 space-y-4">
            <div>
              <div className="font-semibold">Automatic backup</div>
              <div className="text-xs text-muted-foreground">
                Recommended: On shift close. It captures the day&apos;s takings right after the Z-Report.
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Automatic backup">
              {AUTO_OPTIONS.map((opt) => {
                const on = config.auto === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => void configure({ auto: opt.id })}
                    className={cn(
                      'rounded-md border p-2.5 text-left transition min-h-[4.5rem] focus-ring',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-secondary',
                    )}
                  >
                    <div className="text-sm font-semibold flex items-center gap-1">
                      {on && <CheckCircle2 className="size-4 shrink-0" />}
                      {opt.label}
                    </div>
                    <div className={cn('text-xs mt-0.5', on ? 'text-primary-foreground/85' : 'text-muted-foreground')}>
                      {opt.hint}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <div className="text-sm font-medium">How many backups to keep</div>
              <Segmented
                ariaLabel="How many backups to keep"
                value={String(config.keep)}
                onChange={(v) => void configure({ keep: Number(v) })}
                options={KEEP_OPTIONS.map((n) => ({ value: n, label: n }))}
              />
              <div className="text-xs text-muted-foreground">
                Older backups are deleted automatically once this many newer ones exist.
              </div>
            </div>
          </Card>

          {/* ---------------- CSV export ---------------- */}
          <Card className="p-5 space-y-3 xl:col-span-2">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-md bg-secondary grid place-items-center text-muted-foreground">
                <Database className="size-5" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">Data export</div>
                <div className="text-xs text-muted-foreground">
                  CSV files for your accountant, saved into an exports folder next to your backups.
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {EXPORTS.map((e) => (
                <button
                  key={e.kind}
                  type="button"
                  onClick={() => void exportCsv(e.kind)}
                  disabled={busy || !config.folder}
                  className="flex items-center justify-between gap-2 px-3 h-11 rounded-md border border-border hover:bg-secondary text-sm focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{e.label}</span>
                  <FileDown className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </Card>

          {/* ---------------- Restore (destructive, apart) ---------------- */}
          <Card className="p-5 space-y-3 xl:col-span-2 border-destructive/30">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-md bg-destructive/10 grid place-items-center text-destructive shrink-0">
                  <History className="size-5" />
                </div>
                <div>
                  <div className="font-semibold">Bring back old data</div>
                  <div className="text-xs text-muted-foreground">
                    Restoring replaces everything in the shop with the contents of that backup. You will
                    be asked to confirm, a copy of the current data is saved first, and the app restarts.
                  </div>
                </div>
              </div>
              <Button variant="outline" onClick={() => void hydrate()}>
                <RotateCcw className="size-4" /> Refresh
              </Button>
            </div>

            {snapshots.length === 0 ? (
              <EmptyState compact icon={History} title="No backups yet" message="Press the Back up now button." />
            ) : (
              <div className="divide-y divide-border rounded-md border border-border max-h-72 overflow-auto">
                {snapshots.map((s) => (
                  <div key={s.path} className="flex items-center gap-3 px-3 py-2.5 text-sm min-h-12">
                    <CheckCircle2 className="size-4 text-success shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium tabular" data-no-i18n>
                        {dateTime(s.at)}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate" data-no-i18n>
                        {s.name}
                      </div>
                    </div>
                    <div className="ml-auto text-xs text-muted-foreground tabular shrink-0">
                      {formatBytes(s.bytes)}
                    </div>
                    <Button
                      variant="outline"
                      className="text-destructive border-destructive/40 hover:bg-destructive/10"
                      onClick={() => void askRestore(s.path)}
                      disabled={busy}
                    >
                      <Upload className="size-4" /> Restore
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                variant="outline"
                className="text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={() => void askRestore()}
                disabled={busy}
              >
                <Upload className="size-4" /> Choose backup file…
              </Button>
              <span className="text-xs text-muted-foreground">Restore from another file</span>
            </div>
          </Card>

          {/* ---------------- Invoice PDF location ---------------- */}
          <Card className="p-5 space-y-4 xl:col-span-2">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-md bg-secondary grid place-items-center text-muted-foreground">
                <FileText className="size-5" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">Invoice PDF location</div>
                <div className="text-xs text-muted-foreground">
                  Where Save as PDF puts your copy of an invoice. Each PDF is also copied into the backup folder.
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
              <div className="font-mono text-xs break-all" data-no-i18n>
                {config.pdfFolder || '—'}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => void choosePdfFolder()}>
                  <FolderOpen className="size-4" /> Change folder…
                </Button>
                <Button variant="outline" onClick={() => void revealPdfFolder()} disabled={!config.pdfFolder}>
                  <FolderOpen className="size-4" /> Open folder
                </Button>
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-sm font-medium">Saved invoice PDFs</div>
                <Button variant="outline" onClick={() => void loadInvoicePdfs()}>
                  <RotateCcw className="size-4" /> Refresh
                </Button>
              </div>
              {invoicePdfs.length === 0 ? (
                <EmptyState
                  compact
                  icon={FileText}
                  title="No invoice PDFs saved yet"
                  message="Use Save as PDF on a receipt."
                />
              ) : (
                <div className="divide-y divide-border rounded-md border border-border max-h-64 overflow-auto">
                  {invoicePdfs.map((f) => (
                    <div key={f.path} className="flex items-center gap-3 px-3 py-2.5 text-sm min-h-12">
                      <FileText className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium truncate" data-no-i18n>
                          {f.name}
                        </div>
                        <div className="text-xs text-muted-foreground tabular" data-no-i18n>
                          {dateTime(f.at)}
                        </div>
                      </div>
                      <div className="ml-auto text-xs text-muted-foreground tabular shrink-0">
                        {formatBytes(f.bytes)}
                      </div>
                      <Button variant="outline" onClick={() => void openInvoicePdf(f.path)}>
                        Open
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
