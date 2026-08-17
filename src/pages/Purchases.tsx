import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Settings2,
  Upload,
  Download,
  Eye,
  EyeOff,
  Printer,
  Banknote,
  Undo2,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  SettlementBadge,
  SETTLEMENT_LABEL,
  type SettlementKey,
} from '@/components/ui/SettlementBadge';
import { Card } from '@/components/ui/Card';
import { ColumnsPanel } from '@/components/ui/ColumnsPanel';
import { Pagination } from '@/components/ui/Pagination';
import { usePurchases, type PurchaseRecord, type PurchaseStatus } from '@/stores/purchases';
import { useSuppliers } from '@/stores/contacts';
import { useBackup } from '@/stores/backup';
import {
  ALL_PURCHASE_COLUMNS,
  PURCHASE_COLUMN_META,
  usePurchasesUI,
  type PurchaseColumn,
} from '@/stores/purchasesUI';
import { formatBDT, cn } from '@/lib/utils';
import { endOfLocalDay, startOfBusinessWeek, startOfLocalDay } from '@/lib/datetime';
import { hasBackend } from '@/lib/api';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { PurchaseDetail } from '@/components/purchases/PurchaseDetail';
import { PayBillModal } from '@/components/purchases/PayBillModal';
import { PurchasePrintModal } from '@/components/purchases/PurchasePrintModal';

type DateFilter = 'all' | 'today' | 'week' | 'month';

/** Everything except cancelled — see `showCancelled` below. */
const LIVE_STATUSES: PurchaseStatus[] = ['received', 'ordered', 'in-transit'];

/**
 * Turn a date preset into inclusive ISO bounds for the server query. Day
 * boundaries are local (same convention as the Reports toolbar); purchase dates
 * are stored as ISO UTC so the SQL string comparison still orders correctly.
 * 'all' clears both bounds.
 */
function presetToRange(preset: DateFilter): { from?: string; to?: string } {
  if (preset === 'all') return { from: undefined, to: undefined };
  const now = new Date();
  // Saturday week start — see the same note in pages/Sales.tsx and
  // `startOfBusinessWeek` in lib/datetime.ts. This was a Monday start, so it
  // disagreed with every report on what "this week" covers.
  const start = preset === 'week' ? startOfBusinessWeek(now) : startOfLocalDay(now);
  if (preset === 'month') start.setDate(1);
  return { from: start.toISOString(), to: endOfLocalDay(now).toISOString() };
}

