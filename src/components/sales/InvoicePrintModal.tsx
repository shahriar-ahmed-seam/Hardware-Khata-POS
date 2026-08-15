import { useEffect, useState } from 'react';
import { Printer, FileDown } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PrintSheet } from '@/components/ui/PrintSheet';
import { usePaperWidth } from '@/hooks/usePaperWidth';
import { Receipt } from '@/components/pos/Receipt';
import { api } from '@/lib/api';
import { toast } from '@/stores/toast';
import { toCustomer, type BackendCustomer } from '@/hooks/contactAdapter';
import type { SaleRecord } from '@/stores/sales';
import type { ParkedCart } from '@/components/pos/types';
import type { PaymentResult } from '@/components/pos/PaymentModal';
import type { Customer } from '@/types/domain';

/**
 * PRINT / RE-PRINT AN INVOICE THAT ALREADY EXISTS.
 *
 * Print and Save-as-PDF only existed on the popup that appears immediately after
 * a POS sale. On the Sales list and in the sale drawer, Print and Re-print were
 * rendered with NO onClick at all: they looked live and did nothing, which is
 * worse than not having them, because the cashier has already told the customer
 * their copy is coming.
 *
 * The reason they were never wired is a shape mismatch. `Receipt` draws a
 * `ParkedCart` (the POS cart shape) while a stored sale is a `SaleRecord`.
 * `saleToCart` below is that adapter, and it is deliberately the only one: a
 * second receipt layout for old invoices would drift from the one customers are
 * already holding.
 *
 * A re-print is the SAME document, not a re-creation. The stored invoice number,
 * the stored line prices, the stored discounts and the sale's own date are used,
 * so nothing on the paper differs from the original.
 */

/** Adapt a stored sale into the cart shape `Receipt` renders. */
export function saleToCart(sale: SaleRecord): ParkedCart {
  return {
    id: sale.id,
    label: sale.invoiceNo,
    customerId: sale.customerId,
    priceGroup: 'retail',
    lines: sale.lines.map((l) => ({
      productId: l.productId,
      name: l.name,
      sku: l.sku,
      qty: l.qty,
      unit: l.unit,
      availableUnits: [l.unit],
      // The stored unit price IS the price charged. Markup is 0 so
      // `unitPrice(line)` returns it untouched: folding a markup in here would
      // reprint a different number from the one the customer paid.
      basePrice: l.unitPrice,
      markupPct: 0,
      discountPct: l.discountPct,
      discountFlat: l.discountFlat,
      taxPct: l.taxPct,
    })),
    orderDiscountPct: sale.orderDiscountPct ?? 0,
    orderDiscountFlat: sale.orderDiscountFlat ?? 0,
    orderTaxPct: sale.taxPct ?? 0,
    shippingCharge: sale.shipping ?? 0,
    otherCharge: sale.other ?? 0,
  };
}

/** Adapt the sale's recorded payments into the receipt's payment summary. */
export function saleToPayment(sale: SaleRecord): PaymentResult {
  return {
    payments: sale.payments.map((p, i) => ({
      id: p.id ?? `pay_${i}`,
      method: p.method as PaymentResult['payments'][number]['method'],
      amount: p.amount,
      reference: p.reference,
    })),
    totalPaid: sale.paid,
    // Change is a counter-moment figure and is not stored on the sale, so it is
    // never invented here.
    change: 0,
    due: sale.due,
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  sale: SaleRecord | null;
  /**
   * Resolved customer, so the reprint names them and shows their balance. When
   * omitted it is read from the backend: callers on a list screen only have the
   * customer's NAME, and printing "Walk-in" on a named customer's invoice would
   * be wrong.
   */
  customer?: Customer;
}

export function InvoicePrintModal({ open, onClose, sale, customer }: Props) {
  const paper = usePaperWidth();
  const [savingPdf, setSavingPdf] = useState(false);
  const [fetched, setFetched] = useState<Customer | null>(null);

  const needsCustomer = open && !customer && !!sale?.customerId;
  const wantedId = sale?.customerId ?? '';

  useEffect(() => {
    if (!needsCustomer) {
      setFetched(null);
      return;
    }
    let alive = true;
    void api<BackendCustomer | null>('customers.get', { id: wantedId })
      .then((row) => {
        if (alive && row) setFetched(toCustomer(row));
      })
      .catch(() => {
        // No backend, or an unknown id. The receipt prints the walk-in label
        // rather than a name it cannot stand behind.
      });
    return () => {
      alive = false;
    };
  }, [needsCustomer, wantedId]);

  if (!open || !sale) return null;

  const resolvedCustomer =
    customer ?? (fetched?.id === sale.customerId ? fetched : undefined);
  const cart = saleToCart(sale);
  const payment = saleToPayment(sale);

  /**
   * Save as PDF. The main process renders whatever the print stylesheet shows,
   * which is the `PrintSheet` mounted below, so the PDF and the paper copy cannot
   * drift apart. See electron/invoicePdf.ts.
   */
  const savePdf = async () => {
    if (savingPdf) return;
    setSavingPdf(true);
    try {
      const res = await api<{
        ok?: false;
        error?: string;
        primary?: { path: string } | null;
        saved?: { path: string; kind: string }[];
        failed?: { dir: string; error: string }[];
      }>('invoice.savePdf', { invoiceNo: sale.invoiceNo });

      if (res.ok === false || !res.saved || res.saved.length === 0) {
        toast.error(res.error ?? 'Could not save the PDF');
        return;
      }
      const where = res.primary?.path ?? res.saved[0].path;
      toast.success('Invoice saved as PDF', {
        description:
          res.saved.length > 1 ? `${where} (+${res.saved.length - 1} backup copies)` : where,
      });
      if (res.failed && res.failed.length > 0) {
        toast.warning('Some backup copies could not be written', {
          description: res.failed.map((f) => f.dir).join(', '),
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the PDF');
    } finally {
      setSavingPdf(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        width="max-w-3xl"
        title="Invoice"
        subtitle={sale.invoiceNo}
        footer={
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              The original invoice, reprinted. Nothing about it changes.
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => void savePdf()} disabled={savingPdf}>
                <FileDown className="size-4" /> {savingPdf ? 'Saving...' : 'Save as PDF'}
              </Button>
              <Button onClick={() => window.print()}>
                <Printer className="size-4" /> Print
              </Button>
            </div>
          </div>
        }
      >
        <div className="bg-muted py-6">
          <Receipt
            invoiceNo={sale.invoiceNo}
            cart={cart}
            payment={payment}
            customer={resolvedCustomer}
            cashierName={sale.user}
            dateISO={sale.date}
          />
        </div>
      </Modal>

      {/* Invisible on screen. This is what the Print button actually sends to the
          printer, and what printToPDF captures. */}
      <PrintSheet paper={paper}>
        <Receipt
          invoiceNo={sale.invoiceNo}
          cart={cart}
          payment={payment}
          customer={resolvedCustomer}
          cashierName={sale.user}
          dateISO={sale.date}
        />
      </PrintSheet>
    </>
  );
}
