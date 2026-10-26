import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Settings2,
  Download,
  Printer,
  Banknote,
  MoreHorizontal,
  PackageSearch,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Segmented } from '@/components/ui/Segmented';
import { IconButton } from '@/components/ui/IconButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Popover } from '@/components/ui/Popover';
import { SettlementBadge, SETTLEMENT_LABEL } from '@/components/ui/SettlementBadge';
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
import { formatDate } from '@/lib/formatDate';
import { endOfLocalDay, startOfBusinessWeek, startOfLocalDay } from '@/lib/datetime';
import { hasBackend } from '@/lib/api';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { PurchaseDetail } from '@/components/purchases/PurchaseDetail';
import { PayBillModal } from '@/components/purchases/PayBillModal';
import { PurchasePrintModal } from '@/components/purchases/PurchasePrintModal';
import { PURCHASE_STATUS_LABEL, PURCHASE_STATUS_VARIANT } from '@/components/purchases/labels';

type DateFilter = 'all' | 'today' | 'week' | 'month';
type StatusFilter = 'live' | PurchaseStatus;
type PaymentFilter = 'all' | 'paid' | 'partial' | 'due';

const PAYMENT_OPTIONS: { value: PaymentFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: SETTLEMENT_LABEL.paid },
  { value: 'partial', label: SETTLEMENT_LABEL.partial },
  { value: 'due', label: SETTLEMENT_LABEL.due },
];

