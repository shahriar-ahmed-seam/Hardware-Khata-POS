import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Download, Plus, Settings2, Eye, EyeOff, Printer, Undo2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Segmented } from '@/components/ui/Segmented';
import { IconButton } from '@/components/ui/IconButton';
import {
  SettlementBadge,
  SETTLEMENT_LABEL,
  type SettlementKey,
} from '@/components/ui/SettlementBadge';
import { Card } from '@/components/ui/Card';
import { DateField } from '@/components/ui/DateTimeField';
import { ColumnsPanel } from '@/components/ui/ColumnsPanel';
import { labelFor } from '@/lib/labels';
import { useDateFormat } from '@/lib/formatDate';
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

/** B11: inclusive local-day bounds for a Custom range (YYYY-MM-DD inputs). */
function customToRange(from: string, to: string): { from?: string; to?: string } {
  const day = (v: string) => {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  return {
    from: from ? startOfLocalDay(day(from)).toISOString() : undefined,
    to: to ? endOfLocalDay(day(to)).toISOString() : undefined,
  };
}

export default function Sales() {
  const nav = useNavigate();
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
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
      due: arr.reduce((s, x) => s + x.due, 0),
    };
  }, [pageRows]);

  return (
    <div>
      <PageHeader
        title="All Sales"
        actions={
          <>
            <IconButton
              label="Customize columns"
              variant="outline"
              onClick={() => setColsOpen(true)}
            >
              <Settings2 className="size-4" />
            </IconButton>
            {/* Import is switched off until real importers exist (see /import). */}
            {/* Was a button with no handler. Writes the accountant-friendly CSV
                through the same `backup.export` channel Settings uses, into the
                configured backup folder. Deliberately labelled "all": it is the
                whole sales table, not the filtered page. */}
            <Button
              variant="outline"
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
          <Select
            aria-label="Date"
            value={date}
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
            <option value="custom">Custom</option>
          </Select>
          {date === 'custom' && (
            <>
              <DateField
                value={customFrom}
                onChange={(v: string) => {
                  setCustomFrom(v);
                  void loadPage(customToRange(v, customTo));
                }}
                title="From date"
              />
              <DateField
                value={customTo}
                onChange={(v: string) => {
                  setCustomTo(v);
                  void loadPage(customToRange(customFrom, v));
                }}
                title="To date"
              />
            </>
          )}
          <Select
            aria-label="Customer"
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              void loadPage({ customerId: e.target.value });
            }}
            className="w-auto max-w-[220px]"
          >
            <option value="all">All customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="User"
            value={cashier}
            onChange={(e) => {
              setCashier(e.target.value);
              void loadPage({ userId: e.target.value });
            }}
            className="w-auto"
          >
            <option value="all">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Method"
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              void loadPage({ method: e.target.value });
            }}
            className="w-auto"
          >
            <option value="all">All methods</option>
            {['Cash', 'bKash', 'Nagad', 'Card', 'Bank', 'Credit'].map((m) => (
              <option key={m} value={m}>
                {labelFor('paymentMethod', m)}
              </option>
            ))}
          </Select>
          {/* Plain words, one vocabulary — see SettlementBadge. */}
          <Segmented
            ariaLabel="Payment status"
            value={status}
            onChange={(s) => onStatus(s)}
            options={(['all', 'paid', 'partial', 'due'] as StatusFilter[]).map((s) => ({
              value: s,
              label: s === 'all' ? 'All' : SETTLEMENT_LABEL[s as SettlementKey],
            }))}
          />

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
              'h-10 px-3 inline-flex items-center gap-1.5 rounded-md border text-sm font-medium transition',
              showVoided
                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            {showVoided ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {showVoided ? 'Voided shown' : 'Show voided'}
          </button>
          {showVoided && (
            <button
              onClick={() => onStatus(status === 'voided' ? 'all' : 'voided')}
              className={cn(
                'h-10 px-3 rounded-md border text-sm font-medium transition',
                status === 'voided'
                  ? 'border-destructive bg-destructive text-destructive-foreground'
                  : 'border-border text-muted-foreground hover:bg-secondary',
              )}
            >
              Voided only
            </button>
          )}
        </Card>

        {/* One summary line for the loaded page (was six "(this page)" cards).
            Words and numbers in separate nodes so Bangla can translate them. */}
        {pageRows.length > 0 && (
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm text-muted-foreground px-1">
            <span>On this page</span>
            <span>
              <span>Sales</span>{' '}
              <span className="font-semibold text-foreground tabular">{totals.count}</span>
            </span>
            <span>
              <span>Total</span>{' '}
              <span className="font-semibold text-foreground tabular">{formatBDT(totals.revenue)}</span>
            </span>
            <span>
              <span>Due</span>{' '}
              <span
                className={cn(
                  'font-semibold tabular',
                  totals.due > 0.004 ? 'text-destructive' : 'text-foreground',
                )}
              >
                {formatBDT(totals.due)}
              </span>
            </span>
          </div>
        )}

        {/* Table */}
        {loading && sales.length === 0 ? (
          <SkeletonTable count={8} />
        ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-secondary/50 sticky top-0">
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
                  <th className="w-24">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s) => (
                  // The row opens the sale (the Eye icon said the same thing).
                  <tr
                    key={s.id}
                    className="border-t border-border hover:bg-secondary/40 cursor-pointer"
                    onClick={() => setOpenId(s.id)}
                  >
                    {columns.map((c) => (
                      <Cell key={c} c={c} s={s} />
                    ))}
                    <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <IconButton size="sm" label="Print invoice" onClick={() => setPrintFor(s)}>
                          <Printer className="size-4" />
                        </IconButton>
                        {/* A voided sale has nothing left to return. */}
                        {s.status !== 'void' && (
                          <IconButton size="sm" label="Return goods" onClick={() => setReturnFor(s.id)}>
                            <Undo2 className="size-4" />
                          </IconButton>
                        )}
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
  const fmt = useDateFormat();
  const align = SALES_COLUMN_META[c].align === 'right' ? 'text-right tabular' : '';
  switch (c) {
    case 'date':
      return (
        <td className="px-3 py-2.5 whitespace-nowrap">
          {fmt.date(s.date)}{' '}
          <span className="text-muted-foreground">{fmt.time(s.date)}</span>
        </td>
      );
    case 'invoice':
      // Never wraps: the number broke onto three lines and tripled row height.
      return <td className="px-3 py-2.5 whitespace-nowrap">{s.invoiceNo}</td>;
    case 'customer':
      return <td className="px-3 py-2.5 font-medium min-w-[180px]">{s.customerName}</td>;
    case 'items':
      return <td className={`px-3 py-2.5 ${align}`}>{s.lines.reduce((n, l) => n + l.qty, 0)}</td>;
    case 'subtotal':
      return <td className={`px-3 py-2.5 ${align} text-muted-foreground`}>{formatBDT(s.subtotal, { withSymbol: false })}</td>;
    case 'discount':
      return <td className={`px-3 py-2.5 ${align} text-muted-foreground`}>{formatBDT(s.orderDiscount + s.totalLineDiscount, { withSymbol: false })}</td>;
    case 'tax':
      return <td className={`px-3 py-2.5 ${align} text-muted-foreground`}>{formatBDT(s.tax, { withSymbol: false })}</td>;
    case 'total':
      // A voided total is struck through (the row used to fade, which failed contrast).
      return (
        <td className={cn(`px-3 py-2.5 ${align} font-semibold`, s.status === 'void' && 'line-through text-muted-foreground')}>
          {formatBDT(s.total, { withSymbol: false })}
        </td>
      );
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
      const text =
        methods.length === 0 ? '—' : labelFor('paymentMethod', methods.length === 1 ? methods[0] : 'Mixed');
      return <td className="px-3 py-2.5 whitespace-nowrap">{text}</td>;
    }
    case 'cashier':
      return <td className="px-3 py-2.5 text-muted-foreground">{s.user}</td>;
    case 'branch':
      return <td className="px-3 py-2.5 text-muted-foreground">{s.branch}</td>;
    case 'profit':
      return <td className={`px-3 py-2.5 ${align} text-success`}>{s.profit ? formatBDT(s.profit, { withSymbol: false }) : '—'}</td>;
    case 'type':
      return (
        <td className="px-3 py-2.5">
          <Badge variant={s.status === 'void' ? 'destructive' : 'default'}>
            {s.status === 'void' ? 'Voided' : labelFor('saleStatus', s.status)}
          </Badge>
        </td>
      );
  }
}
