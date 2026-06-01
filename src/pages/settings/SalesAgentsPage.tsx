import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, Edit2, HandCoins } from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { NumberField } from '@/components/ui/NumberField';
import { useUsers, type CommissionAgent } from '@/stores/users';
import { confirm } from '@/stores/confirm';

export default function SalesAgentsPage() {
  const agents = useUsers((s) => s.agents);
  const add = useUsers((s) => s.addAgent);
  const update = useUsers((s) => s.updateAgent);
  const remove = useUsers((s) => s.removeAgent);
  const hydrate = useUsers((s) => s.hydrate);

  const [editing, setEditing] = useState<CommissionAgent | 'new' | null>(null);

  useEffect(() => void hydrate(), [hydrate]);

  return (
    <div>
      <SettingsHeader
        title="Sales Commission Agents"
        subtitle="Optional · track commissions on sales by field staff"
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add Agent
          </Button>
        }
      />

      <div className="p-6 max-w-3xl space-y-3">
        <Card className="p-4 bg-secondary/40 border-dashed">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-md bg-card grid place-items-center text-muted-foreground">
              <HandCoins className="size-4" />
            </div>
            <div className="flex-1 text-sm">
              <div className="font-semibold">When to use this</div>
              <p className="text-muted-foreground text-[12px] mt-0.5">
                Skip this section unless you pay commissions on sales. When agents exist, the Add
                Sale form gets an optional "Sales agent" field; reports include a Sales Rep
                breakdown and commission totals. You can come back to this any time.
              </p>
            </div>
          </div>
        </Card>

        {agents.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No commission agents yet.
          </Card>
        )}

        {agents.map((a) => (
          <Card key={a.id} className="p-4 flex items-center gap-3">
            <div className="size-10 rounded-md bg-secondary grid place-items-center text-muted-foreground">
              <HandCoins className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{a.name}</span>
                {a.active === false && <Badge variant="destructive">Inactive</Badge>}
                <Badge variant="info">{a.commissionPct}%</Badge>
              </div>
              {a.phone && <div className="text-xs text-muted-foreground font-mono">{a.phone}</div>}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditing(a)}
                className="size-8 grid place-items-center rounded hover:bg-secondary"
              >
                <Edit2 className="size-3.5" />
              </button>
              <button
                onClick={async () => {
                  if (await confirm({ title: `Delete agent "${a.name}"?`, variant: 'destructive' }))
                    remove(a.id);
                }}
                className="size-8 grid place-items-center rounded hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add Agent' : 'Edit Agent'}
        width="max-w-md"
      >
        {editing && (
          <AgentForm
            initial={editing === 'new' ? undefined : editing}
            onSave={(d) => {
              if (editing === 'new') add(d);
              else update(editing.id, d);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function AgentForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: CommissionAgent;
  onSave: (d: Omit<CommissionAgent, 'id'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [pct, setPct] = useState(initial?.commissionPct ?? 0);
  const [active, setActive] = useState(initial?.active ?? true);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({
          name: name.trim(),
          phone: phone.trim() || undefined,
          commissionPct: pct,
          active,
        });
      }}
      className="flex flex-col gap-3 p-4"
    >
      <div>
        <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
          Name <span className="text-destructive">*</span>
        </label>
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
          Phone
        </label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div>
        <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
          Commission %
        </label>
        <NumberField value={pct} onChangeNumber={setPct} />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active
      </label>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          <Save className="size-4" /> Save
        </Button>
      </div>
    </form>
  );
}
