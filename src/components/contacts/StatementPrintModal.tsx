import { useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import { pickPrinter, printSheet } from '@/lib/printing';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { PrintSheet } from '@/components/ui/PrintSheet';
import { usePaperWidth } from '@/hooks/usePaperWidth';
import { useSettings } from '@/stores/settings';
import { labelFor } from '@/lib/labels';
import { formatDate } from '@/lib/formatDate';
import { formatBDT } from '@/lib/utils';
import type { KhataRow } from '@/hooks/useKhata';
import { khataWords, PERIOD_OPTIONS, periodStart, sliceKhata, type KhataKind, type KhataPeriod } from './KhataTable';

/**
 * PRINT A CUSTOMER / SUPPLIER STATEMENT (the khata on paper).
 *
 * Same mechanics as the purchase note: an on-screen preview, and a black-on-
 * white `PrintSheet` sent with `printSheet(…, { kind: 'document' })` (an A4
 * printer when the shop has one). Rows are the backend ledger, sliced by
 * period with the balance brought forward — nothing is recomputed.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  kind: KhataKind;
  contact: { name: string; phone?: string; address?: string };
  rows: KhataRow[];
  /** Period the khata tab shows; the statement starts on the same one. */
  initialPeriod?: KhataPeriod;
}

export function StatementPrintModal({ open, onClose, kind, contact, rows, initialPeriod = 'all' }: Props) {
  const receiptPaper = usePaperWidth();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  const [period, setPeriod] = useState<KhataPeriod>(initialPeriod);

  if (!open) return null;
  // Lay the sheet out for the printer `kind: 'document'` will pick.
  const paper = pickPrinter('document')?.paperWidth === 210 ? 'A4' : receiptPaper;

  const print = async () => {
    if (printing) return;
    setPrinting(true);
    try {
      await printSheet(sheetRef.current, { kind: 'document' });
    } finally {
      setPrinting(false);
    }
  };

  const sheet = <StatementSheet kind={kind} contact={contact} rows={rows} period={period} />;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        width="max-w-3xl"
        title={kind === 'customer' ? 'Customer statement' : 'Supplier statement'}
        subtitle={contact.name}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => void print()} disabled={printing}>
              <Printer className="size-4" /> {printing ? 'Printing…' : 'Print'}
            </Button>
          </div>
        }
      >
        <div className="px-5 pt-4 pb-3 flex items-center gap-3">
          <span className="text-sm font-medium">Period</span>
          <Segmented ariaLabel="Period" value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
        </div>
        <div className="bg-muted py-6 px-4">{sheet}</div>
      </Modal>

      <PrintSheet paper={paper} sheetRef={sheetRef}>
        {sheet}
      </PrintSheet>
    </>
  );
}

function StatementSheet({
  kind,
  contact,
  rows,
  period,
}: {
  kind: KhataKind;
  contact: Props['contact'];
  rows: KhataRow[];
  period: KhataPeriod;
}) {
  const business = useSettings((s) => s.business);
  const phones = [business.phonePrimary, business.phoneAlt].filter(Boolean).join(', ');
  const words = khataWords(kind);
  const view = sliceKhata(rows, period);
  const from = periodStart(period);
  const money = (n: number) => formatBDT(n, { withSymbol: false });
  const today = formatDate(new Date());

  return (
    /* pt/mm on purpose: the printed page ignores the in-app text size. */
    <div className="print-doc bg-white text-black w-full max-w-[820px] mx-auto p-[6mm] font-[Inter,sans-serif] text-[9pt] leading-snug">
      <div className="text-center mb-[3mm]">
        {business.name && <div className="text-[14pt] font-bold tracking-tight break-words">{business.name}</div>}
        {business.address && <div className="break-words">{business.address}</div>}
        {phones && <div className="break-words">{phones}</div>}
        <div className="text-[11pt] font-semibold mt-[2mm]">
          {kind === 'customer' ? 'Customer statement' : 'Supplier statement'}
        </div>
      </div>

      <div className="border-t border-b border-black/30 py-[1.5mm] space-y-[0.5mm]">
        <SheetRow label={kind === 'customer' ? 'Customer' : 'Supplier'} value={contact.name} />
        {contact.phone && <SheetRow label="Phone" value={contact.phone} />}
        {contact.address && <SheetRow label="Address" value={contact.address} />}
        <SheetRow label="Period" value={from ? `${formatDate(from)} – ${today}` : `– ${today}`} />
      </div>

      <table className="w-full mt-[2mm] border-collapse">
        <thead>
          <tr className="border-b border-black/40">
            <th className="text-left py-[1mm] font-semibold">Date</th>
            <th className="text-left py-[1mm] font-semibold">Details</th>
            <th className="text-right py-[1mm] font-semibold">{words.plus}</th>
            <th className="text-right py-[1mm] font-semibold">{words.minus}</th>
            <th className="text-right py-[1mm] font-semibold">Balance</th>
          </tr>
        </thead>
        <tbody>
          {view.opening !== null && (
            <tr className="border-b border-black/10">
              <td className="py-[1mm]" colSpan={4}>
                Opening balance
              </td>
              <td className="py-[1mm] text-right tabular">{money(view.opening)}</td>
            </tr>
          )}
          {view.rows.map((e) => (
            <tr key={e.id} className="border-b border-black/10 align-top">
              <td className="py-[1mm] pr-[2mm] whitespace-nowrap">{formatDate(e.date)}</td>
              <td className="py-[1mm] pr-[2mm] break-words">
                {labelFor('ledgerType', e.type)} {e.reference}
              </td>
              <td className="py-[1mm] text-right tabular">{e.debit > 0 ? money(e.debit) : ''}</td>
              <td className="py-[1mm] text-right tabular">{e.credit > 0 ? money(e.credit) : ''}</td>
              <td className="py-[1mm] text-right tabular">{money(e.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-[2mm] ml-auto w-full max-w-[80mm] border-t border-black/40 pt-[1mm]">
        <div className="flex justify-between gap-[2mm] text-[11pt] font-bold">
          <span>{words.closing}</span>
          <span className="tabular">৳ {money(view.closing)}</span>
        </div>
      </div>

      <div className="mt-[10mm] flex justify-between gap-[6mm] text-[8pt]">
        <div className="flex-1 border-t border-black/40 pt-[1mm] text-center">
          {kind === 'customer' ? 'Customer' : 'Supplier'}
        </div>
        <div className="flex-1 border-t border-black/40 pt-[1mm] text-center">For the shop</div>
      </div>
    </div>
  );
}

function SheetRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-[2mm]">
      <span className="shrink-0 font-semibold">{label}</span>
      <span className="min-w-0 text-right break-words">{value}</span>
    </div>
  );
}
