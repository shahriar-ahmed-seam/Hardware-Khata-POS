import { useEffect } from 'react';
import {
  CloudUpload,
  HardDrive,
  Download,
  Upload,
  RotateCcw,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Database,
  FileDown,
  FileText,
  ShieldCheck,
  Usb,
} from 'lucide-react';
import { PendriveBackup } from '@/components/dashboard/PendriveBackup';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useBackup, type ExportKind } from '@/stores/backup';
import { cn } from '@/lib/utils';

/**
 * BACKUP & CLOUD SAVING
 *
 * Every number and every path on this screen is read back from the backend after
 * each action — nothing is assumed to have worked. A backup screen that reports
 * optimistic success is worse than no screen, because the owner stops checking.
 *
 * "Cloud" is implemented as snapshots written into a folder the owner's existing
 * OneDrive / Google Drive / Dropbox client already syncs. That is stated plainly
 * in the UI: no account, no password, nothing sent anywhere by this app.
 */

const AUTO_OPTIONS: { id: 'off' | 'daily' | 'on-shift-close'; label: string; hint: string }[] = [
  { id: 'off', label: 'Off', hint: 'Only when you press Back up now' },
  { id: 'daily', label: 'Daily', hint: 'Once a day, after 2 AM' },
  { id: 'on-shift-close', label: 'On shift close', hint: 'Right after the Z-Report' },
];

const KEEP_OPTIONS = [7, 14, 30, 90];

const EXPORTS: { kind: ExportKind; label: string }[] = [
  { kind: 'sales', label: 'Sales' },
  { kind: 'purchases', label: 'Purchases' },
  { kind: 'products', label: 'Products' },
  { kind: 'customers', label: 'Customers' },
  { kind: 'suppliers', label: 'Suppliers' },
  { kind: 'stock', label: 'Stock' },
];

