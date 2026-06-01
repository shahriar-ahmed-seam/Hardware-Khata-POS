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
      from = r.from ? new Date(r.from) : startOfDay(now);
      to = r.to ? new Date(r.to) : endOfDay(now);
      break;
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Inclusive check used by aggregations. */
export function inRange(iso: string, range: ResolvedRange): boolean {
  return iso >= range.from && iso <= range.to;
}
