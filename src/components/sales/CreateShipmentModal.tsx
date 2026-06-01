import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Truck } from 'lucide-react';
import { useSales, type Shipment, nextShipmentNo, type ShipmentStatus } from '@/stores/sales';
import { customers } from '@/mocks/data';

const STATUSES: ShipmentStatus[] = ['pending', 'in-transit', 'delivered', 'failed'];

interface Props {
  open: boolean;
  onClose: () => void;
  saleId: string | null;
}

export function CreateShipmentModal({ open, onClose, saleId }: Props) {
  const sales = useSales((s) => s.sales);
  const addShipment = useSales((s) => s.addShipment);
  const sale = sales.find((s) => s.id === saleId);
  const customer = sale ? customers.find((c) => c.id === sale.customerId) : undefined;

  const [driver, setDriver] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [tracking, setTracking] = useState('');
  const [status, setStatus] = useState<ShipmentStatus>('pending');
  const [address, setAddress] = useState('');
  const [target, setTarget] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setDriver('');
      setVehicle('');
      setTracking('');
      setStatus('pending');
      setAddress(customer?.address ?? '');
      setTarget(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
      setNotes('');
    }
  }, [open, customer]);

  if (!sale) return null;

  const submit = () => {
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
    addShipment(s);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title={`Create Shipment — ${sale.invoiceNo}`}
      subtitle={`Customer: ${sale.customerName}`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>
            <Truck className="size-4" /> Save Shipment
          </Button>
        </div>
      }
    >
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Driver / courier name">
          <Input value={driver} onChange={(e) => setDriver(e.target.value)} placeholder="Karim" />
        </Field>
        <Field label="Vehicle no">
          <Input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="DH 11-3344" />
        </Field>
        <Field label="Tracking no (courier)">
          <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="optional" />
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ShipmentStatus)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 capitalize"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace('-', ' ')}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Delivery address" className="md:col-span-2">
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
          />
        </Field>
        <Field label="Target delivery date">
          <Input type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
        </Field>
        <Field label="Notes" className="md:col-span-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Items breakdown, handling notes…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
          />
        </Field>
      </div>
    </Modal>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="text-[10px] uppercase font-semibold text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
