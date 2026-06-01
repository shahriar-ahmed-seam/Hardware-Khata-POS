import { useState } from 'react';
import { Plus, Edit2, Trash2, Save, Printer, Star, Send } from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Drawer';
import { useSettings, type PrinterProfile } from '@/stores/settings';
import { useBranches } from '@/stores/branches';
import { confirm } from '@/stores/confirm';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';

export default function PrintersPage() {
  const printers = useSettings((s) => s.printers);
  const add = useSettings((s) => s.addPrinter);
  const update = useSettings((s) => s.updatePrinter);
  const remove = useSettings((s) => s.removePrinter);
  const [editing, setEditing] = useState<PrinterProfile | 'new' | null>(null);

  const setDefault = (id: string) => {
    printers.forEach((p) => update(p.id, { isDefault: p.id === id }));
  };

  return (
    <div>
      <SettingsHeader
        title="Receipt Printers"
        subtitle="Thermal printer profiles · test print"
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add Printer
          </Button>
        }
      />

      <div className="p-6 max-w-4xl space-y-3">
        {printers.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No printer configured. Add a printer profile to enable thermal printing.
          </Card>
        )}
        {printers.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-md bg-secondary grid place-items-center text-muted-foreground">
                <Printer className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{p.name}</span>
                  {p.isDefault && (
                    <Badge variant="info">
                      <Star className="size-3" /> Default
                    </Badge>
                  )}
                  <Badge variant="default">{p.connection}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {p.model && <span>{p.model}</span>}
                  {p.ipOrPort && <span className="font-mono">{p.ipOrPort}</span>}
                  <span>· {p.paperWidth}mm</span>
                  <span>· {p.encoding}</span>
                  {p.branch && <span>· {p.branch}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!p.isDefault && (
                  <button
                    onClick={() => setDefault(p.id)}
                    className="text-[11px] px-2 h-7 rounded border border-border hover:bg-secondary"
                  >
                    Set default
                  </button>
                )}
                <button
                  onClick={() => toast.success(`Test print sent to "${p.name}"`)}
                  className="text-[11px] px-2 h-7 rounded border border-border hover:bg-secondary inline-flex items-center gap-1"
                >
                  <Send className="size-3" /> Test
                </button>
                <button
                  onClick={() => setEditing(p)}
                  className="size-8 grid place-items-center rounded hover:bg-secondary"
                >
                  <Edit2 className="size-3.5" />
                </button>
                <button
                  onClick={async () => {
                    if (await confirm({ title: `Delete printer "${p.name}"?`, variant: 'destructive' }))
                      remove(p.id);
                  }}
                  className="size-8 grid place-items-center rounded hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          </Card>
        ))}
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
  onSave,
  onCancel,
}: {
  initial?: PrinterProfile;
  onSave: (d: Omit<PrinterProfile, 'id'>) => void;
  onCancel: () => void;
}) {
  const branches = useBranches((s) => s.items);
  const [name, setName] = useState(initial?.name ?? '');
  const [branch, setBranch] = useState(initial?.branch ?? '');
  const [connection, setConnection] = useState<PrinterProfile['connection']>(initial?.connection ?? 'USB');
  const [model, setModel] = useState(initial?.model ?? '');
  const [ipOrPort, setIpOrPort] = useState(initial?.ipOrPort ?? '');
  const [paperWidth, setPaperWidth] = useState<PrinterProfile['paperWidth']>(initial?.paperWidth ?? 80);
  const [encoding, setEncoding] = useState<PrinterProfile['encoding']>(initial?.encoding ?? 'UTF-8');
  const [isDefault, setIsDefault] = useState(!!initial?.isDefault);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({
          name: name.trim(),
          branch: branch || undefined,
          connection,
          model: model || undefined,
          ipOrPort: ipOrPort || undefined,
          paperWidth,
          encoding,
          isDefault,
        });
      }}
      className="flex flex-col flex-1 min-h-0"
    >
      <div className="flex-1 overflow-auto p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Name" required>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Counter Printer" />
          </Field>
          <Field label="Branch">
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="">Any</option>
              {branches.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Connection">
            <select
              value={connection}
              onChange={(e) => setConnection(e.target.value as PrinterProfile['connection'])}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="USB">USB</option>
              <option value="Network">Network (IP)</option>
              <option value="Bluetooth">Bluetooth</option>
            </select>
          </Field>
          <Field label="Model">
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Epson TM-T82" />
          </Field>
          <Field label={connection === 'Network' ? 'IP address' : 'Port / device'}>
            <Input
              value={ipOrPort}
              onChange={(e) => setIpOrPort(e.target.value)}
              placeholder={connection === 'Network' ? '192.168.1.100' : 'COM3 / /dev/usb/lp0'}
            />
          </Field>
          <Field label="Paper width">
            <select
              value={paperWidth}
              onChange={(e) => setPaperWidth(Number(e.target.value) as PrinterProfile['paperWidth'])}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value={50}>50 mm</option>
              <option value={58}>58 mm</option>
              <option value={80}>80 mm</option>
              <option value={210}>A4 / 210 mm</option>
            </select>
          </Field>
          <Field label="Encoding">
            <select
              value={encoding}
              onChange={(e) => setEncoding(e.target.value as PrinterProfile['encoding'])}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="UTF-8">UTF-8 (Bangla works)</option>
              <option value="GB18030">GB18030</option>
              <option value="CP437">CP437</option>
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          Mark as default printer
        </label>
      </div>
      <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          <Save className="size-4" /> {initial ? 'Save Changes' : 'Add Printer'}
        </Button>
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
    <div className={cn('w-full')}>
      <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}
