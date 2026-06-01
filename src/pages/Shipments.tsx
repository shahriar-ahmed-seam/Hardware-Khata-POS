import { useEffect, useMemo, useState } from 'react';
import { Search, Truck, Printer, Eye } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useSales, type ShipmentStatus } from '@/stores/sales';
import { cn } from '@/lib/utils';

const STATUS_VARIANT: Record<ShipmentStatus, 'default' | 'info' | 'success' | 'destructive'> = {
  pending: 'default',
  'in-transit': 'info',
  delivered: 'success',
  failed: 'destructive',
};

export default function Shipments() {
  const shipments = useSales((s) => s.shipments);
  const updateShipment = useSales((s) => s.updateShipment);
  const hydrate = useSales((s) => s.hydrate);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | ShipmentStatus>('all');

  // Hydrate from the backend on mount so the shipments table populates the list
  // when this page is the entry point (mirrors Sales.tsx). No-op outside Electron.
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

  return (
    <div>
      <PageHeader
        title="Shipments"
        subtitle={`${shipments.length} shipments`}
      />

      <div className="p-6 space-y-4">
        <Card className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ref / invoice / customer…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-xs">
            {(['all', 'pending', 'in-transit', 'delivered', 'failed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  'px-3 py-1 rounded capitalize font-medium transition',
                  filter === s
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {s.replace('-', ' ')}
              </button>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Ref</th>
                <th className="text-left px-2 py-2.5 font-medium">Invoice</th>
                <th className="text-left px-2 py-2.5 font-medium">Customer</th>
                <th className="text-left px-2 py-2.5 font-medium">Driver / Vehicle</th>
                <th className="text-left px-2 py-2.5 font-medium">Address</th>
                <th className="text-left px-2 py-2.5 font-medium">Target</th>
                <th className="text-left px-2 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-secondary/40 group">
                  <td className="px-4 py-2.5 font-mono text-xs">{s.refNo}</td>
                  <td className="px-2 py-2.5 font-mono text-xs">{s.saleInvoiceNo}</td>
                  <td className="px-2 py-2.5 font-medium">{s.customerName}</td>
                  <td className="px-2 py-2.5 text-xs">
                    {s.driver ?? '—'}
                    {s.vehicleNo && (
                      <span className="text-muted-foreground"> · {s.vehicleNo}</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-xs text-muted-foreground truncate max-w-[180px]">
                    {s.address}
                  </td>
                  <td className="px-2 py-2.5 text-xs text-muted-foreground">
                    {s.targetDate ? new Date(s.targetDate).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td className="px-2 py-2.5">
                    <select
                      value={s.status}
                      onChange={(e) => updateShipment(s.id, { status: e.target.value as ShipmentStatus })}
                      className="h-7 px-2 rounded-md border border-input bg-background text-[11px] outline-none capitalize"
                    >
                      {(['pending', 'in-transit', 'delivered', 'failed'] as ShipmentStatus[]).map((st) => (
                        <option key={st} value={st}>
                          {st.replace('-', ' ')}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1 inline-block">
                      <Badge variant={STATUS_VARIANT[s.status]}>{s.status.replace('-', ' ')}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100">
                      <button
                        className="size-7 grid place-items-center rounded hover:bg-secondary"
                        title="Print delivery slip"
                      >
                        <Printer className="size-3.5" />
                      </button>
                      <button
                        className="size-7 grid place-items-center rounded hover:bg-secondary"
                        title="View"
                      >
                        <Eye className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No shipments.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

void Truck;
