/**
 * Date-range resolution for dashboard + reports. Mirrors the frontend
 * ReportToolbar presets so backend and UI always agree on what "this month"
 * means. Returns ISO strings (inclusive bounds).
 */

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'custom';

export interface RangeInput {
  preset: DatePreset;
  from?: string; // ISO date when custom
  to?: string;
}

export interface ResolvedRange {
  from: string; // ISO datetime (start of range)
  to: string;   // ISO datetime (end of range)
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** A bare calendar day, as produced by an `<input type="date">`. */
const BARE_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse one end of a CUSTOM range.
 *
 * `new Date('2026-01-10')` is parsed by JavaScript as UTC midnight, not local
 * midnight. That made a custom range silently wrong in two ways:
 *
 *   - the whole of the LAST day was excluded, because every event on 10 January
 *     is after 2026-01-10T00:00:00Z. The owner picking 1st to 10th got nine days.
 *   - the bounds were on a different clock from every preset above, which use
 *     LOCAL midnight. So "custom, today to today" and the "today" preset did not
 *     cover the same window, and in UTC+6 (Bangladesh) they were six hours apart.
 *
 * A bare `YYYY-MM-DD` is therefore anchored to the local day the user picked, and
 * the `to` end is stretched to 23:59:59.999 so it is INCLUSIVE, matching the
 * documented contract of this module and `inRange` below. A full datetime string
 * is passed through untouched — a caller that specified a time meant it.
 */
function parseBound(value: string, which: 'from' | 'to'): Date {
  if (BARE_DAY.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return which === 'from'
      ? new Date(y, m - 1, d, 0, 0, 0, 0)
      : new Date(y, m - 1, d, 23, 59, 59, 999);
  }
  return new Date(value);
}

export function resolveRange(r: RangeInput, now = new Date()): ResolvedRange {
  let from: Date;
  let to: Date;
  switch (r.preset) {
    case 'today':
      from = startOfDay(now);
      to = endOfDay(now);
      break;
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      from = startOfDay(y);
      to = endOfDay(y);
      break;
    }
    case 'thisWeek': {
      const d = new Date(now);
      const day = d.getDay(); // 0=Sun..6=Sat
      const diff = (day + 1) % 7; // days since Saturday (BD week start)
      const f = new Date(d);
      f.setDate(d.getDate() - diff);
      from = startOfDay(f);
      to = endOfDay(now);
      break;
    }
    case 'thisMonth':
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      to = endOfDay(now);
      break;
    case 'lastMonth':
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    case 'thisYear':
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      to = endOfDay(now);
      break;
    case 'custom':
    default:
      from = r.from ? parseBound(r.from, 'from') : startOfDay(now);
      to = r.to ? parseBound(r.to, 'to') : endOfDay(now);
      break;
  }
  // A caller that hands over the dates the wrong way round gets an empty range
  // otherwise, which reads on screen as "the shop sold nothing" rather than as a
  // mistake. Swapping is the only interpretation that is not a lie.
  if (from > to) [from, to] = [to, from];
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Inclusive check used by aggregations. */
export function inRange(iso: string, range: ResolvedRange): boolean {
  return iso >= range.from && iso <= range.to;
}
