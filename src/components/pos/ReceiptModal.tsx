import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PrintSheet } from '@/components/ui/PrintSheet';
import { usePaperWidth } from '@/hooks/usePaperWidth';
import { Receipt } from './Receipt';
import { Printer, Plus, FileDown } from 'lucide-react';
import { api } from '@/lib/api';
import { printSheet, sheetToHtml } from '@/lib/printing';
import { toast } from '@/stores/toast';
import type { ParkedCart } from './types';
import type { PaymentResult } from './PaymentModal';
import type { Customer } from '@/types/domain';

interface Props {
  open: boolean;
  onClose: () => void;
  invoiceNo: string;
  cart: ParkedCart;
  payment: PaymentResult;
  /** Resolved customer from the backend customers list so the printed receipt
   *  names them correctly. Omitted → the receipt prints the walk-in label. */
  customer?: Customer;
  /** Signed-in user, printed as "Served by" when that setting is on. */
  cashierName?: string;
  onNewSale: () => void;
  /**
   * Print as soon as it opens ("Auto-print receipt on save", Settings → POS).
   * The POS passes it only straight after a sale, never for a re-print.
   */
  autoPrint?: boolean;
}

export function ReceiptModal({
  open,
  onClose,
  invoiceNo,
  cart,
  payment,
  customer,
  cashierName,
  onNewSale,
  autoPrint = false,
}: Props) {
  // Layout width follows the printer configured in Settings → Printers.
  const paper = usePaperWidth();
  const [savingPdf, setSavingPdf] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  // A network printer's cash drawer opens with the FIRST print of a cash sale
  // only — re-printing a slip must not be a way to open the till.
  const drawerOpenedFor = useRef<string | null>(null);

  /**
   * Print on the default printer from Settings → Printers, silently. With no
   * printer set up (or in the browser preview) this is the print dialog, as
   * before. See src/lib/printing.ts.
   */
  const print = async () => {
    if (printing) return;
    setPrinting(true);
    try {
      const paidCash = payment.payments.some((p) => p.method === 'Cash' && p.amount > 0);
      const openDrawer = paidCash && drawerOpenedFor.current !== invoiceNo;
      drawerOpenedFor.current = invoiceNo;
      await printSheet(sheetRef.current, { kind: 'receipt', openDrawer });
    } finally {
      setPrinting(false);
    }
  };
  const printRef = useRef(print);
  printRef.current = print;

  // Once per invoice, after the print sheet below is on the page.
  const printedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!open || !autoPrint || printedFor.current === invoiceNo) return;
    const t = setTimeout(() => {
      printedFor.current = invoiceNo;
      void printRef.current();
    }, 250);
    return () => clearTimeout(t);
  }, [open, autoPrint, invoiceNo]);

  /**
   * Save the invoice as a PDF.
   *
   * The main process renders it with `printToPDF`, which applies the same print
   * stylesheet the Print button uses — so the PDF is the same black-on-white
   * receipt, not a second layout that could drift. It is written to the owner's
   * PDF folder, next to the database, AND into the backup folder (cloud-synced
   * if they pointed it at OneDrive/Drive/Dropbox). See electron/invoicePdf.ts.
   */
  const savePdf = async () => {
    if (savingPdf) return;
    setSavingPdf(true);
    try {
      const res = await api<{
        ok?: false;
        error?: string;
        fileName?: string;
        primary?: { path: string } | null;
        saved?: { path: string; kind: string }[];
        failed?: { dir: string; error: string }[];
      }>('invoice.savePdf', {
        invoiceNo,
        // Rendered in a hidden window from this sheet (R75), not from whatever
        // the app window shows.
        html: sheetRef.current ? sheetToHtml(sheetRef.current, 210) : undefined,
      });

      if (res.ok === false || !res.saved || res.saved.length === 0) {
        toast.error(res.error ?? 'Could not save the PDF');
        return;
      }
      // Say exactly where it went, and how many protected copies exist.
      const where = res.primary?.path ?? res.saved[0].path;
      toast.success('Invoice saved as PDF', {
        description:
          res.saved.length > 1
            ? `${where} (+${res.saved.length - 1} backup copies)`
            : where,
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
        title="Receipt Preview"
        subtitle={invoiceNo}
        footer={
          <div className="flex items-center justify-end">
            {/* "Re-print Last" used to sit here and did nothing — this IS the
                last receipt. Print prints it; the POS ⋯ menu (Ctrl+P) brings
                the last one back once this is closed (B4). */}
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => void print()} disabled={printing}>
                <Printer className="size-4" /> {printing ? 'Printing…' : 'Print'}
              </Button>
              <Button variant="outline" onClick={() => void savePdf()} disabled={savingPdf}>
                <FileDown className="size-4" /> {savingPdf ? 'Saving…' : 'Save as PDF'}
              </Button>
              <Button onClick={onNewSale}>
                <Plus className="size-4" /> New Sale
              </Button>
            </div>
          </div>
        }
      >
        <div className="bg-muted py-6">
          <Receipt
            invoiceNo={invoiceNo}
            cart={cart}
            payment={payment}
            customer={customer}
            cashierName={cashierName}
          />
        </div>
      </Modal>

      {/* Invisible on screen; this is what the Print button actually sends to
          the printer. Same props as the preview above. */}
      {open && (
        <PrintSheet paper={paper} sheetRef={sheetRef}>
          <Receipt
            invoiceNo={invoiceNo}
            cart={cart}
            payment={payment}
            customer={customer}
            cashierName={cashierName}
          />
        </PrintSheet>
      )}
    </>
  );
}
