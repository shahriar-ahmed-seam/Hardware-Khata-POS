import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, ArrowRight, Inbox, Ban, CheckCircle2, ArrowLeftRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState } from '@/components/ui/EmptyState';
import { useUserNameOf } from '@/components/stock/hooks';
import { StockDocDrawer } from '@/components/stock/StockDocDrawer';
import { labelFor } from '@/lib/labels';
import { useDateFormat } from '@/lib/formatDate';
import { toast } from '@/stores/toast';
import { useStock, type StockTransfer, type TransferStatus } from '@/stores/stock';
import { useBranches } from '@/stores/branches';
import { confirm } from '@/stores/confirm';
import { Modal } from '@/components/ui/Modal';
import { NumberField } from '@/components/ui/NumberField';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { formatBDT, cn } from '@/lib/utils';

const STATUS_VARIANT: Record<TransferStatus, 'default' | 'warning' | 'success' | 'destructive'> = {
  pending: 'default',
  'in-transit': 'warning',
  received: 'success',
  cancelled: 'destructive',
};

type Filter = 'all' | TransferStatus | 'inbound';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'inbound', label: 'Coming here' },
  { value: 'pending', label: 'Pending' },
  { value: 'in-transit', label: 'In transit' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function StockTransfers() {
  const nav = useNavigate();
  const fmt = useDateFormat();
  const userName = useUserNameOf();
  const transfers = useStock((s) => s.transfers);
  const cancelTransfer = useStock((s) => s.cancelTransfer);
  const loading = useStock((s) => s.loading);
  const hydrate = useStock((s) => s.hydrate);

  // Mirror Purchases.tsx: hydrate from the backend on mount so the store is
  // populated when this page is the entry point.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<Filter>('all');
  const [receiveOpen, setReceiveOpen] = useState<StockTransfer | null>(null);
  const [viewing, setViewing] = useState<StockTransfer | null>(null);

  // Client-side paging: `transfers.list` is header-only and this list grows
  // slowly, so every row is already in memory — we slice the filtered set.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  /**
   * "Inbound" means "coming to the branch I am standing in", so it needs the
   * shop's real default branch. This was the literal string 'Mirpur Branch' — the
   * demo fixture's name — so on any real shop the Inbound tab matched nothing and
   * silently read as "no deliveries on the way".
   */
  const branches = useBranches((s) => s.items);
  const hydrateBranches = useBranches((s) => s.hydrate);
  useEffect(() => {
    void hydrateBranches();
  }, [hydrateBranches]);
  const currentBranch = useMemo(
    () => (branches.find((b) => b.isDefault) ?? branches[0])?.name ?? '',
    [branches],
  );

  const list = useMemo(() => {
    let arr = transfers;
    if (statusFilter === 'inbound') {
      // With no branch list loaded yet there is no honest answer, so show
      // nothing rather than every pending transfer regardless of destination.
      arr = currentBranch
        ? arr.filter(
            (t) =>
              t.toBranch === currentBranch &&
              (t.status === 'pending' || t.status === 'in-transit'),
          )
        : [];
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
  }, [transfers, statusFilter, q, currentBranch]);

  // Any filter change resets to page 1 — staying on page 5 of a narrower result
  // set would show an empty table.
  useEffect(() => {
    setPage(1);
  }, [q, statusFilter, pageSize]);

  // Clamp so a shrinking list can never leave the user past the last page.
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => list.slice((current - 1) * pageSize, current * pageSize),
    [list, current, pageSize],
  );

  // Owner decision #5: transfers need a second branch. With one branch the page
  // explains that; old transfers (if any) still show below.
  const multiBranch = branches.filter((b) => b.active !== false).length > 1;

  // (The count / unit-total stat row was removed: it repeated the pager and
  // summed pc + bag + kg into one number.)
  return (
    <div>
      <PageHeader
        title="Stock Transfers"
        subtitle="Move stock between branches"
        actions={
          multiBranch ? (
            <Button onClick={() => nav('/stock/transfers/new')}>
              <Plus className="size-4" /> New Transfer
            </Button>
          ) : undefined
        }
      />

      <div className="p-6 space-y-4">
        {!multiBranch && (
          <Card>
            <EmptyState
              compact
              icon={ArrowLeftRight}
              title="This shop has one branch."
              message="Transfers move stock between branches. Add a branch in Settings → Branches to use transfers."
              action={
                <Link to="/settings/branches">
                  <Button variant="outline">Open branch settings</Button>
                </Link>
              }
            />
          </Card>
        )}
        {(multiBranch || transfers.length > 0) && (
        <>

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
          <Segmented
            ariaLabel="Transfer status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={FILTERS}
          />
        </Card>

        <Card className="overflow-hidden">
          {loading && transfers.length === 0 ? (
            <div className="p-4">
              <SkeletonTable count={6} />
            </div>
          ) : (
          <>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Ref</th>
                <th className="text-left px-2 py-2.5 font-medium">Date</th>
                <th className="text-left px-2 py-2.5 font-medium">From</th>
                <th className="text-left px-2 py-2.5 font-medium">To</th>
                <th className="text-right px-2 py-2.5 font-medium">Items</th>
                <th className="text-right px-2 py-2.5 font-medium">Value</th>
                <th className="text-left px-2 py-2.5 font-medium">By</th>
                <th className="text-left px-2 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((t) => {
                const value = t.lines.reduce((s, l) => s + l.qty * l.unitCost, 0);

                const canReceive =
                  t.toBranch === currentBranch &&
                  (t.status === 'pending' || t.status === 'in-transit');
                return (
                  <tr
                    key={t.id}
                    onClick={() => setViewing(t)}
                    className="border-t border-border hover:bg-secondary/40 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono whitespace-nowrap">{t.refNo}</td>
                    <td className="px-2 py-3 text-muted-foreground whitespace-nowrap">
                      {fmt.date(t.date)}
                    </td>
                    <td className="px-2 py-2.5">{t.fromBranch}</td>
                    <td className="px-2 py-2.5">
                      <span className="inline-flex items-center gap-1">
                        <ArrowRight className="size-3 text-muted-foreground" />
                        {t.toBranch}
                      </span>
                    </td>
                    {/* Line count — summing qty across pc / bag / kg meant nothing. */}
                    <td className="px-2 py-2.5 text-right tabular whitespace-nowrap">
                      {t.lines.length} <span className="text-muted-foreground">items</span>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular">
                      {formatBDT(value, { withSymbol: false })}
                    </td>
                    <td className="px-2 py-2.5 text-muted-foreground">{userName(t.createdBy)}</td>
                    <td className="px-2 py-2.5">
                      <Badge variant={STATUS_VARIANT[t.status]}>{labelFor('transferStatus', t.status)}</Badge>
                    </td>
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {canReceive && (
                          <Button size="md" onClick={() => setReceiveOpen(t)}>
                            <Inbox className="size-4" /> Receive
                          </Button>
                        )}
                        {/* Row click opens the lines (read-only drawer). Anything not yet received can be called back: the goods
                            return to the sending branch. A received transfer is
                            reversed with a new transfer the other way. */}
                        {(t.status === 'pending' || t.status === 'in-transit') && (
                          <button
                            onClick={async () => {
                              if (
                                await confirm({
                                  title: 'Cancel this transfer?',
                                  message: 'The items go back into stock at the sending branch.',
                                  confirmLabel: 'Cancel transfer',
                                  cancelLabel: 'Keep it',
                                  variant: 'destructive',
                                })
                              )
                                cancelTransfer(t.id);
                            }}
                            className="h-10 px-3 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition focus-ring"
                          >
                            <Ban className="size-4" /> Cancel
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
          <Pagination
            page={current}
            pageSize={pageSize}
            total={list.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            label="transfers"
          />
          </>
          )}
        </Card>
        </>
        )}
      </div>

      {viewing && (
        <StockDocDrawer
          open
          onClose={() => setViewing(null)}
          title={`${viewing.fromBranch} → ${viewing.toBranch}`}
          subtitle={viewing.refNo}
          facts={[
            { label: 'Date', value: fmt.dateTime(viewing.date) },
            { label: 'Status', value: labelFor('transferStatus', viewing.status) },
            { label: 'By', value: userName(viewing.createdBy) },
            { label: 'Notes', value: viewing.notes },
            { label: 'Receive note', value: viewing.receiveNote },
          ]}
          lines={viewing.lines}
        />
      )}

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

  const [saving, setSaving] = useState(false);
  // Closes only once the backend has received it; a refusal keeps the counts.
  const submit = async () => {
    if (saving) return;
    setSaving(true);
    const ok = await receive(
      transfer.id,
      transfer.lines.map((l) => ({
        productId: l.productId,
        receivedQty: received[l.productId] ?? l.qty,
      })),
      note || undefined,
    );
    setSaving(false);
    if (!ok) return;
    toast.success('Transfer received');
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
      width="max-w-2xl"
      title="Receive stock"
      subtitle={`${transfer.fromBranch} → ${transfer.toBranch} · ${transfer.refNo}`}
      footer={
        <div className="flex items-center justify-between gap-3">
          {/* Only when counts differ — the Diff column already shows each line. */}
          <div className="text-sm">
            {variance !== 0 && (
              <>
                <span className={cn('tabular font-semibold', variance < 0 ? 'text-destructive' : 'text-warning')}>
                  {variance > 0 ? '+' : '−'}
                  {formatBDT(Math.abs(variance))}
                </span>{' '}
                <span className="text-muted-foreground">
                  Short or extra items are saved as a stock correction.
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={saving}>
              <CheckCircle2 className="size-4" /> Mark Received
            </Button>
          </div>
        </div>
      }
    >
      <form
        className="p-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-secondary/40">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Item</th>
                <th className="text-right px-2 py-2 font-medium">Sent</th>
                <th className="text-right px-2 py-2 font-medium">Received</th>
                <th className="text-right px-3 py-2 font-medium">Diff</th>
              </tr>
            </thead>
            <tbody>
              {transfer.lines.map((l, i) => {
                const cur = received[l.productId] ?? l.qty;
                const diff = cur - l.qty;
                return (
                  <tr key={l.productId} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="font-medium">{l.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{l.sku}</div>
                    </td>
                    <td className="px-2 py-2 text-right tabular">
                      {l.qty} {l.unit}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <NumberField
                          value={cur}
                          autoFocus={i === 0}
                          aria-label="Received"
                          onChangeNumber={(v) =>
                            setReceived((p) => ({ ...p, [l.productId]: Math.max(0, v) }))
                          }
                          className="h-10 w-28 px-2 text-right text-sm"
                        />
                        <span className="text-xs text-muted-foreground w-8 text-left">{l.unit}</span>
                      </div>
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right tabular',
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
          <label htmlFor="receive-note" className="block text-sm font-medium mb-1.5">
            Receive note
          </label>
          <textarea
            id="receive-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. 1 pc damaged in transit"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
          />
        </div>
        {/* Enter in a count submits. */}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