function formatTime(iso?: string): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Never';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes?: number | null): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BackupPage() {
  const config = useBackup((s) => s.config);
  const snapshots = useBackup((s) => s.snapshots);
  const folderReady = useBackup((s) => s.folderReady);
  const liveBytes = useBackup((s) => s.liveBytes);
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
  const runNow = useBackup((s) => s.runNow);
  const restore = useBackup((s) => s.restore);
  const exportCsv = useBackup((s) => s.exportCsv);

  useEffect(() => {
    void hydrate();
    void loadFolderOptions();
    void loadInvoicePdfs();
  }, [hydrate, loadFolderOptions, loadInvoicePdfs]);

  const cloudRoots = folderOptions.filter((o) => o.cloud);

  return (
    <div>
      <SettingsHeader
        title="Backup & Cloud"
        subtitle="Keep a safe copy of your shop data"
        actions={
          <Button onClick={() => void runNow()} disabled={busy || !config.folder}>
            <Download className="size-4" /> Back up now
          </Button>
        }
      />

      <div className="p-6 max-w-5xl grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ---------------- Pendrive (off-site copy) ---------------- */}
        {/* The folder backup and the cloud copy both die with the building. This
            is the copy that leaves it. Also on the dashboard, because a backup
            that needs three clicks to find is a backup nobody takes. */}
        <Card className="p-5 space-y-4 xl:col-span-2">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-md bg-secondary grid place-items-center text-muted-foreground">
              <Usb className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">Copy to a pendrive</div>
              <div className="text-xs text-muted-foreground">
                Plug in a pendrive and press the button. The copy is checked before it counts as
                done, so you know it will open again. Take it home — that is the copy that
                survives a stolen or dead computer.
              </div>
            </div>
            <PendriveBackup />
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
            <div className="text-2xs uppercase font-semibold text-muted-foreground tracking-[0.06em]">
              Last pendrive backup
            </div>
            {config.lastUsbBackupAt ? (
              <>
                <div className="text-sm">
                  {new Date(config.lastUsbBackupAt).toLocaleString('en-GB')}
                  {config.lastUsbLabel ? ` · ${config.lastUsbLabel}` : ''}
                </div>
                <div className="font-mono text-xs break-all text-muted-foreground" data-no-i18n>
                  {config.lastUsbBackupPath ?? ''}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Never</div>
            )}
          </div>
        </Card>

        {/* ---------------- Where backups go ---------------- */}
        <Card className="p-5 space-y-4 xl:col-span-2">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-md bg-secondary grid place-items-center text-muted-foreground">
              {config.cloudFolder ? (
                <CloudUpload className="size-5" />
              ) : (
                <HardDrive className="size-5" />
              )}
            </div>
            <div className="flex-1">
              <div className="font-semibold flex items-center gap-2">
                Backup folder
                {config.cloudFolder ? (
                  <Badge variant="success">
                    <CheckCircle2 className="size-3" /> Cloud synced
                    {config.cloudLabel ? ` · ${config.cloudLabel}` : ''}
                  </Badge>
                ) : (
                  <Badge variant="default">This computer only</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                A full copy of your shop database is saved here. Choose a folder that your
                OneDrive, Google Drive or Dropbox app syncs, and the copy is kept online too.
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
            <div className="text-2xs uppercase font-semibold text-muted-foreground tracking-[0.06em]">
              Current folder
            </div>
            <div className="font-mono text-xs break-all" data-no-i18n>
              {config.folder || '—'}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button variant="outline" onClick={() => void chooseFolder()}>
                <FolderOpen className="size-4" /> Change folder…
              </Button>
              <Button variant="outline" onClick={() => void reveal()} disabled={!config.folder}>
                <FolderOpen className="size-4" /> Open folder
              </Button>
              {!folderReady && config.folder && (
                <span className="text-xs text-destructive inline-flex items-center gap-1">
                  <AlertCircle className="size-3.5" /> This folder cannot be written to.
                </span>
              )}
            </div>
          </div>

          {cloudRoots.length > 0 && (
            <div>
              <div className="text-2xs uppercase font-semibold text-muted-foreground tracking-[0.06em] mb-1">
                Cloud folders found on this computer
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {cloudRoots.map((o) => {
                  const active = config.folder === o.path;
                  return (
                    <button
                      key={o.id + o.path}
                      onClick={() => void setFolder(o.path)}
                      className={cn(
                        'rounded-md border p-3 text-left transition',
                        active
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-secondary',
                      )}
                    >
                      <div className="text-sm font-semibold inline-flex items-center gap-1.5">
                        <CloudUpload className="size-3.5" /> {o.label}
                      </div>
                      <div
                        className="text-2xs text-muted-foreground mt-0.5 font-mono break-all"
                        data-no-i18n
                      >
                        {o.path}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground flex items-start gap-2">
            <ShieldCheck className="size-4 mt-0.5 shrink-0" />
            <div>
              This app never sends your data over the internet by itself. It writes the backup
              file to the folder you choose; if that folder belongs to a cloud app you already
              installed, that app uploads it. No account or password is needed here.
            </div>
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
                Where Save as PDF puts your copy of an invoice.
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
            <div className="text-2xs uppercase font-semibold text-muted-foreground tracking-[0.06em]">
              Current PDF folder
            </div>
            <div className="font-mono text-xs break-all" data-no-i18n>
              {config.pdfFolder || '—'}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button variant="outline" onClick={() => void choosePdfFolder()}>
                <FolderOpen className="size-4" /> Change folder…
              </Button>
              <Button
                variant="outline"
                onClick={() => void revealPdfFolder()}
                disabled={!config.pdfFolder}
              >
                <FolderOpen className="size-4" /> Open folder
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground flex items-start gap-2">
            <ShieldCheck className="size-4 mt-0.5 shrink-0" />
            <div>
              Every invoice PDF is saved three times: here, next to your database, and in your
              backup folder. So an invoice is protected exactly like your shop data, and if your
              backup folder is cloud synced the invoice goes online with it.
            </div>
          </div>

          {/* In-app view of the archive, so the owner can confirm invoices are
              really accumulating without opening a file manager. */}
          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="text-2xs uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                Saved invoice PDFs
              </div>
              <Button variant="outline" onClick={() => void loadInvoicePdfs()} className="h-8">
                <RotateCcw className="size-3.5" /> Refresh
              </Button>
            </div>
            {invoicePdfs.length === 0 ? (
              <div className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                No invoice PDFs saved yet. Use Save as PDF on a receipt.
              </div>
            ) : (
              <div className="divide-y divide-border rounded-md border border-border max-h-64 overflow-auto">
                {invoicePdfs.map((f) => (
                  <div key={f.path} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <FileText className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate" data-no-i18n>
                        {f.name}
                      </div>
                      <div className="text-2xs text-muted-foreground">{formatTime(f.at)}</div>
                    </div>
                    <div className="ml-auto text-xs text-muted-foreground tabular shrink-0">
                      {formatBytes(f.bytes)}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void openInvoicePdf(f.path)}
                    >
                      Open
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* ---------------- Schedule + last run ---------------- */}
        <Card className="p-5 space-y-4">
          <div>
            <div className="font-semibold">Automatic backup</div>
            {/* One text node per sentence: the Bangla layer matches whole
                phrases, so a nested <span> mid-sentence would split this into
                fragments that cannot be translated. */}
            <div className="text-xs text-muted-foreground">
              Recommended: On shift close. It captures the day&apos;s takings right after the
              Z-Report.
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {AUTO_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => void configure({ auto: opt.id })}
                className={cn(
                  'rounded-md border p-2.5 text-left transition min-h-[64px]',
                  config.auto === opt.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-secondary',
                )}
              >
                <div className="text-sm font-semibold">{opt.label}</div>
                <div className="text-2xs text-muted-foreground mt-0.5">{opt.hint}</div>
              </button>
            ))}
          </div>

          <div>
            <div className="text-2xs uppercase font-semibold text-muted-foreground tracking-[0.06em] mb-1">
              How many backups to keep
            </div>
            <div className="flex items-center gap-2">
              {KEEP_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => void configure({ keep: n })}
                  className={cn(
                    'h-10 px-4 rounded-md border text-sm font-medium transition tabular',
                    config.keep === n
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-secondary',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-1.5">
              Older backups are deleted automatically once this many newer ones exist.
            </div>
          </div>

          <div className="border-t border-border pt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="text-2xs uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                Last backup
              </div>
              <div className="text-sm font-medium mt-0.5">{formatTime(config.lastBackupAt)}</div>
              <div className="text-xs text-muted-foreground">
                {formatBytes(config.lastBackupBytes)}
              </div>
            </div>
            <div>
              <div className="text-2xs uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                Current database
              </div>
              <div className="text-sm font-medium mt-0.5">{formatBytes(liveBytes)}</div>
            </div>
          </div>

          {config.lastError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">The last backup did not finish</div>
                <div className="mt-0.5 break-words" data-no-i18n>
                  {config.lastError}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* ---------------- Saved backups + restore ---------------- */}
        <Card className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">Saved backups</div>
              <div className="text-xs text-muted-foreground">
                Newest first. Each file is a complete copy, checked after it was written.
              </div>
            </div>
            <Button variant="outline" onClick={() => void hydrate()}>
              <RotateCcw className="size-4" /> Refresh
            </Button>
          </div>

          {snapshots.length === 0 ? (
            <div className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
              No backups yet. Press the Back up now button.
            </div>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border max-h-72 overflow-auto">
              {snapshots.map((s) => (
                <div key={s.path} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <CheckCircle2 className="size-4 text-success shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium">{formatTime(s.at)}</div>
                    <div className="text-2xs text-muted-foreground font-mono truncate" data-no-i18n>
                      {s.name}
                    </div>
                  </div>
                  <div className="ml-auto text-xs text-muted-foreground tabular shrink-0">
                    {formatBytes(s.bytes)}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void restore(s.path)}
                    disabled={busy}
                  >
                    <Upload className="size-3.5" /> Restore
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-border pt-3 space-y-2">
            <div className="text-2xs uppercase font-semibold text-muted-foreground tracking-[0.06em]">
              Restore from another file
            </div>
            <Button variant="outline" onClick={() => void restore()} disabled={busy}>
              <Upload className="size-4" /> Choose backup file…
            </Button>
            <div className="text-xs text-muted-foreground">
              Restoring replaces everything in the shop with the contents of that backup. You will
              be asked to confirm, a copy of the current data is saved first, and the app restarts.
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {EXPORTS.map((e) => (
              <button
                key={e.kind}
                onClick={() => void exportCsv(e.kind)}
                disabled={busy || !config.folder}
                className="flex items-center justify-between gap-2 px-3 h-11 rounded-md border border-border hover:bg-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{e.label}</span>
                <FileDown className="size-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">
            Need everything in one file? Use Back up now — that captures the whole database.
          </div>
        </Card>
      </div>
    </div>
  );
}
