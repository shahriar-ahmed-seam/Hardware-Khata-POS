import { useEffect, useState } from 'react';
import { Usb, HardDrive, Loader2, CheckCircle2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useBackup, type UsbDrive } from '@/stores/backup';
import { useCan } from '@/hooks/useCan';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';

/**
 * "Backup to Pendrive" — one button on the dashboard.
 *
 * WHY IT IS HERE AND NOT ONLY IN SETTINGS
 * The scheduled backup writes to a folder on the same PC (and, if the owner set
 * it up, into OneDrive). Neither survives the machine being stolen or the disk
 * dying while the internet is down. A stick the owner takes home does. That only
 * works if taking a copy is a one-tap job on the screen they already look at
 * every morning — buried three levels into Settings, it would never happen.
 *
 * The flow is deliberately short:
 *   no drive plugged in → say so plainly, in words that say what to do
 *   exactly one drive    → just write it
 *   several drives       → ask which, because writing the shop's whole database
 *                          onto the wrong stick is not something to guess at
 *
 * Gated on `settings.backup` (Admin): a snapshot is the entire shop — every
 * price, customer, phone number and balance — walking out of the building.
 */
/**
 * `tile` renders it to match the dashboard's fixed quick-action grid (two rows of
 * four, see QuickActions.tsx) instead of the old inline header button, which was
 * one of the buttons that slid under the sidebar on a narrow window.
 */