/** Everything except cancelled (the status select's default). */
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
  const [payment, setPayment] = useState<PaymentFilter>('all');
  /** 'live' = everything except cancelled (the default). */
  const [status, setStatus] = useState<StatusFilter>('live');
  const [colsOpen, setColsOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [payBillOpen, setPayBillOpen] = useState(false);
  const [printFor, setPrintFor] = useState<PurchaseRecord | null>(null);
  // Cancelled purchases are hidden by default (their stock-in and cash-out were
  // reversed); the status select brings them back. Nothing is deleted.

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
  const onStatus = (next: StatusFilter) => {
    setStatus(next);
    void loadPage({ statuses: next === 'live' ? LIVE_STATUSES : [next], page: 1 });
  };

  const onPaymentChip = (next: PaymentFilter) => {
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

  const filtersOn =
    q !== '' || supplierId !== 'all' || date !== 'all' || payment !== 'all' || status !== 'live';
  const clearFilters = () => {
    setQ('');
    setSupplierId('all');
    setDate('all');
    setPayment('all');
    setStatus('live');
    void loadPage({
      page: 1,
      statuses: LIVE_STATUSES,
      supplierId: undefined,
      payment: undefined,
      from: undefined,
      to: undefined,
      q: undefined,
    });
  };

  // The six page-only KPI cards were removed (they repeated the page size and
  // wrapped "৳" onto its own line); one line under the table says the same.
  return (
    <div>
      <PageHeader
        title="Purchases"
        subtitle="Goods received from suppliers"
        actions={
          <>
            {/* Rare admin actions live in one "More" menu. */}
            <Popover
              align="right"
              width="w-60"
              trigger={(_o, set) => (
                <IconButton variant="outline" label="More" onClick={() => set(true)}>
                  <MoreHorizontal className="size-4" />
                </IconButton>
              )}
            >
              {(close) => (
                <div className="py-1">
                  <MenuItem
                    icon={Settings2}
                    label="Customize columns"
                    onClick={() => {
                      close();
                      setColsOpen(true);
                    }}
                  />
                  {/* Same `backup.export` channel as Settings: the whole table. */}
                  <MenuItem
                    icon={Download}
                    label="Export all"
                    disabled={exportBusy}
                    onClick={() => {
                      close();
                      void exportCsv('purchases');
                    }}
                  />
                </div>
              )}
            </Popover>
            <Button variant="outline" onClick={() => setPayBillOpen(true)}>
              <Banknote className="size-4" /> Pay Bill
            </Button>
            <Button onClick={() => nav('/purchases/new')}>
              <Plus className="size-4" /> Add Purchase
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        <Card className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Reference, supplier…"
              className="pl-9"
              aria-label="Search purchases"
            />
          </div>
          <Select
            value={supplierId}
            aria-label="Supplier"
            onChange={(e) => {
              setSupplierId(e.target.value);
              void loadPage({ supplierId: e.target.value });
            }}
            className="w-auto max-w-[13rem]"
          >
            <option value="all">All suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select
            value={date}
            aria-label="Date"
            onChange={(e) => {
              const preset = e.target.value as DateFilter;
              setDate(preset);
              void loadPage(presetToRange(preset));
            }}
            className="w-auto"
          >
            <option value="all">All dates</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </Select>
          {/* One select replaces the status chips + "Show cancelled" toggle. */}
          <Select
            value={status}
            aria-label="Status"
            onChange={(e) => onStatus(e.target.value as StatusFilter)}
            className="w-auto"
          >
            <option value="live">All (not cancelled)</option>
            <option value="received">Received</option>
            <option value="ordered">Ordered</option>
            <option value="in-transit">In transit</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <Segmented
            ariaLabel="Payment"
            value={payment}
            onChange={onPaymentChip}
            options={PAYMENT_OPTIONS}
          />
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            {backend && loading && purchases.length === 0 ? (
              <div className="p-4">
                <SkeletonTable count={8} />
              </div>
            ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-secondary/50">
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
                  <th className="w-14"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setOpenId(p.id)}
                    className={cn(
                      'border-t border-border hover:bg-secondary/40 cursor-pointer',
                      p.status === 'cancelled' && 'opacity-60',
                    )}
                  >
                    {columns.map((c) => (
                      <Cell key={c} c={c} p={p} showStatus={!columns.includes('status')} />
                    ))}
                    {/* The row opens the bill; Print is the one row action. */}
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <IconButton size="sm" label="Print goods received note" onClick={() => setPrintFor(p)}>
                        <Printer className="size-4" />
                      </IconButton>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 1}>
                      <EmptyState
                        compact
                        icon={PackageSearch}
                        title={filtersOn ? 'No purchases match these filters.' : 'No purchases yet.'}
                        action={
                          filtersOn ? (
                            <Button variant="outline" onClick={clearFilters}>
                              Clear filters
                            </Button>
                          ) : (
                            <Button onClick={() => nav('/purchases/new')}>
                              <Plus className="size-4" /> Add Purchase
                            </Button>
                          )
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            )}
          </div>
          {list.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span>This page:</span>
              <span>
                <span className="tabular text-foreground font-medium">{formatBDT(totals.value)}</span> <span>bought</span>
              </span>
              <span>
                <span className="tabular text-foreground font-medium">{formatBDT(totals.paid)}</span> <span>paid</span>
              </span>
              <span>
                <span className="tabular text-destructive font-medium">{formatBDT(totals.due)}</span> <span>unpaid</span>
              </span>
            </div>
          )}
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

function StatusBadge({ s }: { s: PurchaseStatus }) {
  return <Badge variant={PURCHASE_STATUS_VARIANT[s]}>{PURCHASE_STATUS_LABEL[s]}</Badge>;
}

function Cell({ c, p, showStatus }: { c: PurchaseColumn; p: PurchaseRecord; showStatus: boolean }) {
  const align = PURCHASE_COLUMN_META[c].align === 'right' ? 'text-right tabular whitespace-nowrap' : '';
  const td = 'px-3 py-3';
  switch (c) {
    case 'date':
      return <td className={cn(td, 'whitespace-nowrap')}>{formatDate(p.date)}</td>;
    case 'ref':
      return <td className={cn(td, 'font-mono whitespace-nowrap')}>{p.refNo}</td>;
    case 'supplier':
      return <td className={cn(td, 'font-medium')}>{p.supplierName}</td>;
    case 'branch':
      return <td className={cn(td, 'text-muted-foreground whitespace-nowrap')}>{p.branch}</td>;
    case 'items':
      return <td className={cn(td, align)}>{p.lines.length}</td>;
    case 'subtotal':
      return <td className={cn(td, 'text-muted-foreground', align)}>{formatBDT(p.subtotal, { withSymbol: false })}</td>;
    case 'discount':
      return (
        <td className={cn(td, 'text-muted-foreground', align)}>
          {formatBDT(p.orderDiscount + p.totalLineDiscount, { withSymbol: false })}
        </td>
      );
    case 'tax':
      return <td className={cn(td, 'text-muted-foreground', align)}>{formatBDT(p.tax, { withSymbol: false })}</td>;
    case 'shipping':
      return <td className={cn(td, 'text-muted-foreground', align)}>{formatBDT(p.shipping, { withSymbol: false })}</td>;
    case 'total':
      return <td className={cn(td, 'font-semibold', align)}>{formatBDT(p.total, { withSymbol: false })}</td>;
    case 'paid':
      return <td className={cn(td, 'text-success', align)}>{formatBDT(p.paid, { withSymbol: false })}</td>;
    case 'due':
      return (
        <td className={cn(td, align)}>
          {p.due > 0 ? (
            <span className="text-destructive">{formatBDT(p.due, { withSymbol: false })}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      );
    case 'paymentStatus':
      // Status rides along here when it isn't "received" (no own column by default).
      return (
        <td className={td}>
          <div className="flex flex-wrap items-center gap-1">
            {p.status !== 'cancelled' && (
              <SettlementBadge paid={p.paid} due={p.due} credited={p.credited} />
            )}
            {showStatus && p.status !== 'received' && <StatusBadge s={p.status} />}
          </div>
        </td>
      );
    case 'status':
      return (
        <td className={td}>
          <StatusBadge s={p.status} />
        </td>
      );
    case 'user':
      return <td className={cn(td, 'text-muted-foreground whitespace-nowrap')}>{p.user}</td>;
  }
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof Download;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2 px-3 h-10 text-sm hover:bg-secondary disabled:opacity-50"
    >
      <Icon className="size-4" /> {label}
    </button>
  );
}