export default function Purchases() {
  const nav = useNavigate();
  const purchases = usePurchases((s) => s.purchases);
  const loading = usePurchases((s) => s.loading);
  const total = usePurchases((s) => s.total);
  const query = usePurchases((s) => s.query);
  const loadPage = usePurchases((s) => s.loadPage);
  // The supplier FILTER reads the contacts store's UNPAGED `options` (id+name):
  // `items` is one page of suppliers, so a filter built from it would silently
  // omit every supplier past the first page.
  const suppliers = useSuppliers((s) => s.options);
  const loadSupplierOptions = useSuppliers((s) => s.loadOptions);
  const { columns, toggle, move, reset } = usePurchasesUI();
  const backend = hasBackend();
  const exportCsv = useBackup((s) => s.exportCsv);
  const exportBusy = useBackup((s) => s.busy);

  // Load ONE page on mount; every filter below is pushed into the SQL query.
  // Filters are stated explicitly so a query left over from a previous visit
  // can't narrow the list while the controls below all read "all".
  useEffect(() => {
    void loadPage({
      page: 1,
      // Cancelled purchases are excluded up front, in SQL, so they do not eat
      // rows out of the page the employee is looking at.
      statuses: LIVE_STATUSES,
      supplierId: undefined,
      payment: undefined,
      from: undefined,
      to: undefined,
      q: undefined,
    });
    void loadSupplierOptions();
  }, [loadPage, loadSupplierOptions]);

  const [q, setQ] = useState('');
  const [supplierId, setSupplierId] = useState<string | 'all'>('all');
  const [date, setDate] = useState<DateFilter>('all');
  const [payment, setPayment] = useState<'all' | 'paid' | 'partial' | 'due'>('all');
  const [status, setStatus] = useState<'all' | PurchaseStatus>('all');
  const [colsOpen, setColsOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [payBillOpen, setPayBillOpen] = useState(false);
  const [printFor, setPrintFor] = useState<PurchaseRecord | null>(null);
  /**
   * CANCELLED PURCHASES ARE HIDDEN BY DEFAULT.
   *
   * A cancelled purchase has had its stock-in and its cash-out reversed, so it
   * buys nothing but confusion in a list an employee reads all day. Nothing is
   * deleted (the reversal history is exactly what makes a cancel auditable) and
   * one small button brings them back. Same rule as voided sales.
   */
  const [showCancelled, setShowCancelled] = useState(false);

  // Search hits the database (reference + supplier name) — debounced ~300ms so
  // typing doesn't fire a query per keystroke. First run skipped: the mount
  // effect already loaded page 1.
  const searchMounted = useRef(false);
  useEffect(() => {
    if (!searchMounted.current) {
      searchMounted.current = true;
      return;
    }
    const handle = setTimeout(() => {
      void loadPage({ q: q.trim() || undefined });
    }, 300);
    return () => clearTimeout(handle);
  }, [q, loadPage]);

  /**
   * Paid / Partial / Due are pushed into SQL now.
   *
   * They used to be filtered here in JavaScript over the rows of the loaded page,
   * which meant clicking "Due" filtered the newest 50 bills and reported "No
   * purchases match" while unpaid ones sat further back — and the pager and page
   * totals then disagreed with the rows on screen. `paid` and `due` ARE columns on
   * `purchases`; see `PageQuery.payment` in backend/services/paged.ts.
   */
  /**
   * The lifecycle statuses to ask SQL for, given the chip AND the cancelled
   * toggle. Kept in one place so the two controls can never disagree (a chip
   * saying "cancelled" while the toggle claims they are hidden).
   */
  const statusesFor = (chip: 'all' | PurchaseStatus, withCancelled: boolean) => {
    if (chip !== 'all') return [chip];
    return withCancelled ? undefined : LIVE_STATUSES;
  };

  const onStatusChip = (next: 'all' | PurchaseStatus) => {
    setStatus(next);
    // Picking "cancelled" obviously means showing them.
    if (next === 'cancelled') setShowCancelled(true);
    void loadPage({ statuses: statusesFor(next, next === 'cancelled' || showCancelled), page: 1 });
  };

  const toggleCancelled = () => {
    const next = !showCancelled;
    setShowCancelled(next);
    // Hiding them while the "cancelled" chip is active would be contradictory,
    // so the chip falls back to "all".
    const chip = !next && status === 'cancelled' ? 'all' : status;
    if (chip !== status) setStatus(chip);
    void loadPage({ statuses: statusesFor(chip, next), page: 1 });
  };

  const onPaymentChip = (next: 'all' | 'paid' | 'partial' | 'due') => {
    setPayment(next);
    void loadPage({ payment: next === 'all' ? undefined : next, page: 1 });
  };

  // EVERY filter is applied in SQL now — lifecycle status, payment state,
  // supplier, date and free text — so the rows, the pager and the totals below
  // all describe the same result set.
  const list = purchases;

  // These sums cover the LOADED PAGE only — the rest of the range was never
  // fetched. Labelled "this page" in the UI so they can't read as range totals.
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
            {/* Was a button with no handler. Same `backup.export` channel as
                Settings, so there is one exporter in the app. "All" is literal:
                the whole purchases table, not the filtered page. */}
            <Button
              variant="outline"
              size="sm"
              disabled={exportBusy}
              onClick={() => void exportCsv('purchases')}
              title="Write every purchase to a CSV file in your backup folder"
            >
              <Download className="size-4" /> Export all
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
        {/* KPI strip — PAGE-SCOPED. Only the current page is in memory, so these
            are explicitly labelled instead of masquerading as range totals. */}
        <div>
          <div className="text-[11px] text-muted-foreground mb-1.5">
            Totals for this page only. Use Reports for full-range figures.
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Stat label="Purchases (this page)" value={String(totals.count)} />
            <Stat label="Total Value (this page)" value={formatBDT(totals.value)} tone="primary" />
            <Stat label="Paid (this page)" value={formatBDT(totals.paid)} tone="success" />
            <Stat label="Payable (this page)" value={formatBDT(totals.due)} tone="destructive" />
            <Stat label="Tax (this page)" value={formatBDT(totals.tax)} />
            <Stat label="Discount (this page)" value={formatBDT(totals.discount)} />
          </div>
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
            onChange={(e) => {
              setSupplierId(e.target.value);
              void loadPage({ supplierId: e.target.value });
            }}
            className="h-9 px-2 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="all">All suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={date}
            onChange={(e) => {
              const preset = e.target.value as DateFilter;
              setDate(preset);
              void loadPage(presetToRange(preset));
            }}
            className="h-9 px-2 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="all">All dates</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </select>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-xs">
              {/* Plain words, shared with the badges — see SettlementBadge. */}
              {(['all', 'paid', 'partial', 'due'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => onPaymentChip(p)}
                  className={cn(
                    'px-3 py-1 rounded font-medium transition',
                    payment === p
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {p === 'all' ? 'All' : SETTLEMENT_LABEL[p as SettlementKey]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-xs">
            {(
              [
                'all',
                'received',
                'ordered',
                'in-transit',
                ...(showCancelled ? (['cancelled'] as const) : []),
              ] as const
            ).map((s) => (
              <button
                key={s}
                onClick={() => onStatusChip(s)}
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

          {/* Cancelled purchases: out of the way, one click back. */}
          <button
            onClick={toggleCancelled}
            title={
              showCancelled
                ? 'Hide cancelled purchases'
                : 'Show cancelled purchases as well'
            }
            className={cn(
              'h-9 px-3 inline-flex items-center gap-1.5 rounded-md border text-xs font-medium transition',
              showCancelled
                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            {showCancelled ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {showCancelled ? 'Cancelled shown' : 'Show cancelled'}
          </button>
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
                        {/* Was a button with no handler. Prints the goods
                            received note for this purchase. */}
                        <button
                          onClick={() => setPrintFor(p)}
                          className="size-7 grid place-items-center rounded hover:bg-secondary"
                          title="Print goods received note"
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
          <Pagination
            page={query.page}
            pageSize={query.pageSize}
            total={total}
            onPageChange={(page) => void loadPage({ page })}
            onPageSizeChange={(pageSize) => void loadPage({ pageSize })}
            label="purchases"
            busy={loading}
          />
        </Card>
      </div>

      <PurchaseDetail open={!!openId} onClose={() => setOpenId(null)} purchaseId={openId} />
      <PayBillModal open={payBillOpen} onClose={() => setPayBillOpen(false)} />
      <PurchasePrintModal
        open={!!printFor}
        onClose={() => setPrintFor(null)}
        purchase={printFor}
      />

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
      return <td className="px-3 py-2.5"><SettlementBadge paid={p.paid} due={p.due} /></td>;
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
