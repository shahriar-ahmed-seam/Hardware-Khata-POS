import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, ArrowRight, Truck, Inbox, Ban, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useStock, type StockTransfer, type TransferStatus } from '@/stores/stock';
import { Modal } from '@/components/ui/Modal';
import { NumberField } from '@/components/ui/NumberField';
import { hasBackend } from '@/lib/api';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { formatBDT, cn } from '@/lib/utils';

const STATUS_VARIANT: Record<TransferStatus, 'default' | 'info' | 'success' | 'destructive'> = {
  pending: 'default',
  'in-transit': 'info',
  received: 'success',
  cancelled: 'destructive',
};

export default function StockTransfers() {
  const nav = useNavigate();
  const transfers = useStock((s) => s.transfers);
  const cancelTransfer = useStock((s) => s.cancelTransfer);
  const loading = useStock((s) => s.loading);
  const hydrate = useStock((s) => s.hydrate);
  const backend = hasBackend();

  // Mirror Purchases.tsx: hydrate from the backend on mount so the store is
  // populated when this page is the entry point. No-op without backend.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TransferStatus | 'inbound'>('all');
  const [receiveOpen, setReceiveOpen] = useState<StockTransfer | null>(null);

  const currentBranch = 'Mirpur Branch';

  const list = useMemo(() => {
    let arr = transfers;
    if (statusFilter === 'inbound') {
      arr = arr.filter(
        (t) => t.toBranch === currentBranch && (t.status === 'pending' || t.status === 'in-transit'),
      );
    } else if (statusFilter !== 'all') {
      arr = arr.filter((t) => t.status === statusFilter);
    }
    if (q) {
      const t = q.toLowerCase();
      arr = arr.filter((x) =>
        `${x.refNo} ${x.fromBranch} ${x.toBranch}`.toLowerCase().includes(t),
      );
    }
    return arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transfers, statusFilter, q]);

  const totals = {
    count: list.length,
    units: list.reduce((s, t) => s + t.lines.reduce((u, l) => u + l.qty, 0), 0),
    value: list.reduce((s, t) => s + t.lines.reduce((u, l) => u + l.qty * l.unitCost, 0), 0),
  };

  return (
    <div>
      <PageHeader
        title="Stock Transfers"
        subtitle="Move stock between branches"
        actions={
          <Button onClick={() => nav('/stock/transfers/new')}>
            <Plus className="size-4" /> New Transfer
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Transfers" value={String(totals.count)} />
          <Stat label="Total Units" value={String(totals.units)} />
          <Stat label="Total Value" value={formatBDT(totals.value)} />
        </div>

        <Card className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ref / branch…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-xs">
            {(['all', 'inbound', 'pending', 'in-transit', 'received', 'cancelled'] as const).map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'px-3 py-1 rounded font-medium capitalize transition',
                    statusFilter === s
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {s.replace('-', ' ')}
                </button>
              ),
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          {backend && loading && transfers.length === 0 ? (
            <div className="p-4">
              <SkeletonTable count={6} />
            </div>
          ) : (
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Ref</th>
                <th className="text-left px-2 py-2.5 font-medium">Date</th>
                <th className="text-left px-2 py-2.5 font-medium">From</th>
                <th className="text-left px-2 py-2.5 font-medium">→ To</th>
                <th className="text-right px-2 py-2.5 font-medium">Items</th>
                <th className="text-right px-2 py-2.5 font-medium">Value</th>
                <th className="text-left px-2 py-2.5 font-medium">By</th>
                <th className="text-left px-2 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => {
                const value = t.lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
                const items = t.lines.reduce((s, l) => s + l.qty, 0);
                const canReceive =
                  t.toBranch === currentBranch &&
                  (t.status === 'pending' || t.status === 'in-transit');
                return (
                  <tr key={t.id} className="border-t border-border hover:bg-secondary/40 group">
                    <td className="px-4 py-2.5 font-mono text-xs">{t.refNo}</td>
                    <td className="px-2 py-2.5 text-xs text-muted-foreground">
                      {new Date(t.date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-2 py-2.5">{t.fromBranch}</td>
                    <td className="px-2 py-2.5">
                      <span className="inline-flex items-center gap-1">
                        <ArrowRight className="size-3 text-muted-foreground" />
                        {t.toBranch}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular">{items}</td>
                    <td className="px-2 py-2.5 text-right font-mono tabular">
                      {formatBDT(value, { withSymbol: false })}
                    </td>
                    <td className="px-2 py-2.5 text-xs text-muted-foreground">{t.createdBy}</td>
                    <td className="px-2 py-2.5">
                      <Badge variant={STATUS_VARIANT[t.status]}>{t.status.replace('-', ' ')}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100">
                        {canReceive && (
                          <Button size="sm" onClick={() => setReceiveOpen(t)}>
                            <Inbox className="size-3.5" /> Receive
                          </Button>
                        )}
                        <Link
                          to={`/stock/transfers/${t.id}`}
                          className="size-7 grid place-items-center rounded hover:bg-secondary"
                          title="View"
                        >
                          <Eye className="size-3.5" />
                        </Link>
                        {t.status === 'pending' && (
                          <button
                            onClick={() => {
                              if (confirm(`Cancel transfer ${t.refNo}?`)) cancelTransfer(t.id);
                            }}
                            className="size-7 grid place-items-center rounded hover:bg-destructive/10 hover:text-destructive"
                            title="Cancel"
                          >
                            <Ban className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No transfers match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          )}
        </Card>
      </div>

      {receiveOpen && (
        <ReceiveTransferModal
          open={!!receiveOpen}
          onClose={() => setReceiveOpen(null)}
          transfer={receiveOpen}
        />
      )}
    </div>
  );
}

function ReceiveTransferModal({
  open,
  onClose,
  transfer,
}: {
  open: boolean;
  onClose: () => void;
  transfer: StockTransfer;
}) {
  const receive = useStock((s) => s.receiveTransfer);
  const [received, setReceived] = useState<Record<string, number>>(() =>
    Object.fromEntries(transfer.lines.map((l) => [l.productId, l.qty])),
  );
  const [note, setNote] = useState('');

  const submit = () => {
    receive(
      transfer.id,
      transfer.lines.map((l) => ({
        productId: l.productId,
        receivedQty: received[l.productId] ?? l.qty,
      })),
      note || undefined,
    );
    onClose();
  };

  const variance = transfer.lines.reduce((s, l) => {
    const r = received[l.productId] ?? l.qty;
    return s + (r - l.qty) * l.unitCost;
  }, 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-3xl"
      title={`Receive Transfer — ${transfer.refNo}`}
      subtitle={`From ${transfer.fromBranch} → ${transfer.toBranch}`}
      footer={
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="text-muted-foreground">Variance: </span>
            <span
              className={cn(
                'font-mono tabular font-semibold',
                variance === 0 ? 'text-success' : variance < 0 ? 'text-destructive' : 'text-warning',
              )}
            >
              {variance >= 0 ? '+' : ''}
              {formatBDT(variance)}
            </span>
            <span className="text-muted-foreground ml-1">(creates auto-adjustment if not 0)</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit}>
              <CheckCircle2 className="size-4" /> Mark Received
            </Button>
          </div>
        </div>
      }
    >
      <div className="p-4 space-y-4">
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase text-muted-foreground bg-secondary/40">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Item</th>
                <th className="text-right px-2 py-2 font-medium">Sent</th>
                <th className="text-right px-2 py-2 font-medium">Received</th>
                <th className="text-right px-3 py-2 font-medium">Diff</th>
              </tr>
            </thead>
            <tbody>
              {transfer.lines.map((l) => {
                const cur = received[l.productId] ?? l.qty;
                const diff = cur - l.qty;
                return (
                  <tr key={l.productId} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="font-medium">{l.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{l.sku}</div>
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular">
                      {l.qty} {l.unit}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <NumberField
                        value={cur}
                        onChangeNumber={(v) =>
                          setReceived((p) => ({ ...p, [l.productId]: Math.max(0, v) }))
                        }
                        className="h-8 w-24 px-2 text-right text-xs ml-auto"
                      />
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-mono tabular',
                        diff === 0
                          ? 'text-muted-foreground'
                          : diff < 0
                            ? 'text-destructive'
                            : 'text-warning',
                      )}
                    >
                      {diff >= 0 ? '+' : ''}
                      {diff}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">
            Receive note
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. 1 pc damaged in transit"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
          />
        </div>
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-bold mt-0.5 tabular">{value}</div>
    </Card>
  );
}

void Truck;
