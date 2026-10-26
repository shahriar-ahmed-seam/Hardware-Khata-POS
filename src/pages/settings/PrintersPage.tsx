import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Save, Printer, Star, Send, RefreshCw, Network, Usb } from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Drawer';
import { Segmented } from '@/components/ui/Segmented';
import { ToggleRow } from '@/components/ui/ToggleRow';
import {
  normalizePrinter,
  useSettings,
  type PrinterConnection,
  type PrinterPaperWidth,
  type PrinterProfile,
} from '@/stores/settings';
import { api, hasBackend } from '@/lib/api';
import { testPrint } from '@/lib/printing';
import { confirm } from '@/stores/confirm';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';

/**
 * RECEIPT PRINTERS (Settings → Devices).
 *
 * Two kinds of connection, because that is what Bangladeshi shops have:
 *  - Installed printer: a USB thermal printer (Xprinter, Rongta, Epson TM…) or
 *    an A4 printer with its Windows driver. Picked from the PC's own printer
 *    list and printed silently as a page, so Bangla prints.
 *  - Network: a LAN thermal printer at IP:port (usually 9100), sent ESC/POS.
 *
 * Bluetooth, COM port, model and encoding are gone: none of them did anything.
 * Old profiles are read through `normalizePrinter` (src/stores/settings.ts).
 */

interface InstalledPrinter {
  name: string;
  displayName: string;
  isDefault: boolean;
  description: string;
  status: number;
  statusText: string;
}

