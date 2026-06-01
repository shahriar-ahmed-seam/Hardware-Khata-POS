import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Receipt } from './Receipt';
import { Printer, Plus, RotateCcw } from 'lucide-react';
import type { ParkedCart } from './types';
import type { PaymentResult } from './PaymentModal';
import type { Customer } from '@/mocks/data';

interface Props {
  open: boolean;
  onClose: () => void;
  invoiceNo: string;
  cart: ParkedCart;
  payment: PaymentResult;
  /** Resolved customer (backend or mock) so the printed receipt names them correctly. */
  customer?: Customer;
  onNewSale: () => void;
  onReprint: () => void;
}

export function ReceiptModal({
  open,
  onClose,
  invoiceNo,
  cart,
  payment,
  customer,
  onNewSale,
  onReprint,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-3xl"
      title="Receipt Preview"
      subtitle={invoiceNo}
      footer={
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onReprint}>
            <RotateCcw className="size-4" /> Re-print Last
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" /> Print
            </Button>
            <Button onClick={onNewSale}>
              <Plus className="size-4" /> New Sale
            </Button>
          </div>
        </div>
      }
    >
      <div className="bg-muted py-6">
        <Receipt invoiceNo={invoiceNo} cart={cart} payment={payment} customer={customer} />
      </div>
    </Modal>
  );
}
