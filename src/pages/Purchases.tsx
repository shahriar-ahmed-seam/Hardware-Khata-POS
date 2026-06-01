import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Settings2,
  Upload,
  Download,
  Eye,
  Printer,
  Banknote,
  Undo2,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ColumnsPanel } from '@/components/ui/ColumnsPanel';
import { usePurchases, type PurchaseRecord } from '@/stores/purchases';
import { useSuppliers } from '@/stores/contacts';
import {
  ALL_PURCHASE_COLUMNS,
  PURCHASE_COLUMN_META,
  usePurchasesUI,
  type PurchaseColumn,
} from '@/stores/purchasesUI';
import { formatBDT, cn } from '@/lib/utils';
import { hasBackend } from '@/lib/api';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { PurchaseDetail } from '@/components/purchases/PurchaseDetail';
import { PayBillModal } from '@/components/purchases/PayBillModal';

export default function Purchases() {
  const nav = useNavigate();
  const purchases = usePurchases((s) => s.purchases);
  const loading = usePurchases((s) => s.loading);
  const hydrate = usePurchases((s) => s.hydrate);
  const suppliers = useSuppliers((s) => s.items);
  const { columns, toggle, move, reset } = usePurchasesUI();
  const backend = hasBackend();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const [q, setQ] = useState('');
  const [supplierId, setSupplierId] = useState<string | 'all'>('all');
  const [payment, setPayment] = useState<'all' | 'paid' | 'partial' | 'due'>('all');
  const [status, setStatus] = useState<'all' | 'received' | 'ordered' | 'in-transit' | 'cancelled'>('all');
  const [colsOpen, setColsOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [payBillOpen, setPayBillOpen] = useState(false);

  const list = useMemo(() => {
    return purchases.filter((p) => {
      if (q && !`${p.refNo} ${p.supplierName}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (supplierId !== 'all' && p.supplierId !== supplierId) return false;
      if (status !== 'all' && p.status !== status) return false;
      if (payment === 'paid' && p.due !== 0) return false;
      if (payment === 'partial' && (p.paid === 0 || p.due === 0)) return false;
      if (payment === 'due' && p.paid !== 0) return false;
      return true;
    });
  }, [purchases, q, supplierId, status, payment]);

  const totals = useMemo(() => {
    const arr = list.filter((p) => p.status !== 'cancelled');
    return {
      count: arr.length,
      value: arr.reduce((s, x) => s + x.total, 0),
      paid: arr.reduce((s, x) => s + x.paid, 0),
      due: arr.reduce((s, x) => s + x.due, 0),
      tax: arr.reduce((s, x) => s + x.tax, 0),
      discount: arr.reduce((s, x) => s + x.orderDiscount + x.totalLineDiscount, 0),
    };
  }, [list]);

  return (
    <div>
      <PageHeader
        title="Purchases"
        subtitle="Goods received from suppliers"
        actions={
          <>
            <IconBtn title="Customize columns" onClick={() => setColsOpen(true)}>
              <Settings2 className="size-4" />
            </IconBtn>
            <Button variant="outline" size="sm" onClick={() => nav('/purchases/import')}>
              <Upload className="size-4" /> Import
            </Button>
            <Button variant="outline" size="sm">
              <Download className="size-4" /> Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => nav('/purchases/returns')}>
              <Undo2 className="size-4" /> Returns
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setPayBillOpen(true)}>
              <Banknote className="size-4" /> Pay Bill
            </Button>
            <Button onClick={() => nav('/purchases/new')}>
              <Plus className="size-4" /> Add Purchase
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Stat label="Purchases" value={String(totals.count)} />
          <Stat label="Total Value" value={formatBDT(totals.value)} tone="primary" />
          <Stat label="Paid" value={formatBDT(totals.paid)} tone="success" />
          <Stat label="Payable" value={formatBDT(totals.due)} tone="destructive" />
          <Stat label="Tax" value={formatBDT(totals.tax)} />
          <Stat label="Discount" value={formatBDT(totals.discount)} />
        </div>

        <Card className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Reference, supplier…"
              className="pl-9"
            />
          </div>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="h-9 px-2 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="all">All suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-xs">
            {(['all', 'paid', 'partial', 'due'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPayment(p)}
                className={cn(
                  'px-3 py-1 rounded font-medium capitalize transition',
                  payment === p
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-xs">
            {(['all', 'received', 'ordered', 'in-transit', 'cancelled'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  'px-3 py-1 rounded font-medium capitalize transition',
                  status === s
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {s.replace('-', ' ')}
              </button>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            {backend && loading && purchases.length === 0 ? (
              <div className="p-4">
                <SkeletonTable count={8} />
              </div>
            ) : (
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50 sticky top-0">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c}
                      className={cn(
                        'font-medium px-3 py-2.5 whitespace-nowrap',
                        PURCHASE_COLUMN_META[c].align === 'right' ? 'text-right' : 'text-left',
                      )}
                    >
                      {PURCHASE_COLUMN_META[c].label}
                    </th>
                  ))}
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setOpenId(p.id)}
                    className={cn(
                      'border-t border-border hover:bg-secondary/40 cursor-pointer group',
                      p.status === 'cancelled' && 'opacity-60',
                    )}
                  >
                    {columns.map((c) => (
                      <Cell key={c} c={c} p={p} />
                    ))}
                    <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100">
                        <button
                          onClick={() => setOpenId(p.id)}
                          className="size-7 grid place-items-center rounded hover:bg-secondary"
                          title="View"
                        >
                          <Eye className="size-3.5" />
                        </button>
                        <button
                          className="size-7 grid place-items-center rounded hover:bg-secondary"
                          title="Print"
                        >
                          <Printer className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length + 1}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      No purchases match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            )}
          </div>
        </Card>
      </div>

      <PurchaseDetail open={!!openId} onClose={() => setOpenId(null)} purchaseId={openId} />
      <PayBillModal open={payBillOpen} onClose={() => setPayBillOpen(false)} />

      {colsOpen && (
        <ColumnsPanel
          all={ALL_PURCHASE_COLUMNS}
          visible={columns}
          meta={PURCHASE_COLUMN_META}
          onToggle={toggle}
          onMove={move}
          onReset={reset}
          onClose={() => setColsOpen(false)}
        />
      )}
    </div>
  );
}

function Cell({ c, p }: { c: PurchaseColumn; p: PurchaseRecord }) {
  const align = PURCHASE_COLUMN_META[c].align === 'right' ? 'text-right font-mono tabular' : '';
  switch (c) {
    case 'date':
      return (
        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
          {new Date(p.date).toLocaleDateString('en-GB')}
        </td>
      );
    case 'ref':
      return <td className="px-3 py-2.5 font-mono text-xs">{p.refNo}</td>;
    case 'supplier':
      return <td className="px-3 py-2.5 font-medium">{p.supplierName}</td>;
    case 'branch':
      return <td className="px-3 py-2.5 text-xs text-muted-foreground">{p.branch}</td>;
    case 'items':
      return <td className={cn('px-3 py-2.5', align)}>{p.lines.reduce((n, l) => n + l.qty, 0)}</td>;
    case 'subtotal':
      return <td className={cn('px-3 py-2.5 text-muted-foreground', align)}>{formatBDT(p.subtotal, { withSymbol: false })}</td>;
    case 'discount':
      return (
        <td className={cn('px-3 py-2.5 text-muted-foreground', align)}>
          {formatBDT(p.orderDiscount + p.totalLineDiscount, { withSymbol: false })}
        </td>
      );
    case 'tax':
      return <td className={cn('px-3 py-2.5 text-muted-foreground', align)}>{formatBDT(p.tax, { withSymbol: false })}</td>;
    case 'shipping':
      return <td className={cn('px-3 py-2.5 text-muted-foreground', align)}>{formatBDT(p.shipping, { withSymbol: false })}</td>;
    case 'total':
      return <td className={cn('px-3 py-2.5 font-semibold', align)}>{formatBDT(p.total, { withSymbol: false })}</td>;
    case 'paid':
      return <td className={cn('px-3 py-2.5 text-success', align)}>{formatBDT(p.paid, { withSymbol: false })}</td>;
    case 'due':
      return (
        <td className={cn('px-3 py-2.5', align)}>
          {p.due > 0 ? (
            <span className="text-destructive">{formatBDT(p.due, { withSymbol: false })}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      );
    case 'paymentStatus':
      if (p.due === 0) return <td className="px-3 py-2.5"><Badge variant="success">Paid</Badge></td>;
      if (p.paid > 0) return <td className="px-3 py-2.5"><Badge variant="warning">Partial</Badge></td>;
      return <td className="px-3 py-2.5"><Badge variant="destructive">Due</Badge></td>;
    case 'status':
      return (
        <td className="px-3 py-2.5">
          <Badge
            variant={
              p.status === 'received'
                ? 'success'
                : p.status === 'cancelled'
                  ? 'destructive'
                  : 'info'
            }
          >
            {p.status.replace('-', ' ')}
          </Badge>
        </td>
      );
    case 'user':
      return <td className="px-3 py-2.5 text-xs text-muted-foreground">{p.user}</td>;
  }
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'primary' | 'success' | 'destructive';
}) {
  return (
    <Card className="p-4">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          'text-lg font-bold mt-0.5 tabular',
          tone === 'primary' && 'text-primary',
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