export function PendriveBackup({ variant = 'inline' }: { variant?: 'inline' | 'tile' }) {
  const backupToUsb = useBackup((s) => s.backupToUsb);
  const backupToFolder = useBackup((s) => s.backupToFolder);
  const hydrate = useBackup((s) => s.hydrate);
  const lastUsbAt = useBackup((s) => s.config.lastUsbBackupAt);
  const lastUsbLabel = useBackup((s) => s.config.lastUsbLabel);
  const canBackup = useCan('settings.backup');

  const [running, setRunning] = useState(false);
  const [choices, setChoices] = useState<UsbDrive[] | null>(null);
  /**
   * Set when the app could not ask Windows which drives are removable — usually
   * PowerShell blocked by policy on the shop's PC. Saying "No pendrive found"
   * there would be a lie, and it would leave the owner believing there is no way
   * to get a copy off the machine. So we say what happened and offer the route
   * that always works: they can see the stick in Explorer, so they can point at it.
   */
  const [detectionFailed, setDetectionFailed] = useState<string | null>(null);

  // Read the stored config once so the tooltip can report the last pendrive
  // backup truthfully. `backup.status` is an open read; this component only
  // renders for a user who may take backups anyway.
  useEffect(() => {
    if (canBackup) void hydrate();
  }, [canBackup, hydrate]);

  if (!canBackup) return null;

  const succeeded = (label?: string, unplug = true) => {
    setChoices(null);
    setDetectionFailed(null);
    toast.success(`Backup saved to ${label ?? 'the drive'}`, {
      description: unplug ? 'You can unplug the pendrive now.' : undefined,
      duration: 8000,
    });
  };

  const run = async (drive?: string) => {
    setRunning(true);
    const res = await backupToUsb(drive);
    setRunning(false);

    if (res.ok) {
      succeeded(res.driveLabel);
      return;
    }

    // Several drives connected — ask, don't guess.
    if (res.drives && res.drives.length > 1) {
      setChoices(res.drives);
      return;
    }

    setChoices(null);

    // We could not look. Do not claim there is no pendrive; offer the way round it.
    if (res.detection === 'unavailable') {
      setDetectionFailed(
        res.error ?? 'The app could not check which drives are removable on this computer.',
      );
      return;
    }

    toast.error(res.error ?? 'Pendrive backup failed');
  };

  /** Let the owner point at the drive themselves. Always available as a fallback. */
  const runManual = async () => {
    setRunning(true);
    const res = await backupToFolder();
    setRunning(false);
    if (res.ok) {
      succeeded(res.driveLabel, false);
      return;
    }
    // Closing the picker is not a failure worth a red toast.
    if (res.cancelled) return;
    toast.error(res.error ?? 'Could not save the copy');
  };

  const title = lastUsbAt
    ? `Last pendrive backup: ${new Date(lastUsbAt).toLocaleString('en-GB')}${
        lastUsbLabel ? ` — ${lastUsbLabel}` : ''
      }`
    : 'No pendrive backup taken yet';

  return (
    <>
      {variant === 'tile' ? (
        <button
          onClick={() => void run()}
          disabled={running}
          className="block w-full text-left"
          title={title}
        >
          <div
            className={cn(
              'h-full min-h-[3.25rem] w-full rounded-lg px-3 py-2 flex items-center gap-2.5 text-white transition shadow-sm bg-blue-600 hover:bg-blue-700',
              running && 'opacity-70',
            )}
          >
            {running ? (
              <Loader2 className="size-5 shrink-0 animate-spin" />
            ) : (
              <Usb className="size-5 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight truncate">
                {running ? 'Saving to Pendrive…' : 'Backup to Pendrive'}
              </div>
              <div className="text-[10px] opacity-80 leading-tight truncate">
                A copy you can take home
              </div>
            </div>
          </div>
        </button>
      ) : (
        <button onClick={() => void run()} disabled={running} className="flex" title={title}>
          <div
            className={cn(
              'h-9 px-3 rounded-md border border-border flex items-center gap-2 transition hover:shadow-sm bg-blue-600',
              running && 'opacity-70',
            )}
          >
            {running ? (
              <Loader2 className="size-4 text-white animate-spin" />
            ) : (
              <Usb className="size-4 text-white" />
            )}
            <span className="text-sm font-medium text-white whitespace-nowrap">
              {running ? 'Saving to Pendrive…' : 'Backup to Pendrive'}
            </span>
          </div>
        </button>
      )}

      <Modal
        open={!!choices}
        onClose={() => setChoices(null)}
        title="Which pendrive?"
        subtitle="More than one removable drive is connected."
        width="max-w-md"
      >
        <div className="p-4 space-y-2">
          {(choices ?? []).map((d) => (
            <button
              key={d.root}
              disabled={running}
              onClick={() => void run(d.root)}
              className="w-full flex items-center gap-3 rounded-lg border border-border px-3 py-3 text-left hover:border-primary hover:bg-secondary/40 transition disabled:opacity-60"
            >
              <div className="size-10 rounded-md bg-secondary grid place-items-center shrink-0">
                <HardDrive className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm truncate">{d.display}</div>
                <div className="text-xs text-muted-foreground">
                  {d.freeBytes === null ? '—' : `${formatGb(d.freeBytes)} free`}
                  {d.totalBytes !== null && ` of ${formatGb(d.totalBytes)}`}
                </div>
              </div>
              <CheckCircle2 className="size-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
        <div className="border-t border-border px-4 py-3 flex justify-end">
          <Button variant="outline" onClick={() => setChoices(null)}>
            Cancel
          </Button>
        </div>
      </Modal>

      {/* Detection blocked on this PC — say so, and give them the way round it. */}
      <Modal
        open={!!detectionFailed}
        onClose={() => setDetectionFailed(null)}
        title="Choose the drive yourself"
        subtitle="This computer would not tell the app which drives are removable."
        width="max-w-md"
      >
        <div className="p-4 space-y-3 text-sm">
          <p className="text-muted-foreground">{detectionFailed}</p>
          <p>
            Your pendrive is still fine to use — pick it in the next window and the copy will be
            written to it. Look for the drive letter Windows gave it, for example{' '}
            <span className="font-mono" data-no-i18n>
              E:
            </span>
            .
          </p>
          <div className="rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            This saves one copy where you choose. It does not change where your scheduled
            backups go, and it does not delete anything already on the drive.
          </div>
        </div>
        <div className="border-t border-border px-4 py-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDetectionFailed(null)}>
            Cancel
          </Button>
          <Button disabled={running} onClick={() => void runManual()}>
            <HardDrive className="size-4" /> Choose folder…
          </Button>
        </div>
      </Modal>
    </>
  );
}

/** Bytes as GB/MB. Windows reports these, so they are real numbers, not estimates. */
function formatGb(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}
