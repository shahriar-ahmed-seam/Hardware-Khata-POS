import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { labelFor } from '@/lib/labels';
import { useDateFormat } from '@/lib/formatDate';
import { formatBDT, cn } from '@/lib/utils';
import type { KhataRow } from '@/hooks/useKhata';
import { TH } from './shared';

/**
 * THE KHATA TABLE — shared by the customer and supplier detail pages, and the
 * period logic shared with the printed statement.
 *
 * Rows come straight from the backend ledger (useKhata); this only slices them
 * by date and adds an "Opening balance" row (the running balance just before
 * the period) and a bold closing row. No money is recomputed.
 */

export type KhataPeriod = 'month' | '3m' | 'all';
export type KhataKind = 'customer' | 'supplier';

export const PERIOD_OPTIONS = [
  { value: 'month' as const, label: 'This month' },
  { value: '3m' as const, label: 'Last 3 months' },
  { value: 'all' as const, label: 'All time' },
];

/** Start of the period (local time), or null for "all". */
export function periodStart(period: KhataPeriod, now = new Date()): Date | null {
  if (period === 'all') return null;
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
}

/** Rows inside the period, the balance carried in, and the closing balance. */
export function sliceKhata(rows: KhataRow[], period: KhataPeriod) {
  const from = periodStart(period);
  if (!from) {
    return { opening: null as number | null, rows, closing: rows.length ? rows[rows.length - 1].balance : 0 };
  }
  const t = from.getTime();
  const idx = rows.findIndex((r) => new Date(r.date).getTime() >= t);
  const inside = idx === -1 ? [] : rows.slice(idx);
  const before = idx === -1 ? rows : rows.slice(0, idx);
  const opening = before.length ? before[before.length - 1].balance : null;
  const closing = rows.length ? rows[rows.length - 1].balance : 0;
  return { opening, rows: inside, closing };
}

/** Column words: customer khata "Owes / Paid", supplier "Bill / Paid" (B15). */
export function khataWords(kind: KhataKind) {
  return kind === 'customer'
    ? { plus: 'Owes (+)', minus: 'Paid (−)', closing: 'Due now' }
    : { plus: 'Bill (+)', minus: 'Paid (−)', closing: 'Payable now' };
}

export function Dot({ type, kind }: { type: string; kind: KhataKind }) {
  const plus = kind === 'customer' ? 'sale' : 'purchase';
  const cls =
    type === plus
      ? 'bg-destructive'
      : type === 'payment'
        ? 'bg-success'
        : type === 'return'
          ? 'bg-warning'
          : 'bg-primary';
  return <span aria-hidden className={`size-2 rounded-full inline-block shrink-0 ${cls}`} />;
}

interface Props {
  kind: KhataKind;
  rows: KhataRow[];
  loading: boolean;
  period: KhataPeriod;
  onPeriodChange: (p: KhataPeriod) => void;
  /** Click on a row that belongs to a document (sale/purchase). */
  onOpen?: (row: KhataRow) => void;
  canOpen?: (row: KhataRow) => boolean;
}

export function KhataTable({ kind, rows, loading, period, onPeriodChange, onOpen, canOpen }: Props) {
  const fmt = useDateFormat();
  const words = khataWords(kind);
  const view = sliceKhata(rows, period);
  const money = (n: number) => formatBDT(n, { withSymbol: false });

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border">
        <Segmented
          ariaLabel="Period"
          size="sm"
          value={period}
          onChange={onPeriodChange}
          options={PERIOD_OPTIONS}
        />
      </div>
      <div className="max-h-[62vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary sticky top-0 z-[1]">
            <tr>
              <th className={cn(TH, 'text-left pl-4')}>Date</th>
              <th className={cn(TH, 'text-left')}>Type</th>
              <th className={cn(TH, 'text-left')}>Reference</th>
              <th className={cn(TH, 'text-right')}>{words.plus}</th>
              <th className={cn(TH, 'text-right')}>{words.minus}</th>
              <th className={cn(TH, 'text-right pr-4')}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No ledger entries yet.
                </td>
              </tr>
            ) : (
              <>
                {view.opening !== null && (
                  <tr className="border-t border-border bg-secondary/30">
                    <td className="px-4 py-3 text-muted-foreground" colSpan={5}>
                      Opening balance
                    </td>
                    <td className="px-4 py-3 text-right tabular font-semibold">{money(view.opening)}</td>
                  </tr>
                )}
                {view.rows.length === 0 && (
                  <tr className="border-t border-border">
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Nothing in this period.
                    </td>
                  </tr>
                )}
                {view.rows.map((e) => {
                  const clickable = !!onOpen && (canOpen ? canOpen(e) : true);
                  return (
                    <tr
                      key={e.id}
                      className={cn('border-t border-border', clickable && 'cursor-pointer hover:bg-secondary/40')}
                      onClick={() => clickable && onOpen?.(e)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">{fmt.date(e.date)}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-2 whitespace-nowrap">
                          <Dot type={e.type} kind={kind} />
                          {labelFor('ledgerType', e.type)}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">{e.reference}</td>
                      <td className="px-3 py-3 text-right tabular text-destructive">
                        {e.debit > 0 ? money(e.debit) : '—'}
                      </td>
                      <td className="px-3 py-3 text-right tabular text-success">
                        {e.credit > 0 ? money(e.credit) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular font-semibold">{money(e.balance)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-border bg-secondary/30">
                  <td className="px-4 py-3 font-semibold" colSpan={5}>
                    {words.closing}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3 text-right tabular text-base font-bold',
                      view.closing > 0 && 'text-destructive',
                    )}
                  >
                    {formatBDT(view.closing)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
