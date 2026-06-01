import { useState } from 'react';
import { Edit2, Save, FileText, Plus, Trash2 } from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { Badge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Drawer';
import {
  previewSchemeNumber,
  useSettings,
  type DocType,
  type InvoiceScheme,
} from '@/stores/settings';
import { confirm } from '@/stores/confirm';
import { toast } from '@/stores/toast';

const DOC_LABEL: Record<DocType, string> = {
  sale: 'Sale Invoice',
  pos: 'POS Receipt',
  quotation: 'Quotation',
  draft: 'Draft',
  purchase: 'Purchase',
  return: 'Return',
  shipment: 'Shipment',
};

export default function InvoiceSchemesPage() {
  const schemes = useSettings((s) => s.schemes);
  const update = useSettings((s) => s.updateScheme);
  const add = useSettings((s) => s.addScheme);
  const remove = useSettings((s) => s.removeScheme);
  const [editing, setEditing] = useState<InvoiceScheme | 'new' | null>(null);

  return (
    <div>
      <SettingsHeader
        title="Invoice Schemes"
        subtitle="Numbering format per document type"
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add Scheme
          </Button>
        }
      />

      <div className="p-6 max-w-4xl space-y-3">
        {schemes.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-md bg-secondary grid place-items-center text-muted-foreground">
                <FileText className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{s.name}</span>
                  <Badge variant="info">{DOC_LABEL[s.docType]}</Badge>
                  {s.isDefault && <Badge variant="success">Default</Badge>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>Reset {s.resetRule}</span>
                  <span>·</span>
                  <span>Year {s.yearFormat}</span>
                  <span>·</span>
                  <span>Padding {s.counterPadding}</span>
                  <span>·</span>
                  <span>Start #{s.startNumber}</span>
                </div>
                <div className="mt-2 inline-flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Next:</span>
                  <span className="font-mono tabular bg-secondary/60 px-2 py-0.5 rounded">
                    {previewSchemeNumber(s)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditing(s)}
                  className="size-8 grid place-items-center rounded hover:bg-secondary text-muted-foreground"
                  title="Edit"
                >
                  <Edit2 className="size-3.5" />
                </button>
                <button
                  onClick={async () => {
                    if (s.isDefault) {
                      toast.error('Cannot delete the default scheme for this document type');
                      return;
                    }
                    if (await confirm({ title: `Delete "${s.name}"?`, variant: 'destructive' }))
                      remove(s.id);
                  }}
                  disabled={s.isDefault}
                  className="size-8 grid place-items-center rounded hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                  title={s.isDefault ? 'Cannot delete default' : 'Delete'}
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
        title={editing === 'new' ? 'Add Invoice Scheme' : 'Edit Invoice Scheme'}
      >
        {editing && (
          <SchemeForm
            initial={editing === 'new' ? undefined : editing}
            onSave={(data) => {
              if (editing === 'new') add(data);
              else update(editing.id, data);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Drawer>
    </div>
  );
}

function SchemeForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: InvoiceScheme;
  onSave: (data: Omit<InvoiceScheme, 'id'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [docType, setDocType] = useState<DocType>(initial?.docType ?? 'sale');
  const [prefix, setPrefix] = useState(initial?.prefix ?? 'INV');
  const [yearFormat, setYearFormat] = useState<InvoiceScheme['yearFormat']>(initial?.yearFormat ?? 'YYYY');
  const [separator, setSeparator] = useState(initial?.separator ?? '-');
  const [counterPadding, setCounterPadding] = useState(initial?.counterPadding ?? 4);
  const [resetRule, setResetRule] = useState<InvoiceScheme['resetRule']>(initial?.resetRule ?? 'yearly');
  const [startNumber, setStartNumber] = useState(initial?.startNumber ?? 1);
  const [isDefault, setIsDefault] = useState(!!initial?.isDefault);

  const previewObj: InvoiceScheme = {
    id: 'preview',
    name,
    docType,
    prefix,
    yearFormat,
    separator,
    counterPadding,
    resetRule,
    startNumber,
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({
          name: name.trim(),
          docType,
          prefix,
          yearFormat,
          separator,
          counterPadding,
          resetRule,
          startNumber,
          isDefault,
        });
      }}
      className="flex flex-col flex-1 min-h-0"
    >
      <div className="flex-1 overflow-auto p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Name *</label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Document type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocType)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            >
              {(Object.keys(DOC_LABEL) as DocType[]).map((d) => (
                <option key={d} value={d}>
                  {DOC_LABEL[d]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Prefix</label>
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} />
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Separator</label>
            <Input value={separator} onChange={(e) => setSeparator(e.target.value.slice(0, 1))} />
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Year format</label>
            <select
              value={yearFormat}
              onChange={(e) => setYearFormat(e.target.value as InvoiceScheme['yearFormat'])}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="none">No year</option>
              <option value="YY">YY (26)</option>
              <option value="YYYY">YYYY (2026)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Counter padding</label>
            <NumberField value={counterPadding} onChangeNumber={setCounterPadding} />
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Reset</label>
            <select
              value={resetRule}
              onChange={(e) => setResetRule(e.target.value as InvoiceScheme['resetRule'])}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="never">Never</option>
              <option value="yearly">Yearly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Start number</label>
            <NumberField value={startNumber} onChangeNumber={setStartNumber} />
          </div>
        </div>

        <div className="rounded-lg border border-border p-3 bg-secondary/40">
          <div className="text-[10px] uppercase font-semibold text-muted-foreground">Live preview</div>
          <div className="font-mono tabular text-base mt-1 break-all">
            {previewSchemeNumber(previewObj)}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          Set as default for {DOC_LABEL[docType]}
        </label>
      </div>
      <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          <Save className="size-4" /> {initial ? 'Save Changes' : 'Add Scheme'}
        </Button>
      </div>
    </form>
  );
}
