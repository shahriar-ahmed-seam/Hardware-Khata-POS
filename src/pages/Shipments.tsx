import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Truck, Printer } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Segmented } from '@/components/ui/Segmented';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { SaleDetail } from '@/components/sales/SaleDetail';
import { DeliverySlipModal } from '@/components/sales/DeliverySlipModal';
import { useSales, type Shipment, type ShipmentStatus } from '@/stores/sales';
import { confirm } from '@/stores/confirm';
import { toast } from '@/stores/toast';
import { labelFor } from '@/lib/labels';
import { useDateFormat } from '@/lib/formatDate';
import { parseRangeBound } from '@/lib/datetime';
import { cn } from '@/lib/utils';

const STATUSES: ShipmentStatus[] = ['pending', 'in-transit', 'delivered', 'failed'];

/** The status select is the badge: its border and text carry the status colour. */
const STATUS_TONE: Record<ShipmentStatus, string> = {
  pending: 'border-border text-foreground',
  'in-transit': 'border-primary/60 text-primary',
  delivered: 'border-success/60 text-success',
  failed: 'border-destructive/60 text-destructive',
};

/** Past its target day (local end of day) and still not done. */
function isOverdue(s: Shipment): boolean {
  if (!s.targetDate || s.status === 'delivered' || s.status === 'failed') return false;
  return parseRangeBound(s.targetDate, 'to').getTime() < Date.now();
}

export default function Shipments() {
  const nav = useNavigate();
  const fmt = useDateFormat();
  const shipments = useSales((s) => s.shipments);
  const updateShipment = useSales((s) => s.updateShipment);
  const hydrate = useSales((s) => s.hydrate);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | ShipmentStatus>('all');
  const [saleOpen, setSaleOpen] = useState<string | null>(null);
  const [slipFor, setSlipFor] = useState<Shipment | null>(null);

  // Client-side paging: `shipments.list` is header-only and grows slowly.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Hydrate on mount so the list fills when this page is the entry point.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const list = useMemo(() => {
    let arr = shipments;
    if (filter !== 'all') arr = arr.filter((s) => s.status === filter);
    if (q) {
      const t = q.toLowerCase();
      arr = arr.filter((s) =>
        `${s.refNo} ${s.saleInvoiceNo} ${s.customerName}`.toLowerCase().includes(t),
      );
    }
    return arr;
  }, [shipments, q, filter]);

  useEffect(() => {
    setPage(1);
  }, [q, filter, pageSize]);

  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => list.slice((current - 1) * pageSize, current * pageSize),
    [list, current, pageSize],
  );

  /** Writes at once (was silent); "Not delivered" is final, so it asks first. */
  const changeStatus = async (s: Shipment, next: ShipmentStatus) => {
    if (next === s.status) return;
    if (
      next === 'failed' &&
      !(await confirm({ title: 'Mark this delivery as not delivered?', message: s.refNo }))
    )
      return;
    if (await updateShipment(s.id, { status: next }))
      toast.success(labelFor('shipmentStatus', next), { description: s.refNo });
  };

  return (
    <div>
      <PageHeader title="Shipments" />

      <div className="p-6 space-y-4">
        {shipments.length === 0 ? (
          <Card>
            <EmptyState
              icon={Truck}
              title="No deliveries yet"
              message="Open a sale and choose Ship to arrange a delivery."
              action={
                <Button variant="outline" onClick={() => nav('/sales')}>
                  Go to sales
                </Button>
              }
            />
          </Card>
        ) : (
          <>
            <Card className="p-3 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search ref / invoice / customer…"
                  aria-label="Search ref / invoice / customer…"
                  className="pl-9"
                />
              </div>
              <Segmented
                ariaLabel="Delivery status"
                value={filter}
                onChange={setFilter}
                options={(['all', ...STATUSES] as const).map((s) => ({
                  value: s,
                  label: s === 'all' ? 'All' : labelFor('shipmentStatus', s),
                }))}
              />
            </Card>

            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground bg-secondary/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Ref</th>
                    <th className="text-left px-2 py-2.5 font-medium">Customer</th>
                    <th className="text-left px-2 py-2.5 font-medium">Driver / Vehicle</th>
                    <th className="text-left px-2 py-2.5 font-medium">Address</th>
                    <th className="text-left px-2 py-2.5 font-medium">Target</th>
                    <th className="text-left px-2 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((s) => {
                    const overdue = isOverdue(s);
                    return (
                      // The row opens the sale behind the delivery.
                      <tr
                        key={s.id}
                        className="border-t border-border hover:bg-secondary/40 cursor-pointer"
                        onClick={() => setSaleOpen(s.saleId)}
                      >
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div>{s.refNo}</div>
                          <div className="text-xs text-muted-foreground">{s.saleInvoiceNo}</div>
                        </td>
                        <td className="px-2 py-2 font-medium">{s.customerName}</td>
                        <td className="px-2 py-2">
                          {s.driver ?? '—'}
                          {s.vehicleNo && <span className="text-muted-foreground"> · {s.vehicleNo}</span>}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground truncate max-w-[200px]" title={s.address}>
                          {s.address}
                        </td>
                        <td
                          className={cn(
                            'px-2 py-2 whitespace-nowrap',
                            overdue ? 'text-destructive font-medium' : 'text-muted-foreground',
                          )}
                        >
                          {s.targetDate ? fmt.date(parseRangeBound(s.targetDate, 'from')) : '—'}
                          {overdue && <div className="text-xs">Overdue</div>}
                        </td>
                        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <Select
                            aria-label="Delivery status"
                            value={s.status}
                            onChange={(e) => void changeStatus(s, e.target.value as ShipmentStatus)}
                            className={cn('h-9 w-auto font-medium', STATUS_TONE[s.status])}
                          >
                            {STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {labelFor('shipmentStatus', st)}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end">
                            <IconButton size="sm" label="Print delivery slip" onClick={() => setSlipFor(s)}>
                              <Printer className="size-4" />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {list.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                        No matches.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {list.length > 0 && (
                <Pagination
                  page={current}
                  pageSize={pageSize}
                  total={list.length}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  label="shipments"
                />
              )}
            </Card>
          </>
        )}
      </div>

      {/* No return/ship handlers here: SaleDetail hides those actions. */}
      <SaleDetail open={!!saleOpen} onClose={() => setSaleOpen(null)} saleId={saleOpen} />
      <DeliverySlipModal shipment={slipFor} onClose={() => setSlipFor(null)} />
    </div>
  );
}
