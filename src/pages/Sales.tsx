import { useEffect, useMemo, useRef, useState } from 'react';
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
  EyeOff,
  Printer,
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
import { Popover } from '@/components/ui/Popover';
import { ColumnsPanel } from '@/components/ui/ColumnsPanel';
import { Pagination } from '@/components/ui/Pagination';
import { useSales, type SaleRecord, type SaleStatus } from '@/stores/sales';
import { ALL_SALES_COLUMNS, SALES_COLUMN_META, useSalesUI, type SalesColumn } from '@/stores/salesUI';
import { useCustomers } from '@/stores/contacts';
import { useUsers } from '@/stores/users';
import { useBackup } from '@/stores/backup';
import { formatBDT, cn } from '@/lib/utils';
import { endOfLocalDay, startOfBusinessWeek, startOfLocalDay } from '@/lib/datetime';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { SaleDetail } from '@/components/sales/SaleDetail';
import { CreateReturnModal } from '@/components/sales/CreateReturnModal';
import { CreateShipmentModal } from '@/components/sales/CreateShipmentModal';
import { InvoicePrintModal } from '@/components/sales/InvoicePrintModal';

type DateFilter = 'today' | 'week' | 'month' | 'all' | 'custom';
type StatusFilter = 'all' | 'paid' | 'partial' | 'due' | 'voided';

/**
 * VOIDED SALES ARE HIDDEN BY DEFAULT.
 *
 * A void is a cancelled sale: its stock went back on the shelf and its cash came
 * back out, so it contributes nothing but noise to the list an employee reads all
 * day — and a greyed-out row with a real invoice number and a real total is easy
 * to mistake for a live sale. They are never deleted (the audit trail is the
 * whole point of voiding rather than deleting), just filtered out, and one small
 * button brings them back.
 */
const ACTIVE_STATUSES: SaleStatus[] = ['final'];
const WITH_VOID_STATUSES: SaleStatus[] = ['final', 'void'];

/**
 * Turn a date preset into inclusive ISO bounds for the server query.
 * Day boundaries are local (same convention as the Reports toolbar) and sale
 * dates are stored as ISO UTC, so the SQL string comparison still orders
 * correctly. 'all' clears both bounds; 'custom' clears them too until the user
 * picks explicit dates.
 */
function presetToRange(preset: DateFilter): { from?: string; to?: string } {
  if (preset === 'all' || preset === 'custom') return { from: undefined, to: undefined };
  const now = new Date();
  // A WEEK STARTS ON SATURDAY, because that is what the backend's resolveRange()
  // means by "this week" and it is the Bangladeshi working week. This used to
  // compute a Monday start here, so on a Saturday the Reports page showed the
  // week's takings while this list showed nothing — two answers to one question.
  const start = preset === 'week' ? startOfBusinessWeek(now) : startOfLocalDay(now);
  if (preset === 'month') start.setDate(1);
  return { from: start.toISOString(), to: endOfLocalDay(now).toISOString() };
}

