import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  Download,
  Upload,
  Plus,
  Settings2,
  Calendar,
  Eye,
  Printer,
  Undo2,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Popover } from '@/components/ui/Popover';
import { ColumnsPanel } from '@/components/ui/ColumnsPanel';
import { useSales, type SaleRecord } from '@/stores/sales';
import { ALL_SALES_COLUMNS, SALES_COLUMN_META, useSalesUI, type SalesColumn } from '@/stores/salesUI';
import { customers as mockCustomers } from '@/mocks/data';
import { useCustomers } from '@/stores/contacts';
import { hasBackend } from '@/lib/api';
import { formatBDT, cn } from '@/lib/utils';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { SaleDetail } from '@/components/sales/SaleDetail';
import { CreateReturnModal } from '@/components/sales/CreateReturnModal';
import { CreateShipmentModal } from '@/components/sales/CreateShipmentModal';

type DateFilter = 'today' | 'week' | 'month' | 'all' | 'custom';
type StatusFilter = 'all' | 'paid' | 'partial' | 'due' | 'voided';

export default function Sales() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const sales = useSales((s) => s.sales);
  const loading = useSales((s) => s.loading);
  const hydrate = useSales((s) => s.hydrate);
  const { columns, toggle, move, reset } = useSalesUI();

  // Customer filter options: under backend, source from the hydrated contacts
  // store so the dropdown lists REAL customers that match the sale rows'
  // customerIds (the mock demo customers never match). Falls back to mock data
  // in browser dev.
  const backend = hasBackend();
  const customerItems = useCustomers((s) => s.items);
  const hydrateCustomers = useCustomers((s) => s.hydrate);
  const customers = backend ? customerItems : mockCustomers;

  // Hydrate from the backend on mount so the store is populated when this page
  // is the entry point (mirrors Purchases.tsx). No-op outside Electron.
  useEffect(() => {
    void hydrate();
    void hydrateCustomers();
  }, [hydrate, hydrateCustomers]);

  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [date, setDate] = useState<DateFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [customerId, setCustomerId] = useState<string | 'all'>('all');
  const [cashier, setCashier] = useState<string | 'all'>('all');
  const [method, setMethod] = useState<string | 'all'>('all');
  const [colsOpen, setColsOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [returnFor, setReturnFor] = useState<string | null>(null);
  const [shipmentFor, setShipmentFor] = useState<string | null>(null);

  // Only final & void sales here. Drafts/quotations have their own page.
  const baseList = useMemo(() => sales.filter((s) => s.status === 'final' || s.status === 'void'), [sales]);

  const filtered = useMemo(() => {
    return baseList.filter((s) => {
      if (q) {
        const t = q.toLowerCase();
        if (!`${s.invoiceNo} ${s.customerName}`.toLowerCase().includes(t)) return false;
      }
      if (status !== 'all') {
        if (status === 'voided') {
          if (s.status !== 'void') return false;
        } else if (s.status === 'void') {
          return false;
        } else if (status === 'paid' && s.due !== 0) return false;
        else if (status === 'partial' && (s.paid === 0 || s.due === 0)) return false;
        else if (status === 'due' && s.paid !== 0) return false;
      }
      if (customerId !== 'all' && s.customerId !== customerId) return false;
      if (cashier !== 'all' && s.user !== cashier) return false;
      if (method !== 'all' && !s.payments.some((p) => p.method === method)) return false;
      return true;
    });
  }, [baseList, q, status, customerId, cashier, method]);

  const totals = useMemo(() => {
    const arr = filtered.filter((s) => s.status !== 'void');
    return {
      count: arr.length,
      revenue: arr.reduce((s, x) => s + x.total, 0),
      paid: arr.reduce((s, x) => s + x.paid, 0),
      due: arr.reduce((s, x) => s + x.due, 0),
      tax: arr.reduce((s, x) => s + x.tax, 0),
      discount: arr.reduce((s, x) => s + x.orderDiscount + x.totalLineDiscount, 0),
    };
  }, [filtered]);

  const cashiers = Array.from(new Set(sales.map((s) => s.user)));

  return (
    <div>
      <PageHeader
        title="All Sales"
        subtitle="Final and voided sales"
        actions={
          <>
            <IconBtn title="Customize columns" onClick={() => setColsOpen(true)}>
              <Settings2 className="size-4" />
            </IconBtn>
            <Button variant="outline" size="sm" onClick={() => nav('/sales/import')}>
              <Upload className="size-4" /> Import
            </Button>
            <Button variant="outline" size="sm">
              <Download className="size-4" /> Export
            </Button>
            <Button onClick={() => nav('/sales/new')}>
              <Plus className="size-4" /> New Sale
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Stat label="Sales" value={String(totals.count)} />
          <Stat label="Revenue" value={formatBDT(totals.revenue)} tone="primary" />
          <Stat label="Paid" value={formatBDT(totals.paid)} tone="success" />
          <Stat label="Due" value={formatBDT(totals.due)} tone="destructive" />
          <Stat label="Tax" value={formatBDT(totals.tax)} />
          <Stat label="Discount" value={formatBDT(totals.discount)} />
        </div>

        {/* Filters */}
        <Card className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Invoice, customer…"
              className="pl-9"
            />
          </div>
          <select
            value={date}
            onChange={(e) => setDate(e.target.value as DateFilter)}
            className="h-9 px-2 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="all">All dates</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="custom">Custom</option>
          </select>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="h-9 px-2 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="all">All customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={cashier}
            onChange={(e) => setCashier(e.target.value)}
            className="h-9 px-2 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="all">All users</option>
            {cashiers.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="h-9 px-2 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="all">All methods</option>
            {['Cash', 'bKash', 'Nagad', 'Card', 'Bank', 'Credit'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-xs">
            {(['all', 'paid', 'partial', 'due', 'voided'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  'px-3 py-1 rounded capitalize font-medium transition',
                  status === s
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </Card>

        {/* Table */}
        {backend && loading && sales.length === 0 ? (
          <SkeletonTable count={8} />
        ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50 sticky top-0">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c}
                      className={cn(
                        'font-medium px-3 py-2.5 whitespace-nowrap',
                        SALES_COLUMN_META[c].align === 'right' ? 'text-right' : 'text-left',
                      )}
                    >
                      {SALES_COLUMN_META[c].label}
                    </th>
                  ))}
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className={cn(
                      'border-t border-border hover:bg-secondary/40 cursor-pointer group',
                      s.status === 'void' && 'opacity-60',
                    )}
                    onClick={() => setOpenId(s.id)}
                  >
                    {columns.map((c) => (
                      <Cell key={c} c={c} s={s} />
                    ))}
                    <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100">
                        <button
                          onClick={() => setOpenId(s.id)}
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
                        <button
                          onClick={() => setReturnFor(s.id)}
                          className="size-7 grid place-items-center rounded hover:bg-warning/10 hover:text-warning"
                          title="Create return"
                        >
                          <Undo2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-muted-foreground">
                      No sales match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        )}
      </div>

      <SaleDetail
        open={!!openId}
        onClose={() => setOpenId(null)}
        saleId={openId}
        onCreateReturn={(id) => {
          setOpenId(null);
          setReturnFor(id);
        }}
        onCreateShipment={(id) => {
          setOpenId(null);
          setShipmentFor(id);
        }}
      />

      <CreateReturnModal open={!!returnFor} onClose={() => setReturnFor(null)} saleId={returnFor} />
      <CreateShipmentModal open={!!shipmentFor} onClose={() => setShipmentFor(null)} saleId={shipmentFor} />

      {colsOpen && (
        <ColumnsPanel
          all={ALL_SALES_COLUMNS}
          visible={columns}
          meta={SALES_COLUMN_META}
          onToggle={toggle}
          onMove={move}
          onReset={reset}
          onClose={() => setColsOpen(false)}
        />
      )}
    </div>
  );
}

function Cell({ c, s }: { c: SalesColumn; s: SaleRecord }) {
  const align = SALES_COLUMN_META[c].align === 'right' ? 'text-right font-mono tabular' : '';
  switch (c) {
    case 'date': {
      const d = new Date(s.date);
      return (
        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
          {d.toLocaleDateString('en-GB')}{' '}
          <span className="opacity-70">{d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
        </td>
      );
    }
    case 'invoice':
      return <td className="px-3 py-2.5 font-mono text-xs">{s.invoiceNo}</td>;
    case 'customer':
      return <td className="px-3 py-2.5 font-medium">{s.customerName}</td>;
    case 'items':
      return <td className={`px-3 py-2.5 ${align}`}>{s.lines.reduce((n, l) => n + l.qty, 0)}</td>;
    case 'subtotal':
      return <td className={`px-3 py-2.5 ${align} text-muted-foreground`}>{formatBDT(s.subtotal, { withSymbol: false })}</td>;
    case 'discount':
      return <td className={`px-3 py-2.5 ${align} text-muted-foreground`}>{formatBDT(s.orderDiscount + s.totalLineDiscount, { withSymbol: false })}</td>;
    case 'tax':
      return <td className={`px-3 py-2.5 ${align} text-muted-foreground`}>{formatBDT(s.tax, { withSymbol: false })}</td>;
    case 'total':
      return <td className={`px-3 py-2.5 ${align} font-semibold`}>{formatBDT(s.total, { withSymbol: false })}</td>;
    case 'paid':
      return <td className={`px-3 py-2.5 ${align} text-success`}>{formatBDT(s.paid, { withSymbol: false })}</td>;
    case 'due':
      return (
        <td className={`px-3 py-2.5 ${align}`}>
          {s.due > 0 ? <span className="text-destructive">{formatBDT(s.due, { withSymbol: false })}</span> : <span className="text-muted-foreground">—</span>}
        </td>
      );
    case 'paymentStatus':
      if (s.status === 'void') return <td className="px-3 py-2.5"><Badge variant="destructive">Voided</Badge></td>;
      if (s.due === 0) return <td className="px-3 py-2.5"><Badge variant="success">Paid</Badge></td>;
      if (s.paid > 0) return <td className="px-3 py-2.5"><Badge variant="warning">Partial</Badge></td>;
      return <td className="px-3 py-2.5"><Badge variant="destructive">Due</Badge></td>;
    case 'paymentMethod': {
      const methods = Array.from(new Set(s.payments.map((p) => p.method)));
      const text = methods.length === 0 ? '—' : methods.length === 1 ? methods[0] : 'Mixed';
      return <td className="px-3 py-2.5 text-xs">{text}</td>;
    }
    case 'cashier':
      return <td className="px-3 py-2.5 text-xs text-muted-foreground">{s.user}</td>;
    case 'branch':
      return <td className="px-3 py-2.5 text-xs text-muted-foreground">{s.branch}</td>;
    case 'profit':
      return <td className={`px-3 py-2.5 ${align} text-success`}>{s.profit ? formatBDT(s.profit, { withSymbol: false }) : '—'}</td>;
    case 'type':
      return <td className="px-3 py-2.5"><Badge variant="default">{s.status}</Badge></td>;
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

// silence unused
void Filter;
void Calendar;
void Popover;
