import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
// Used only inside formatBDT at call time (settings.ts does not import this file).
import { useSettings } from '@/stores/settings';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** The shop's money format (Settings → Business Info). */
export interface MoneyFormat {
  currencySymbol: string;
  currencyPosition: 'before' | 'after';
  decimalPlaces: number;
  thousandSeparator: string;
}

/**
 * Money as the shop writes it. Follows Business Info (symbol, position,
 * decimals, separator); with the default settings the output is exactly the
 * old fixed "৳ 1,23,456.00" (receipts depend on that). `opts.format` overrides
 * the saved settings, e.g. for a live preview of an unsaved draft.
 */
export function formatBDT(
  amount: number,
  opts?: { withSymbol?: boolean; format?: Partial<MoneyFormat> },
) {
  const { withSymbol = true } = opts ?? {};
  // Read lazily so this module stays free of store imports at load time.
  let saved: Partial<MoneyFormat> | undefined;
  try {
    saved = useSettings.getState().business;
  } catch {
    saved = undefined; // store not ready (e.g. during module init): fall back to the defaults
  }
  const f = { ...saved, ...opts?.format };
  const symbol = typeof f.currencySymbol === 'string' && f.currencySymbol !== '' ? f.currencySymbol : '৳';
  const dp = Number.isInteger(f.decimalPlaces) ? Math.min(4, Math.max(0, f.decimalPlaces as number)) : 2;
  const sep = typeof f.thousandSeparator === 'string' ? f.thousandSeparator : ',';
  let str = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(amount);
  if (sep !== ',') {
    // en-IN gives "1,23,456.78": swap the group mark; a dot separator takes a comma decimal.
    const [int, frac] = str.split('.');
    const dec = sep === '.' ? ',' : '.';
    str = int.replace(/,/g, sep) + (frac !== undefined ? dec + frac : '');
  }
  if (!withSymbol) return str;
  return f.currencyPosition === 'after' ? `${str} ${symbol}` : `${symbol} ${str}`;
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat('en-IN').format(n);
}

export function relativeTime(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
