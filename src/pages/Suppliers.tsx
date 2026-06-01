import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  Settings2,
  Upload,
  Download,
  LayoutGrid,
  List,
  Edit2,
  Trash2,
  HandCoins,
  Eye,
  Phone,
  Mail,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { ColumnsPanel } from '@/components/ui/ColumnsPanel';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { useSuppliers } from '@/stores/contacts';
import {
  ALL_SUPPLIER_COLUMNS,
  SUPPLIER_COLUMN_META,
  useContactsUI,
  type SupplierColumn,
} from '@/stores/contactsUI';
import type { Supplier } from '@/mocks/data';
import { Avatar } from '@/components/contacts/Avatar';
import { SupplierForm } from '@/components/contacts/SupplierForm';
import { PaySupplierModal } from '@/components/contacts/PaySupplierModal';
import { formatBDT, cn } from '@/lib/utils';
import { hasBackend } from '@/lib/api';

export default function Suppliers() {
  const nav = useNavigate();
  const { items, add, update, remove } = useSuppliers();
  const loading = useSuppliers((s) => s.loading);
  const hydrate = useSuppliers((s) => s.hydrate);
  const backend = hasBackend();
  // Mirror Purchases.tsx: hydrate from the backend on mount so the store is
  // populated when this page is the entry point.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  const {
    supplierView,
    setSupplierView,
    supplierCols,
    toggleSupplierCol,
    moveSupplierCol,
    resetSupplierCols,
  } = useContactsUI();

  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [colsOpen, setColsOpen] = useState(false);
  const [drawerId, setDrawerId] = useState<string | 'new' | null>(null);
  const [payFor, setPayFor] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!q) return items;
    const t = q.toLowerCase();
    return items.filter((s) =>
      `${s.name} ${s.phone} ${s.company ?? ''} ${s.contactPerson ?? ''}`.toLowerCase().includes(t),
    );
  }, [items, q]);

  const totals = {
    suppliers: items.length,
    purchase: items.reduce((s, x) => s + x.totalPurchase, 0),
    paid: items.reduce((s, x) => s + (x.totalPaid ?? 0), 0),
    payable: items.reduce((s, x) => s + x.due, 0),
  };

  const editing = drawerId === 'new' ? undefined : drawerId ? items.find((x) => x.id === drawerId) : undefined;

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle={`${totals.suppliers} suppliers · ${formatBDT(totals.payable)} payable`}
        actions={
          <>
            <IconBtn title="Customize columns" onClick={() => setColsOpen(true)}>
              <Settings2 className="size-4" />
            </IconBtn>
            <ViewToggle value={supplierView} onChange={setSupplierView} />
            <Button variant="outline" size="sm" onClick={() => nav('/contacts/suppliers/import')}>
              <Upload className="size-4" /> Import
            </Button>
            <Button variant="outline" size="sm">
              <Download className="size-4" /> Export
            </Button>
            <Button onClick={() => setDrawerId('new')}>
              <Plus className="size-4" /> Add Supplier
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Suppliers" value={String(totals.suppliers)} />
          <Stat label="Total Purchase" value={formatBDT(totals.purchase)} />
          <Stat label="Total Paid" value={formatBDT(totals.paid)} tone="success" />
          <Stat label="Payable" value={formatBDT(totals.payable)} tone="destructive" />
        </div>

        <Card className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, company, phone…"
              className="pl-9"
            />
          </div>
        </Card>

        {backend && loading && items.length === 0 ? (
          <SkeletonTable count={8} />
        ) : supplierView === 'table' ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50 sticky top-0">
                  <tr>
                    {supplierCols.map((c) => (
                      <th
                        key={c}
                        className={cn(
                          'font-medium px-3 py-2.5 whitespace-nowrap',
                          SUPPLIER_COLUMN_META[c].align === 'right' ? 'text-right' : 'text-left',
                        )}
                      >
                        {SUPPLIER_COLUMN_META[c].label}
                      </th>
                    ))}
                    <th className="w-32"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-t border-border hover:bg-secondary/40 group">
                      {supplierCols.map((col) => (
                        <SupplierCell key={col} col={col} s={s} />
                      ))}
                      <td className="px-2 py-2.5">
                        <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100">
                          <Link
                            to={`/contacts/suppliers/${s.id}`}
                            className="size-7 grid place-items-center rounded hover:bg-secondary"
                            title="Open"
                          >
                            <Eye className="size-3.5" />
                          </Link>
                          <button
                            onClick={() => setDrawerId(s.id)}
                            className="size-7 grid place-items-center rounded hover:bg-secondary"
                            title="Quick edit"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          {s.due > 0 && (
                            <button
                              onClick={() => setPayFor(s.id)}
                              className="size-7 grid place-items-center rounded hover:bg-success/10 text-success"
                              title="Pay supplier"
                            >
                              <HandCoins className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={supplierCols.length + 1}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        No suppliers match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((s) => (
              <Card
                key={s.id}
                className="p-4 hover:shadow-md transition cursor-pointer"
                onClick={() => nav(`/contacts/suppliers/${s.id}`)}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={s.name} size={48} variant="muted" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold truncate">{s.name}</div>
                      {s.paymentTerms && <Badge variant="info">{s.paymentTerms}</Badge>}
                    </div>
                    {s.company && (
                      <div className="text-xs text-muted-foreground">{s.company}</div>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="size-3" /> {s.phone}
                      </span>
                      {s.email && (
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="size-3" /> {s.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-border">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Total Purchase</div>
                    <div className="text-sm font-semibold font-mono tabular">
                      {formatBDT(s.totalPurchase)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Payable</div>
                    <div
                      className={cn(
                        'text-sm font-semibold font-mono tabular',
                        s.due > 0 ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {formatBDT(s.due)}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                  <Button variant="outline" size="sm" onClick={() => setDrawerId(s.id)}>
                    <Edit2 className="size-3.5" /> Edit
                  </Button>
                  <Button size="sm" disabled={s.due === 0} onClick={() => setPayFor(s.id)}>
                    <HandCoins className="size-3.5" /> Pay
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {colsOpen && (
        <ColumnsPanel
          all={ALL_SUPPLIER_COLUMNS}
          visible={supplierCols}
          meta={SUPPLIER_COLUMN_META}
          onToggle={toggleSupplierCol}
          onMove={moveSupplierCol}
          onReset={resetSupplierCols}
          onClose={() => setColsOpen(false)}
        />
      )}

      <Drawer
        open={drawerId !== null}
        onClose={() => setDrawerId(null)}
        width="max-w-3xl"
        title={drawerId === 'new' ? 'Add Supplier' : 'Edit Supplier'}
        subtitle={drawerId === 'new' ? 'New trade contact' : editing?.name}
      >
        <SupplierForm
          asDrawer
          initial={editing}
          onSave={(s) => {
            if (drawerId === 'new') add(s);
            else update(s.id, s);
            setDrawerId(null);
          }}
          onCancel={() => setDrawerId(null)}
          onDelete={
            editing
              ? () => {
                  if (confirm(`Delete "${editing.name}"?`)) {
                    remove(editing.id);
                    setDrawerId(null);
                  }
                }
              : undefined
          }
        />
      </Drawer>

      <PaySupplierModal open={!!payFor} onClose={() => setPayFor(null)} supplierId={payFor} />
    </div>
  );
}

function SupplierCell({ col, s }: { col: SupplierColumn; s: Supplier }) {
  const align = SUPPLIER_COLUMN_META[col].align === 'right' ? 'text-right font-mono tabular' : '';
  switch (col) {
    case 'avatar':
      return (
        <td className="px-3 py-2.5">
          <Avatar name={s.name} size={32} variant="muted" />
        </td>
      );
    case 'name':
      return <td className="px-3 py-2.5 font-semibold">{s.name}</td>;
    case 'company':
      return <td className="px-3 py-2.5 text-muted-foreground text-sm">{s.company ?? '—'}</td>;
    case 'contactPerson':
      return <td className="px-3 py-2.5 text-muted-foreground text-sm">{s.contactPerson ?? '—'}</td>;
    case 'phone':
      return <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">{s.phone}</td>;
    case 'email':
      return <td className="px-3 py-2.5 text-muted-foreground text-xs truncate max-w-[180px]">{s.email ?? '—'}</td>;
    case 'paymentTerms':
      return (
        <td className="px-3 py-2.5">
          {s.paymentTerms ? <Badge variant="info">{s.paymentTerms}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
        </td>
      );
    case 'leadTime':
      return (
        <td className={cn('px-3 py-2.5 text-muted-foreground', align)}>
          {s.leadTimeDays ? `${s.leadTimeDays}d` : '—'}
        </td>
      );
    case 'totalPurchase':
      return <td className={cn('px-3 py-2.5', align)}>{formatBDT(s.totalPurchase, { withSymbol: false })}</td>;
    case 'totalPaid':
      return (
        <td className={cn('px-3 py-2.5 text-success', align)}>
          {formatBDT(s.totalPaid ?? 0, { withSymbol: false })}
        </td>
      );
    case 'due':
      return (
        <td className={cn('px-3 py-2.5', align)}>
          {s.due > 0 ? (
            <span className="text-destructive">{formatBDT(s.due, { withSymbol: false })}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      );
    case 'lastPurchase':
      return <td className="px-3 py-2.5 text-xs text-muted-foreground">{s.lastPurchaseAt ?? '—'}</td>;
    case 'tags':
      return (
        <td className="px-3 py-2.5">
          <div className="flex flex-wrap gap-1">
            {(s.tags ?? []).map((t) => (
              <span
                key={t}
                className="text-[10px] px-1.5 py-0 rounded bg-primary/10 text-primary font-medium"
              >
                {t}
              </span>
            ))}
          </div>
        </td>
      );
  }
}

function ViewToggle({
  value,
  onChange,
}: {
  value: 'table' | 'grid';
  onChange: (v: 'table' | 'grid') => void;
}) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-xs">
      <button
        onClick={() => onChange('table')}
        title="Table"
        className={cn(
          'h-7 px-2 rounded inline-flex items-center gap-1 transition',
          value === 'table' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <List className="size-3.5" />
      </button>
      <button
        onClick={() => onChange('grid')}
        title="Grid"
        className={cn(
          'h-7 px-2 rounded inline-flex items-center gap-1 transition',
          value === 'grid' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <LayoutGrid className="size-3.5" />
      </button>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'destructive';
}) {
  return (
    <Card className="p-4">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          'text-xl font-bold mt-0.5 tabular',
          tone === 'success' && 'text-success',
          tone === 'destructive' && 'text-destructive',
        )}
      >
        {value}
      </div>
    </Card>
  );
}

function IconBtn({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="h-9 w-9 grid place-items-center rounded-md border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition"
    >
      {children}
    </button>
  );
}

void Trash2;
