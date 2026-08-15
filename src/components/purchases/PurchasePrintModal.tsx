import { Printer } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PrintSheet } from '@/components/ui/PrintSheet';
import { usePaperWidth } from '@/hooks/usePaperWidth';
import { useSettings } from '@/stores/settings';
import { formatBDT } from '@/lib/utils';
import type { PurchaseRecord } from '@/stores/purchases';

/**
 * PRINT A PURCHASE (GOODS RECEIVED NOTE).
 *
 * The purchase drawer had Print and Re-print buttons with no handler. They are
 * one working button now.
 *
 * This is NOT the sales receipt with different words. A purchase document answers
 * different questions: what arrived, at what unit cost, what was paid and what is
 * still owed to the supplier. The shop files it against the supplier's own
 * invoice, so the reference number, the supplier and the outstanding balance are
 * the things that have to be unmissable.
 *
 * Same print mechanics as the receipt: black on white, absolute units so the
 * paper copy ignores the app's font-scale slider, and portalled through
 * `PrintSheet` so only this prints.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  purchase: PurchaseRecord | null;
}

export function PurchasePrintModal({ open, onClose, purchase }: Props) {
  const paper = usePaperWidth();

  if (!open || !purchase) return null;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        width="max-w-3xl"
        title="Purchase"
        subtitle={purchase.refNo}
        footer={
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              File this against the supplier's own invoice.
            </div>
            <Button onClick={() => window.print()}>
              <Printer className="size-4" /> Print
            </Button>
          </div>
        }
      >
        <div className="bg-muted py-6">
          <PurchaseSheet purchase={purchase} />
        </div>
      </Modal>

      <PrintSheet paper={paper}>
        <PurchaseSheet purchase={purchase} />
      </PrintSheet>
    </>
  );
}

function PurchaseSheet({ purchase: p }: { purchase: PurchaseRecord }) {
  const business = useSettings((s) => s.business);
  const phones = [business.phonePrimary, business.phoneAlt].filter(Boolean).join(', ');
  const when = new Date(p.date);
  const stamp = `${when.toLocaleDateString('en-GB')} ${when.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
  const totalQty = p.lines.reduce((s, l) => s + l.qty, 0);

  return (
    /* pt/mm on purpose, as in Receipt.tsx: absolute units keep the printed page
       identical regardless of the in-app font-scale setting. */
    <div className="bg-white text-black w-full max-w-[820px] mx-auto p-[4mm] font-[Inter,sans-serif] text-[9pt] leading-snug">
      <div className="text-center mb-[2mm]">
        {business.name && (
          <div className="text-[13pt] font-bold tracking-tight break-words">{business.name}</div>
        )}
        {business.address && <div className="break-words">{business.address}</div>}
        {phones && (
          <div className="break-words">
            <span className="font-semibold">Mobile:</span> {phones}
          </div>
        )}
        <div className="text-[10pt] font-semibold mt-[2mm]">Goods Received Note</div>
      </div>

      <div className="border-t border-b border-black/30 py-[1.5mm]">
        <SheetRow label="Reference No." value={p.refNo} />
        <SheetRow label="Date" value={stamp} />
        <SheetRow label="Supplier" value={p.supplierName || '-'} mono={false} />
        {p.supplierAddress && (
          <SheetRow label="Address" value={p.supplierAddress} mono={false} />
        )}
        <SheetRow label="Status" value={p.status.replace('-', ' ')} mono={false} />
        <SheetRow label="Location" value={p.branch} mono={false} />
        <SheetRow label="Received by" value={p.user} mono={false} />
        {p.payTerms && <SheetRow label="Pay term" value={p.payTerms} mono={false} />}
      </div>

      <table className="w-full table-fixed mt-[2mm]">
        <thead className="border-b border-black/30">
          <tr>
            <th className="text-left py-[1mm] font-semibold">Item</th>
            <th className="text-right py-[1mm] font-semibold w-[26%]">Line total</th>
          </tr>
        </thead>
        <tbody>
          {p.lines.map((l, i) => (
            <tr key={i} className="border-b border-black/10 align-top">
              <td className="py-[1mm] pr-[2mm]">
                <div className="break-words">
                  {i + 1}. {l.name}
                  {l.sku ? `, ${l.sku}` : ''}
                </div>
                <div className="font-mono tabular text-[8pt]">
                  {l.qty} {l.unit} x {l.unitCostBeforeTax.toFixed(2)}
                </div>
                {l.imei && <div className="text-[8pt]">S/N: {l.imei}</div>}
              </td>
              <td className="py-[1mm] text-right font-mono tabular">{l.lineTotal.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-[2mm] ml-auto w-full max-w-[70mm]">
        <SheetRow label="Total quantity" value={String(totalQty)} />
        <SheetRow
          label="Subtotal"
          value={formatBDT(p.subtotal - p.totalLineDiscount, { withSymbol: false })}
        />
        {p.orderDiscount > 0 && (
          <SheetRow label="Order discount" value={`- ${formatBDT(p.orderDiscount, { withSymbol: false })}`} />
        )}
        {p.tax > 0 && (
          <SheetRow label={`Tax (${p.taxPct}%)`} value={formatBDT(p.tax, { withSymbol: false })} />
        )}
        {p.shipping > 0 && (
          <SheetRow label="Shipping" value={formatBDT(p.shipping, { withSymbol: false })} />
        )}
        {p.other > 0 && (
          <SheetRow label="Other charge" value={formatBDT(p.other, { withSymbol: false })} />
        )}
        <SheetRow label="Total" value={formatBDT(p.total, { withSymbol: false })} bold />
        <SheetRow label="Paid" value={formatBDT(p.paid, { withSymbol: false })} />
        <SheetRow label="Balance owed" value={formatBDT(p.due, { withSymbol: false })} bold />
      </div>

      {p.payments.length > 0 && (
        <div className="mt-[2mm] ml-auto w-full max-w-[70mm]">
          {p.payments.map((pay, i) => (
            <SheetRow
              key={i}
              label={`${pay.method}${pay.reference ? ' (' + pay.reference + ')' : ''}`}
              value={formatBDT(pay.amount, { withSymbol: false })}
            />
          ))}
        </div>
      )}

      {p.notes && (
        <div className="mt-[3mm] text-[8pt] break-words">
          <span className="font-semibold">Notes:</span> {p.notes}
        </div>
      )}

      <div className="mt-[8mm] flex justify-between gap-[6mm] text-[8pt]">
        <div className="flex-1 border-t border-black/40 pt-[1mm] text-center">
          Received by
        </div>
        <div className="flex-1 border-t border-black/40 pt-[1mm] text-center">
          Supplier / driver
        </div>
      </div>
    </div>
  );
}

function SheetRow({
  label,
  value,
  bold,
  mono = true,
}: {
  label: string;
  value: string;
  bold?: boolean;
  mono?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-[2mm] ${bold ? 'font-bold' : ''}`}>
      <span className="shrink-0 font-semibold">{label}</span>
      <span className={`min-w-0 text-right break-words ${mono ? 'font-mono tabular' : ''}`}>
        {value}
      </span>
    </div>
  );
}
