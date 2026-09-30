import { useMemo } from 'react';
import { useLang, type Lang } from '@/lib/i18n';
import { useSettings } from '@/stores/settings';

/**
 * ONE WAY TO SHOW A DATE.
 *
 * Screens used `toLocaleDateString('en-GB')` and friends directly (~50 call
 * sites), which ignored the language toggle ("30 Sept 2026" in the Bangla UI,
 * where the translation layer cannot match it) and ignored the shop's own
 * Settings → Business → Date format, which nothing read.
 *
 * These helpers follow both:
 *  - the pattern comes from `business.dateFormat` (DD/MM/YYYY by default);
 *  - month names follow the language toggle ("Sep" / "সেপ্টেম্বর").
 * Digits stay Latin in both languages, the same as every amount in the app
 * (formatBDT), so a date and a price on one line read alike.
 *
 * In a component, prefer `useDateFormat()` — it re-renders when the language or
 * the pattern changes. The plain functions read the current state once.
 */

export type DatePattern = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD MMM YYYY';

const PATTERNS: readonly DatePattern[] = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD MMM YYYY'];

const MONTHS: Record<Lang, readonly string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  bn: [
    'জানুয়ারি',
    'ফেব্রুয়ারি',
    'মার্চ',
    'এপ্রিল',
    'মে',
    'জুন',
    'জুলাই',
    'আগস্ট',
    'সেপ্টেম্বর',
    'অক্টোবর',
    'নভেম্বর',
    'ডিসেম্বর',
  ],
};

type DateInput = Date | string | number | null | undefined;

interface Opts {
  /** Override the shop's pattern (e.g. a fixed format for a CSV file name). */
  pattern?: string;
  /** Override the current language. */
  lang?: Lang;
}

const pad = (n: number) => String(n).padStart(2, '0');

function toDate(v: DateInput): Date | null {
  if (v == null || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function currentPattern(p?: string): DatePattern {
  const want = p ?? useSettings.getState().business.dateFormat;
  return (PATTERNS as readonly string[]).includes(want) ? (want as DatePattern) : 'DD/MM/YYYY';
}

/** Shown in place of a missing or unreadable date. */
export const NO_DATE = '—';

/** 30/09/2026 (or the shop's pattern). Local calendar day, never UTC. */
export function formatDate(v: DateInput, opts: Opts = {}): string {
  const d = toDate(v);
  if (!d) return NO_DATE;
  const lang = opts.lang ?? useLang.getState().lang;
  const dd = pad(d.getDate());
  const mm = pad(d.getMonth() + 1);
  const yyyy = String(d.getFullYear());
  switch (currentPattern(opts.pattern)) {
    case 'MM/DD/YYYY':
      return `${mm}/${dd}/${yyyy}`;
    case 'YYYY-MM-DD':
      return `${yyyy}-${mm}-${dd}`;
    case 'DD MMM YYYY':
      return `${d.getDate()} ${MONTHS[lang][d.getMonth()]} ${yyyy}`;
    default:
      return `${dd}/${mm}/${yyyy}`;
  }
}

/** 2:05 PM — 12-hour clock, as shops in Bangladesh read it. */
export function formatTime(v: DateInput): string {
  const d = toDate(v);
  if (!d) return NO_DATE;
  const h = d.getHours();
  return `${h % 12 || 12}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

/** 30/09/2026 2:05 PM */
export function formatDateTime(v: DateInput, opts: Opts = {}): string {
  const d = toDate(v);
  if (!d) return NO_DATE;
  return `${formatDate(d, opts)} ${formatTime(d)}`;
}

/** 30 Sep (30 সেপ্টেম্বর in Bangla) — for chart axes and tight chips. */
export function formatDayMonth(v: DateInput, opts: Pick<Opts, 'lang'> = {}): string {
  const d = toDate(v);
  if (!d) return NO_DATE;
  const lang = opts.lang ?? useLang.getState().lang;
  return `${d.getDate()} ${MONTHS[lang][d.getMonth()]}`;
}

/**
 * The same helpers bound to the current language and the shop's pattern, and
 * subscribed to both — use this inside components.
 */
export function useDateFormat() {
  const lang = useLang((s) => s.lang);
  const pattern = useSettings((s) => s.business.dateFormat);
  return useMemo(
    () => ({
      date: (v: DateInput) => formatDate(v, { lang, pattern }),
      time: (v: DateInput) => formatTime(v),
      dateTime: (v: DateInput) => formatDateTime(v, { lang, pattern }),
      dayMonth: (v: DateInput) => formatDayMonth(v, { lang }),
    }),
    [lang, pattern],
  );
}