export default function Sales() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const sales = useSales((s) => s.sales);
  const loading = useSales((s) => s.loading);
  const total = useSales((s) => s.total);
  const query = useSales((s) => s.query);
  const loadPage = useSales((s) => s.loadPage);
  const { columns, toggle, move, reset } = useSalesUI();

  // Customer filter options come from the contacts store's UNPAGED `options`
  // list (id+name) so the dropdown lists every REAL customer, not just the 50
  // rows of the customers page. Reading `items` here would silently cap this
  // filter at one page. (Before loadOptions resolves it just shows
  // "All customers".)
  const customers = useCustomers((s) => s.options);
  const loadCustomerOptions = useCustomers((s) => s.loadOptions);

  // Cashier options come from the users store: the query filters on `userId`,
  // so the option VALUES have to be real backend user ids. The sale rows only
  // carry the display name, which is why this no longer reads off `sales`.
  const users = useUsers((s) => s.users);
  const hydrateUsers = useUsers((s) => s.hydrate);

  // CSV export reuses the backup store's channel, so there is one exporter in the
  // app rather than a second one that could disagree with it.
  const exportCsv = useBackup((s) => s.exportCsv);
  const exportBusy = useBackup((s) => s.busy);

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
  const [printFor, setPrintFor] = useState<SaleRecord | null>(null);
  /** Off by default — see ACTIVE_STATUSES above. */
  const [showVoided, setShowVoided] = useState(false);

  // Load ONE page on mount. This screen owns `statuses: ['final','void']` —
  // drafts and quotations have their own pages with their own query. An initial
  // ?q= is folded into the same call so mounting costs a single round-trip.
  const initialQ = useRef(q);
  useEffect(() => {
    // Every filter this screen owns is stated explicitly, so a query left behind
    // by Drafts/Quotations (they share this store) can't silently narrow the list
    // while the controls below all read "all".
    void loadPage({
      statuses: ACTIVE_STATUSES,
      page: 1,
      q: initialQ.current.trim() || undefined,
      customerId: undefined,
      userId: undefined,
      method: undefined,
      payment: undefined,
      from: undefined,
      to: undefined,
    });
    void loadCustomerOptions();
    void hydrateUsers();
  }, [loadPage, loadCustomerOptions, hydrateUsers]);

  // Free-text search now hits the DATABASE (invoice no + customer name), so it
  // is debounced ~300ms — a query per keystroke would be its own performance
  // problem. The first run is skipped because the mount effect already loaded.
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
   * Paid / Partial / Due are DERIVED from `paid` / `due`, not from a DB status
   * column, so they cannot be pushed into SQL — they stay CLIENT-side over the
   * rows of the current page (the UI states that next to the chips). Only
   * 'voided' maps to a real lifecycle status, so that one goes into the query.
   */
  const baseStatuses = () => (showVoided ? WITH_VOID_STATUSES : ACTIVE_STATUSES);

  /**
   * Paid / Partial / Due now go into the SQL query.
   *
   * They used to be filtered here in JavaScript over the rows of the loaded page,
   * with a note in the UI saying so. That is a trap rather than a caveat: on a
   * shop with history, clicking "Due" filtered the newest 50 invoices and said
   * "No sales match these filters" while thirty unpaid ones sat on page four, and
   * the pager and the page totals disagreed with the rows on screen. See
   * `PageQuery.payment` in backend/services/paged.ts.
   */
  const onStatus = (next: StatusFilter) => {
    setStatus(next);
    const statuses: SaleStatus[] = next === 'voided' ? ['void'] : baseStatuses();
    const payment =
      next === 'paid' || next === 'partial' || next === 'due' ? next : undefined;
    void loadPage({ statuses, payment, page: 1 });
  };

  /**
   * Toggle voided rows in or out. When the "voided" chip is the active filter,
   * turning the toggle off would leave the screen querying voids while claiming
   * to hide them, so the chip is reset to "all" at the same time.
   */
  const toggleVoided = () => {
    const next = !showVoided;
    setShowVoided(next);
    if (status === 'voided' && !next) {
      // Hiding voids while "voided only" is the active chip would contradict
      // itself, so the chip falls back to "all".
      setStatus('all');
      void loadPage({ statuses: ACTIVE_STATUSES, payment: undefined, page: 1 });
      return;
    }
    if (status === 'voided') return; // already querying voids only
    void loadPage({ statuses: next ? WITH_VOID_STATUSES : ACTIVE_STATUSES, page: 1 });
  };

  // EVERY filter is now applied in SQL — status, payment state, customer, user,
  // method, date and free text — so the rows, the pager and the totals below all
  // describe the same result set. Nothing is filtered again here.
  const pageRows = sales;

  // These sums cover the LOADED PAGE only — the rest of the range was never
  // fetched. Labelled "this page" in the UI so they can't read as range totals;
  // Reports is the place for full-range figures.
  const totals = useMemo(() => {
    const arr = pageRows.filter((s) => s.status !== 'void');
    return {
      count: arr.length,
      revenue: arr.reduce((s, x) => s + x.total, 0),
      paid: arr.reduce((s, x) => s + x.paid, 0),
      due: arr.reduce((s, x) => s + x.due, 0),
      tax: arr.reduce((s, x) => s + x.tax, 0),
      discount: arr.reduce((s, x) => s + x.orderDiscount + x.totalLineDiscount, 0),
    };
  }, [pageRows]);

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
            {/* Was a button with no handler. Writes the accountant-friendly CSV
                through the same `backup.export` channel Settings uses, into the
                configured backup folder. Deliberately labelled "all": it is the
                whole sales table, not the filtered page. */}
            <Button
              variant="outline"
              size="sm"
              disabled={exportBusy}
              onClick={() => void exportCsv('sales')}
              title="Write every sale to a CSV file in your backup folder"
            >
              <Download className="size-4" /> Export all
            </Button>
            <Button onClick={() => nav('/sales/new')}>
              <Plus className="size-4" /> New Sale
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
            <Stat label="Sales (this page)" value={String(totals.count)} />
            <Stat label="Revenue (this page)" value={formatBDT(totals.revenue)} tone="primary" />
            <Stat label="Paid (this page)" value={formatBDT(totals.paid)} tone="success" />
            <Stat label="Due (this page)" value={formatBDT(totals.due)} tone="destructive" />
            <Stat label="Tax (this page)" value={formatBDT(totals.tax)} />
            <Stat label="Discount (this page)" value={formatBDT(totals.discount)} />
          </div>
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
            <option value="custom">Custom</option>
          </select>
          <select
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              void loadPage({ customerId: e.target.value });
            }}
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
            onChange={(e) => {
              setCashier(e.target.value);
              void loadPage({ userId: e.target.value });
            }}
            className="h-9 px-2 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="all">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              void loadPage({ method: e.target.value });
            }}
            className="h-9 px-2 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="all">All methods</option>
            {['Cash', 'bKash', 'Nagad', 'Card', 'Bank', 'Credit'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-xs">
              {/* Plain words, one vocabulary — see SettlementBadge. These used to
                  render the raw filter keys, so the chips read "partial" / "due"
                  while meaning "part paid" / "nothing paid yet". */}
              {(['all', 'paid', 'partial', 'due'] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => onStatus(s)}
                  className={cn(
                    'px-3 py-1 rounded font-medium transition',
                    status === s
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {s === 'all' ? 'All' : SETTLEMENT_LABEL[s as SettlementKey]}
                </button>
              ))}
            </div>
          </div>

          {/* VOIDED — hidden unless asked for. Kept as its own small toggle rather
              than a chip in the row above, because it answers a different
              question: those chips ask "how much has been paid", this one asks
              "should cancelled sales be on screen at all". */}
          <button
            onClick={toggleVoided}
            title={
              showVoided
                ? 'Hide cancelled (voided) sales'
                : 'Show cancelled (voided) sales as well'
            }
            className={cn(
              'h-9 px-3 inline-flex items-center gap-1.5 rounded-md border text-xs font-medium transition',
              showVoided
                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            {showVoided ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {showVoided ? 'Voided shown' : 'Show voided'}
          </button>
          {showVoided && (
            <button
              onClick={() => onStatus(status === 'voided' ? 'all' : 'voided')}
              className={cn(
                'h-9 px-3 rounded-md border text-xs font-medium transition',
                status === 'voided'
                  ? 'border-destructive bg-destructive text-destructive-foreground'
                  : 'border-border text-muted-foreground hover:bg-secondary',
              )}
            >
              Voided only
            </button>
          )}
        </Card>

        {/* Table */}
        {loading && sales.length === 0 ? (
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
                {pageRows.map((s) => (
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
                        {/* Was a button with no handler at all. Opens the stored
                            invoice ready to print or save as PDF. */}
                        <button
                          onClick={() => setPrintFor(s)}
                          className="size-7 grid place-items-center rounded hover:bg-secondary"
                          title="Print invoice"
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
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-muted-foreground">
                      No sales match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={query.page}
            pageSize={query.pageSize}
            total={total}
            onPageChange={(page) => void loadPage({ page })}
            onPageSizeChange={(pageSize) => void loadPage({ pageSize })}
            label="sales"
            busy={loading}
          />
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

      {/* The list row carries the customer's NAME but not their record, so the
          modal reads the customer itself before printing. */}
      <InvoicePrintModal
        open={!!printFor}
        onClose={() => setPrintFor(null)}
        sale={printFor}
      />

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
      // Status is passed too, so a draft or quotation can never read "Paid".
      return (
        <td className="px-3 py-2.5">
          <SettlementBadge paid={s.paid} due={s.due} credited={s.credited} status={s.status} />
        </td>
      );
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
