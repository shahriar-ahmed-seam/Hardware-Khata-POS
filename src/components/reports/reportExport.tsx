import { forwardRef } from 'react';
import { isBanglaUIActive, translatePhrase } from '@/lib/bn/translate';
import { formatDate, formatDateTime } from '@/lib/formatDate';

/**
 * WHAT A REPORT PRINTS AND EXPORTS — plain text, built from the same column
 * definitions as the on-screen table, so paper, CSV and screen agree.
 */
export interface ReportDocSection {
  heading?: string;
  columns: { header: string; align?: 'left' | 'right' }[];
  rows: string[][];
  /** Raw values for CSV (numbers stay numbers); falls back to `rows`. */
  csvRows?: (string | number)[][];
  footer?: string[];
  csvFooter?: (string | number)[];
  /** Cells that are UI words (status, type) — translated in a Bangla CSV. */
  wordColumns?: number[];
}

export interface ReportDoc {
  kpis?: { label: string; value: string }[];
  sections: ReportDocSection[];
}

/** Report header shared by the print sheet and the CSV. */
export interface ReportMeta {
  shop: string;
  title: string;
  /** "01/09/2026 – 30/09/2026" or "As of now". */
  period: string;
}

/** A UI label in the current language (the Bangla layer translates the screen, not files). */
const word = (s: string) => (isBanglaUIActive() ? (translatePhrase(s) ?? s) : s);

// ---------------------------------------------------------------- CSV

const cell = (v: string | number) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function reportToCsv(meta: ReportMeta, doc: ReportDoc): string {
  const lines: (string | number)[][] = [];
  if (meta.shop) lines.push([meta.shop]);
  lines.push([word(meta.title)], [meta.period], []);
  if (doc.kpis?.length) {
    for (const k of doc.kpis) lines.push([word(k.label), k.value]);
    lines.push([]);
  }
  for (const s of doc.sections) {
    if (s.heading) lines.push([word(s.heading)]);
    lines.push(s.columns.map((c) => word(c.header)));
    const body = s.csvRows ?? s.rows;
    const words = new Set(s.wordColumns ?? []);
    for (const r of body) lines.push(r.map((v, i) => (words.has(i) && typeof v === 'string' ? word(v) : v)));
    const foot = s.csvFooter ?? s.footer;
    if (foot) lines.push(foot.map((v, i) => (i === 0 && typeof v === 'string' ? word(v) : v)));
    lines.push([]);
  }
  return lines.map((r) => r.map(cell).join(',')).join('\r\n');
}

/** Save as a .csv file. The BOM makes Excel read the file as UTF-8 (Bangla, ৳). */
export function downloadCsv(meta: ReportMeta, doc: ReportDoc) {
  const blob = new Blob(['\uFEFF', reportToCsv(meta, doc)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const slug = meta.title.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'report';
  a.href = url;
  a.download = `${slug}-${formatDate(new Date(), { pattern: 'YYYY-MM-DD' })}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------- print

/**
 * The A4 sheet. Black on white, plain table, the shop and the period on top.
 * Rendered inside a <PrintSheet>; the Bangla layer translates its labels.
 */
export const ReportPrintDoc = forwardRef<HTMLDivElement, { meta: ReportMeta; doc: ReportDoc }>(
  ({ meta, doc }, ref) => (
    <div ref={ref} className="print-doc text-[10pt] leading-snug text-black">
      <div className="mb-3 border-b border-black pb-2">
        {meta.shop && <div className="text-[13pt] font-bold">{meta.shop}</div>}
        <div className="text-[12pt] font-semibold">{meta.title}</div>
        <div className="flex justify-between gap-4">
          <span>{meta.period}</span>
          <span>
            <span>Printed</span> <span>{formatDateTime(new Date())}</span>
          </span>
        </div>
      </div>
      {!!doc.kpis?.length && (
        <table className="mb-3 w-full border-collapse">
          <tbody>
            {doc.kpis.map((k) => (
              <tr key={k.label}>
                <td className="py-0.5 pr-4">{k.label}</td>
                <td className="py-0.5 text-right font-semibold tabular">{k.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {doc.sections.map((s, si) => (
        <div key={si} className="mb-3">
          {s.heading && <div className="mb-1 font-semibold">{s.heading}</div>}
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {s.columns.map((c, i) => (
                  <th
                    key={i}
                    className={`border-b border-black py-1 pr-2 font-semibold ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.rows.map((r, ri) => (
                <tr key={ri} className="border-b border-gray-300" style={{ breakInside: 'avoid' }}>
                  {r.map((v, i) => (
                    <td key={i} className={`py-0.5 pr-2 ${s.columns[i]?.align === 'right' ? 'text-right tabular' : ''}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {s.footer && (
              <tfoot>
                <tr className="border-t border-black font-semibold">
                  {s.footer.map((v, i) => (
                    <td key={i} className={`py-1 pr-2 ${s.columns[i]?.align === 'right' ? 'text-right tabular' : ''}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ))}
    </div>
  ),
);
ReportPrintDoc.displayName = 'ReportPrintDoc';
