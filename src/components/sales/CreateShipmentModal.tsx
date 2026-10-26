import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { DateField } from '@/components/ui/DateTimeField';
import { localDateInputPlusDays } from '@/lib/datetime';
import { Truck } from 'lucide-react';
import {
  useSales,
  type Shipment,
  nextShipmentNo,
  type ShipmentStatus,
  type SaleRecord,
} from '@/stores/sales';
import { useCustomers } from '@/stores/contacts';
import { api } from '@/lib/api';
import { toast } from '@/stores/toast';
import { toSaleRecord, type BackendSale } from '@/hooks/saleAdapter';
import { toCustomer, type BackendCustomer } from '@/hooks/contactAdapter';
import type { Customer } from '@/types/domain';


interface Props {
  open: boolean;
  onClose: () => void;
  saleId: string | null;
}

export function CreateShipmentModal({ open, onClose, saleId }: Props) {
  const sales = useSales((s) => s.sales);
  const addShipment = useSales((s) => s.addShipment);
  const customers = useCustomers((s) => s.items);

  // Both stores hold ONE PAGE of rows. This modal normally opens from a row on
  // the sales page, but the sale can also come from a search result or the sale
  // detail drawer, and the customer (whose address pre-fills the delivery
  // address) is very unlikely to be on the customers page at all. So prefer the
  // store rows and fall back to single-record reads.
  const storeSale = sales.find((s) => s.id === saleId) ?? null;
  const hasStoreSale = !!storeSale;
  const [fetchedSale, setFetchedSale] = useState<SaleRecord | null>(null);

  useEffect(() => {
    if (!open || !saleId || hasStoreSale) {
      setFetchedSale(null);
      return;
    }
    let alive = true;
    void api<BackendSale | null>('sales.get', { id: saleId })
      .then((row) => {
        if (alive && row) setFetchedSale(toSaleRecord(row));
      })
      .catch(() => {
        // Channel error or running outside Electron — leave the modal empty.
      });
    return () => {
      alive = false;
    };
  }, [open, saleId, hasStoreSale]);

  const sale = storeSale ?? fetchedSale ?? undefined;

  const storeCustomer = sale ? customers.find((c) => c.id === sale.customerId) : undefined;
  const customerId = sale?.customerId;
  const hasStoreCustomer = !!storeCustomer;
  const [fetchedCustomer, setFetchedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    if (!open || !customerId || hasStoreCustomer) {
      setFetchedCustomer(null);
      return;
    }
    let alive = true;
    void api<BackendCustomer | null>('customers.get', { id: customerId })
      .then((row) => {
        if (alive && row) setFetchedCustomer(toCustomer(row));
      })
      .catch(() => {
        // No address autofill available — the field stays editable.
      });
    return () => {
      alive = false;
    };
  }, [open, customerId, hasStoreCustomer]);

  const customer = storeCustomer ?? fetchedCustomer ?? undefined;

  const [driver, setDriver] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [tracking, setTracking] = useState('');
  // A new delivery is always Pending (the status select invited mistakes).
  const status: ShipmentStatus = 'pending';
  const [courierOpen, setCourierOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [target, setTarget] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setDriver('');
      setVehicle('');
      setTracking('');
      setCourierOpen(false);
      setAddress(customer?.address ?? '');
      // Tomorrow on the shop's clock (a UTC slice names the wrong day in UTC+6).
      setTarget(localDateInputPlusDays(1));
      setNotes('');
    }
    // Only on open/close: the customer may resolve later (see the address
    // autofill below), and re-running this then would wipe whatever the user has
    // already typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The customer can arrive after the modal opened (single-record fallback), so
  // fill the delivery address then — but never over something already typed.
  useEffect(() => {
    if (!open || !customer?.address) return;
    setAddress((prev) => (prev ? prev : customer.address ?? ''));
  }, [open, customer]);

  // Above the early return (every hook runs on every render).
  const [saving, setSaving] = useState(false);

  if (!sale) return null;

  // Closes only once the backend has saved it; a refusal keeps what was typed.
  const submit = async () => {
    if (saving) return;
    const s: Shipment = {
      id: 'shp_' + Date.now(),
      refNo: nextShipmentNo(),
      saleId: sale.id,
      saleInvoiceNo: sale.invoiceNo,
      customerName: sale.customerName,
      driver: driver || undefined,
      vehicleNo: vehicle || undefined,
      trackingNo: tracking || undefined,
      status,
      address,
      targetDate: target || undefined,
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
    };
    setSaving(true);
    const ok = await addShipment(s);
    setSaving(false);
    if (!ok) return;
    toast.success('Shipment saved');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title="Deliver goods"
      subtitle={`${sale.customerName} · ${sale.invoiceNo}`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            <Truck className="size-4" /> Save delivery
          </Button>
        </div>
      }
    >
      {/* Address first: it is what the shop must get right. A new delivery is
          always Pending; the status is changed on the Shipments list. */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Delivery address" required className="md:col-span-2">
          {(f) => (
            <textarea
              {...f}
              autoFocus
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
            />
          )}
        </FormField>
        <FormField label="Target delivery date">
          {(f) => <DateField {...f} value={target} onChange={setTarget} />}
        </FormField>
        <div className="hidden md:block" />
        <FormField label="Driver / courier name">
          {(f) => <Input {...f} value={driver} onChange={(e) => setDriver(e.target.value)} placeholder="Karim" />}
        </FormField>
        <FormField label="Vehicle no">
          {(f) => (
            <Input {...f} value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="DH 11-3344" />
          )}
        </FormField>
        {courierOpen || tracking ? (
          <FormField label="Tracking no (courier)">
            {(f) => (
              <Input {...f} value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="optional" />
            )}
          </FormField>
        ) : (
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={() => setCourierOpen(true)}
              className="text-sm text-primary hover:underline"
            >
              Sent by courier? Add a tracking number
            </button>
          </div>
        )}
        <FormField label="Notes" className="md:col-span-2">
          {(f) => (
            <textarea
              {...f}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Items breakdown, handling notes…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
            />
          )}
        </FormField>
      </div>
    </Modal>
  );
}