/** The PC's installed printers, from the main process (`printers.list`). */
function useInstalledPrinters() {
  const [items, setItems] = useState<InstalledPrinter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!hasBackend()) {
      setError('The printer list is only available in the desktop app.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setItems(await api<InstalledPrinter[]>('printers.list'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { items, loading, error, refresh };
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const HOSTNAME = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

function addressError(host: string, port: string): string | null {
  const h = host.trim();
  if (!h) return 'Enter the printer\'s IP address.';
  if (!IPV4.test(h) && (!HOSTNAME.test(h) || /^\d+(\.\d+)*$/.test(h))) return 'This is not an IP address or a computer name.';
  const p = Number(port);
  if (!Number.isInteger(p) || p < 1 || p > 65535) return 'The port must be a number from 1 to 65535.';
  return null;
}

const paperLabel = (w: PrinterPaperWidth) => (w === 210 ? 'A4' : `${w} mm`);

export default function PrintersPage() {
  const stored = useSettings((s) => s.printers);
  const printers = useMemo(() => stored.map(normalizePrinter), [stored]);
  const shopName = useSettings((s) => s.business.name?.trim() ?? '');
  const add = useSettings((s) => s.addPrinter);
  const update = useSettings((s) => s.updatePrinter);
  const remove = useSettings((s) => s.removePrinter);
  const [editing, setEditing] = useState<PrinterProfile | 'new' | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const defaultId = (printers.find((p) => p.isDefault) ?? printers[0])?.id;

  const runTest = async (p: PrinterProfile) => {
    if (testing) return;
    setTesting(p.id);
    try {
      await testPrint(p, shopName);
      toast.success('Test page sent to the printer', { description: p.name });
    } catch (e) {
      toast.error('Test print failed', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setTesting(null);
    }
  };

  return (
    <div>
      <SettingsHeader
        title="Receipt Printers"
        subtitle="USB / installed printers, network thermal printers, test print"
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add Printer
          </Button>
        }
      />

      <div className="p-6 max-w-4xl space-y-3">
        {printers.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No printer is set up, so Print opens the print dialog. Add a printer to print receipts
            straight away.
          </Card>
        )}
        {printers.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-md bg-secondary grid place-items-center text-muted-foreground">
                {p.connection === 'network' ? <Network className="size-4" /> : <Printer className="size-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{p.name}</span>
                  {p.id === defaultId && (
                    <Badge variant="info">
                      <Star className="size-3" /> Default
                    </Badge>
                  )}
                  <Badge variant="default">
                    {p.connection === 'network' ? 'Network' : 'Installed printer'}
                  </Badge>
                </div>
                <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-1 text-xs text-muted-foreground">
                  {p.connection === 'network' ? (
                    <span className="font-mono">
                      {p.host}:{p.port}
                    </span>
                  ) : (
                    <span>{p.deviceName || 'Windows default printer'}</span>
                  )}
                  <span>· {paperLabel(p.paperWidth)}</span>
                  {p.copies > 1 && <span>· {p.copies} copies</span>}
                  {p.connection === 'network' && p.autoCut && <span>· Auto-cut</span>}
                  {p.connection === 'network' && p.openDrawer && <span>· Opens drawer</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => void runTest(p)}
                  disabled={!!testing}
                  className="text-xs px-2 h-7 rounded border border-border hover:bg-secondary inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <Send className="size-3" /> {testing === p.id ? 'Printing…' : 'Test print'}
                </button>
                {p.id !== defaultId && (
                  <button
                    onClick={() => update(p.id, { isDefault: true })}
                    className="text-xs px-2 h-7 rounded border border-border hover:bg-secondary"
                  >
                    Set default
                  </button>
                )}
                <button
                  onClick={() => setEditing(p)}
                  aria-label="Edit"
                  className="size-8 grid place-items-center rounded hover:bg-secondary"
                >
                  <Edit2 className="size-3.5" />
                </button>
                <button
                  onClick={async () => {
                    if (await confirm({ title: `Delete printer "${p.name}"?`, variant: 'destructive' }))
                      remove(p.id);
                  }}
                  aria-label="Delete"
                  className="size-8 grid place-items-center rounded hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          </Card>
        ))}

        <div className="text-xs text-muted-foreground space-y-1 pt-2">
          <p>
            Receipts, X/Z reports and invoice reprints print on the default printer. Purchase
            notes print on an A4 printer when there is one.
          </p>
          <p>
            Installed printers: the cash drawer and paper cut are set in the printer's own
            settings in Windows (Printing Preferences), not here.
          </p>
        </div>
      </div>

      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        width="max-w-lg"
        title={editing === 'new' ? 'Add Printer' : 'Edit Printer'}
      >
        {editing && (
          <Form
            initial={editing === 'new' ? undefined : editing}
            shopName={shopName}
            onSave={(d) => {
              if (editing === 'new') add(d);
              else update(editing.id, d);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Drawer>
    </div>
  );
}

function Form({
  initial,
  shopName,
  onSave,
  onCancel,
}: {
  initial?: PrinterProfile;
  shopName: string;
  onSave: (d: Omit<PrinterProfile, 'id'>) => void;
  onCancel: () => void;
}) {
  const installed = useInstalledPrinters();
  const [name, setName] = useState(initial?.name ?? '');
  const [connection, setConnection] = useState<PrinterConnection>(initial?.connection ?? 'driver');
  const [deviceName, setDeviceName] = useState(initial?.deviceName ?? '');
  const [host, setHost] = useState(initial?.host ?? '');
  const [port, setPort] = useState(String(initial?.port ?? 9100));
  const [paperWidth, setPaperWidth] = useState<PrinterPaperWidth>(initial?.paperWidth ?? 80);
  const [copies, setCopies] = useState(String(initial?.copies ?? 1));
  const [autoCut, setAutoCut] = useState(initial?.autoCut ?? true);
  const [openDrawer, setOpenDrawer] = useState(initial?.openDrawer ?? false);
  const [isDefault, setIsDefault] = useState(!!initial?.isDefault);
  const [testing, setTesting] = useState(false);

  // A network printer is a thermal roll; A4 is only for installed printers.
  useEffect(() => {
    if (connection === 'network' && paperWidth === 210) setPaperWidth(80);
  }, [connection, paperWidth]);

  // A new profile starts on the PC's default printer once the list arrives.
  useEffect(() => {
    if (initial || deviceName || installed.items.length === 0) return;
    const def = installed.items.find((p) => p.isDefault);
    if (def) setDeviceName(def.name);
  }, [initial, deviceName, installed.items]);

  const netError = connection === 'network' ? addressError(host, port) : null;
  const copiesN = Math.max(1, Math.min(10, Math.floor(Number(copies) || 1)));
  const canSave = !!name.trim() && !netError;

  const draft = (): Omit<PrinterProfile, 'id'> => {
    const p = normalizePrinter({
      id: initial?.id ?? 'draft',
      name: name.trim() || 'Printer',
      connection,
      deviceName,
      host: host.trim(),
      port: Number(port),
      paperWidth,
      copies: copiesN,
      autoCut,
      openDrawer,
      isDefault,
    });
    const { id: _id, ...rest } = p;
    void _id;
    return rest;
  };

  const runTest = async () => {
    if (testing || netError) return;
    setTesting(true);
    try {
      await testPrint({ id: initial?.id ?? 'draft', ...draft() }, shopName);
      toast.success('Test page sent to the printer', { description: name.trim() || undefined });
    } catch (e) {
      toast.error('Test print failed', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setTesting(false);
    }
  };

  const savedMissing =
    connection === 'driver' &&
    !!deviceName &&
    installed.items.length > 0 &&
    !installed.items.some((p) => p.name === deviceName);

  const selectCls =
    'h-10 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSave) return;
        onSave(draft());
      }}
      className="flex flex-col flex-1 min-h-0"
    >
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <Field label="Name" required>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Counter Printer" />
        </Field>

        <Field label="Connection">
          <Segmented
            ariaLabel="Connection"
            fullWidth
            value={connection}
            onChange={setConnection}
            options={[
              { value: 'driver', label: 'Installed printer (USB/driver)', icon: <Usb className="size-3.5" /> },
              { value: 'network', label: 'Network (IP:port)', icon: <Network className="size-3.5" /> },
            ]}
          />
        </Field>

        {connection === 'driver' ? (
          <Field label="Printer">
            <div className="flex items-center gap-2">
              <select value={deviceName} onChange={(e) => setDeviceName(e.target.value)} className={selectCls}>
                <option value="">Windows default printer</option>
                {installed.items.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.displayName}
                    {p.isDefault ? ' (default)' : ''}
                    {p.statusText && p.statusText !== 'Ready' ? ` · ${p.statusText}` : ''}
                  </option>
                ))}
                {savedMissing && <option value={deviceName}>{deviceName} (not found)</option>}
              </select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void installed.refresh()}
                disabled={installed.loading}
                aria-label="Refresh printer list"
                title="Refresh printer list"
              >
                <RefreshCw className={cn('size-4', installed.loading && 'animate-spin')} />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {installed.error
                ? installed.error
                : installed.items.length === 0 && !installed.loading
                  ? 'No printers are installed on this PC. Install the printer\'s driver, then refresh.'
                  : savedMissing
                    ? 'This printer is not installed on this PC any more. Pick another one.'
                    : 'Install the printer\'s Windows driver first; it then shows up here.'}
            </div>
          </Field>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="IP address">
                <Input
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="192.168.1.100"
                  className="font-mono"
                />
              </Field>
            </div>
            <Field label="Port">
              <Input
                value={port}
                onChange={(e) => setPort(e.target.value.replace(/[^\d]/g, ''))}
                inputMode="numeric"
                placeholder="9100"
                className="font-mono"
              />
            </Field>
            {netError && (host || port !== '9100') && (
              <div className="col-span-3 text-xs text-destructive">{netError}</div>
            )}
            <div className="col-span-3 text-xs text-muted-foreground">
              Prints English text only: Bangla letters print as "?". For Bangla, install the
              printer's driver and use Installed printer.
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Paper width">
            <select
              value={paperWidth}
              onChange={(e) => setPaperWidth(Number(e.target.value) as PrinterPaperWidth)}
              className={selectCls}
            >
              <option value={58}>58 mm</option>
              <option value={80}>80 mm</option>
              {connection === 'driver' && <option value={210}>A4</option>}
            </select>
          </Field>
          <Field label="Copies">
            <Input
              value={copies}
              onChange={(e) => setCopies(e.target.value.replace(/[^\d]/g, ''))}
              onBlur={() => setCopies(String(copiesN))}
              inputMode="numeric"
              className="font-mono"
            />
          </Field>
        </div>

        {connection === 'network' ? (
          <div className="rounded-md border border-border px-3 py-1">
            <ToggleRow label="Cut the paper after printing" checked={autoCut} onChange={setAutoCut} />
            <ToggleRow
              label="Open the cash drawer"
              desc="On the first print of a cash sale. The drawer must be plugged into the printer."
              checked={openDrawer}
              onChange={setOpenDrawer}
            />
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            The cash drawer and paper cut are handled by the printer's driver: turn on "Open cash
            drawer" in the printer's Printing Preferences in Windows.
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          Print receipts on this printer (default)
        </label>
      </div>
      <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-between gap-2">
        <Button type="button" variant="outline" onClick={() => void runTest()} disabled={testing || !!netError}>
          <Send className="size-4" /> {testing ? 'Printing…' : 'Test print'}
        </Button>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSave}>
            <Save className="size-4" /> {initial ? 'Save Changes' : 'Add Printer'}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full">
      <label className="text-xs font-semibold text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}
