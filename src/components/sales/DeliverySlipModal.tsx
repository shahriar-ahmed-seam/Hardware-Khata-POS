import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PrintSheet } from '@/components/ui/PrintSheet';
import { usePaperWidth } from '@/hooks/usePaperWidth';
import { api } from '@/lib/api';
import { labelFor } from '@/lib/labels';
import { formatDate, formatDateTime } from '@/lib/formatDate';
import { parseRangeBound } from '@/lib/datetime';
import { useSettings } from '@/stores/settings';
import { toSaleRecord, type BackendSale } from '@/hooks/saleAdapter';
import type { SaleRecord, Shipment } from '@/stores/sales';

/**
 * DELIVERY SLIP (R82) — goes with the goods: who, where, what, and a line for
 * the receiver's signature. No prices on purpose (the driver carries it).
 * Same pattern as InvoicePrintModal: the preview and the printed PrintSheet
 * are the same component, and the sheet only exists while the modal is open.
 */
interface Props {
  shipment: Shipment | null;
  onClose: () => void;
}

export function DeliverySlipModal({ shipment, onClose }: Props) {
  const paper = usePaperWidth();
  const [sale, setSale] = useState<SaleRecord | null>(null);
  const saleId = shipment?.saleId;

  // The item list lives on the sale; read it (the store holds one page only).
  useEffect(() => {
    setSale(null);
    if (!saleId) return;
    let alive = true;
    void api<BackendSale | null>('sales.get', { id: saleId })
      .then((row) => {
        if (alive && row) setSale(toSaleRecord(row));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [saleId]);

  if (!shipment) return null;
  const slip = <Slip shipment={shipment} sale={sale} />;

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="Delivery slip"
        subtitle={shipment.refNo}
        width={paper === 'A4' ? 'max-w-3xl' : 'max-w-md'}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="size-4" /> Print
            </Button>
          </div>
        }
      >
        <div className="bg-muted py-6 flex justify-center">
          <div className="bg-white text-black shadow" style={{ colorScheme: 'light' }}>
            {slip}
          </div>
        </div>
      </Modal>
      <PrintSheet paper={paper}>{slip}</PrintSheet>
    </>
  );
}

function Slip({ shipment: s, sale }: { shipment: Shipment; sale: SaleRecord | null }) {
  const business = useSettings((st) => st.business);
  return (
    <div className="print-doc p-4 text-xs leading-snug w-[340px] max-w-full">
      <div className="text-center">
        <div className="text-base font-bold">{business.name}</div>
        {business.address && <div>{business.address}</div>}
        {business.phonePrimary && <div>{business.phonePrimary}</div>}
        <div className="mt-2 font-semibold border-y border-black py-1">Delivery slip</div>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        <dt>Ref</dt>
        <dd className="font-semibold">{s.refNo}</dd>
        <dt>Invoice</dt>
        <dd>{s.saleInvoiceNo}</dd>
        <dt>Date</dt>
        <dd>{formatDateTime(s.createdAt)}</dd>
        {s.targetDate && (
          <>
            <dt>Deliver by</dt>
            <dd>{formatDate(parseRangeBound(s.targetDate, 'from'))}</dd>
          </>
        )}
        <dt>Customer</dt>
        <dd className="font-semibold">{s.customerName}</dd>
        <dt>Address</dt>
        <dd className="whitespace-pre-line">{s.address || '—'}</dd>
        {(s.driver || s.vehicleNo) && (
          <>
            <dt>Driver</dt>
            <dd>{[s.driver, s.vehicleNo].filter(Boolean).join(' · ')}</dd>
          </>
        )}
        {s.trackingNo && (
          <>
            <dt>Tracking no</dt>
            <dd>{s.trackingNo}</dd>
          </>
        )}
        <dt>Status</dt>
        <dd>{labelFor('shipmentStatus', s.status)}</dd>
      </dl>
      <table className="mt-3 w-full border-t border-black">
        <thead>
          <tr className="border-b border-black">
            <th className="text-left py-1 font-semibold">Item</th>
            <th className="text-right py-1 font-semibold">Qty</th>
          </tr>
        </thead>
        <tbody>
          {sale ? (
            sale.lines.map((l, i) => (
              <tr key={i} className="border-b border-dashed border-black/40">
                <td className="py-1 pr-2">{l.name}</td>
                <td className="py-1 text-right whitespace-nowrap">
                  {l.qty} {l.unit}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={2} className="py-2 text-center">
                Loading…
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {s.notes && <div className="mt-2 whitespace-pre-line">{s.notes}</div>}
      <div className="mt-10 grid grid-cols-2 gap-6 text-center">
        <div className="border-t border-black pt-1">Received by</div>
        <div className="border-t border-black pt-1">Delivered by</div>
      </div>
    </div>
  );
}
