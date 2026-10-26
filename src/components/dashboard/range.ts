import { useDashboard, type TimeRange } from '@/stores/dashboard';

/**
 * The dashboard's time range in words. Labels used to say "today" whatever
 * range was picked; every range-driven card now shows this instead. Each is a
 * whole phrase so the Bangla layer translates it.
 */
export const RANGE_LABEL: Record<TimeRange, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  month: 'This month',
  lastMonth: 'Last month',
  custom: 'Chosen dates',
};

/** What the delta compares with, per range. */
export const COMPARE_LABEL: Record<TimeRange, string> = {
  today: 'vs yesterday',
  yesterday: 'vs the day before',
  week: 'vs last week',
  month: 'vs last month',
  lastMonth: 'vs the month before',
  custom: 'vs the period before',
};

export function useRange() {
  const range = useDashboard((s) => s.range);
  return { range, label: RANGE_LABEL[range], compare: COMPARE_LABEL[range] };
}
