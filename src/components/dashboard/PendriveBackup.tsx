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
  const hydrate = useBackup((s) => s.hydrate);
  const lastUsbAt = useBackup((s) => s.config.lastUsbBackupAt);
  const lastUsbLabel = useBackup((s) => s.config.lastUsbLabel);
  const canBackup = useCan('settings.backup');

  const [running, setRunning] = useState(false);
  const [choices, setChoices] = useState<UsbDrive[] | null>(null);

  // Read the stored config once so the tooltip can report the last pendrive
  // backup truthfully. `backup.status` is an open read; this component only
  // renders for a user who may take backups anyway.
  useEffect(() => {
    if (canBackup) void hydrate();
  }, [canBackup, hydrate]);

  if (!canBackup) return null;

  const run = async (drive?: string) => {
    setRunning(true);
    const res = await backupToUsb(drive);
    setRunning(false);

    if (res.ok) {
      setChoices(null);
      toast.success(`Backup saved to ${res.driveLabel ?? 'the pendrive'}`, {
        description: 'You can unplug the pendrive now.',
        duration: 8000,
      });
      return;
    }

    // Several drives connected — ask, don't guess.
    if (res.drives && res.drives.length > 1) {
      setChoices(res.drives);
      return;
    }

    setChoices(null);
    toast.error(res.error ?? 'Pendrive backup failed');
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
    </>
  );
}

/** Bytes as GB/MB. Windows reports these, so they are real numbers, not estimates. */
function formatGb(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}
