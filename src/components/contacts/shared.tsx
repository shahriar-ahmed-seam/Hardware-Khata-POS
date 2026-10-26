import { useState, type ReactNode } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { labelFor } from '@/lib/labels';
import { cn } from '@/lib/utils';

/** Badge colour for a customer group (the three fixed groups, B13). */
export function groupVariant(group: string | undefined): 'info' | 'warning' | 'default' {
  const g = (group ?? '').toLowerCase();
  return g === 'wholesale' ? 'info' : g === 'contractor' ? 'warning' : 'default';
}

/** "Retail" / "Wholesale" / "Contractor" as translatable words. */
export const groupLabel = (group: string | undefined) => labelFor('priceGroup', group);

/** Shared table header + cell classes for the contact/expense/cash lists. */
export const TH = 'text-xs font-medium text-muted-foreground px-3 py-2.5 whitespace-nowrap';
export const TD = 'px-3 py-3';

/** One money figure with a 14px label (list KPI strips, detail headers). */
export function MoneyStat({
  label,
  value,
  tone,
  hero,
  card = true,
}: {
  label: ReactNode;
  value: string;
  tone?: 'success' | 'destructive';
  hero?: boolean;
  card?: boolean;
}) {
  const body = (
    <>
      <div className="text-xs text-muted-foreground font-medium">{label}</div>
      <div
        className={cn(
          'font-bold mt-0.5 tabular',
          hero ? 'text-2xl' : card ? 'text-xl' : 'text-base',
          tone === 'success' && 'text-success',
          tone === 'destructive' && 'text-destructive',
        )}
      >
        {value}
      </div>
    </>
  );
  return card ? <Card className="p-4">{body}</Card> : <div>{body}</div>;
}

/**
 * Note above a page-scoped KPI strip. Says "this page only" once — and not at
 * all when the page already holds the whole list.
 */
export function PageScopeNote({ total, pageSize }: { total: number; pageSize: number }) {
  if (total <= pageSize) return null;
  return (
    <div className="text-xs text-muted-foreground mb-1.5">
      Totals for this page only. Use Reports for full-range figures.
    </div>
  );
}

/** Notes save when the box loses focus (not on every key) and say so. */
export function NotesBox({
  value,
  onSave,
  placeholder,
}: {
  value: string;
  onSave: (v: string) => Promise<boolean>;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);
  const [saved, setSaved] = useState(false);
  return (
    <div className="space-y-1.5">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        onBlur={async () => {
          if (text !== value && (await onSave(text))) setSaved(true);
        }}
        rows={6}
        aria-label="Notes"
        placeholder={placeholder}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
      />
      <div className="text-xs text-muted-foreground min-h-5" aria-live="polite">
        {saved ? 'Saved' : 'Saves when you click outside the box.'}
      </div>
    </div>
  );
}

/** Payment terms: "Net30" → "30 days" (number and word in separate nodes for Bangla). */
export function TermsText({ terms }: { terms: string | undefined }) {
  const m = /^net\s*(\d+)$/i.exec((terms ?? '').trim());
  if (!m) return <>{terms ?? ''}</>;
  return (
    <>
      <span className="tabular">{m[1]}</span> <span>days</span>
    </>
  );
}

/** Table / grid switch for the contact lists (40px, labelled). */
export function ViewToggle({
  value,
  onChange,
}: {
  value: 'table' | 'grid';
  onChange: (v: 'table' | 'grid') => void;
}) {
  return (
    <Segmented
      ariaLabel="View"
      value={value}
      onChange={onChange}
      options={[
        { value: 'table', label: <span className="sr-only">Table view</span>, icon: <List className="size-4" />, title: 'Table view' },
        { value: 'grid', label: <span className="sr-only">Grid view</span>, icon: <LayoutGrid className="size-4" />, title: 'Grid view' },
      ]}
    />
  );
}
