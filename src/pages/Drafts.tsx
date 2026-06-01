import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, ArrowRightCircle, Eye } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useSales } from '@/stores/sales';
import { formatBDT } from '@/lib/utils';
import { hasBackend } from '@/lib/api';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { SaleDetail } from '@/components/sales/SaleDetail';

export default function Drafts() {
  const nav = useNavigate();
  const sales = useSales((s) => s.sales);
  const deleteSale = useSales((s) => s.deleteSale);
  const loading = useSales((s) => s.loading);
  const hydrate = useSales((s) => s.hydrate);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const backend = hasBackend();

  // Hydrate from the backend on mount so the store is populated when this page
  // is the entry point (mirrors Purchases.tsx). No-op outside Electron.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const list = useMemo(() => {
    const drafts = sales.filter((s) => s.status === 'draft');
    if (!q) return drafts;
    const t = q.toLowerCase();
    return drafts.filter((s) => `${s.invoiceNo} ${s.customerName}`.toLowerCase().includes(t));
  }, [sales, q]);

  return (
    <div>
      <PageHeader
        title="Drafts"
        subtitle={`${list.length} drafts saved`}
        actions={
          <Link to="/sales/new?status=draft">
            <Button>
              <Plus className="size-4" /> New Draft
            </Button>
          </Link>
        }
      />

      <div className="p-6 space-y-4">
        <Card className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search invoice / customer…"
              className="pl-9"
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          {backend && loading && sales.length === 0 ? (
            <div className="p-4">
              <SkeletonTable count={6} />
            </div>
          ) : (
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Reference</th>
                <th className="text-left px-2 py-2.5 font-medium">Customer</th>
                <th className="text-right px-2 py-2.5 font-medium">Items</th>
                <th className="text-right px-2 py-2.5 font-medium">Total</th>
                <th className="text-left px-2 py-2.5 font-medium">Saved</th>
                <th className="px-4 py-2.5 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id} className="border-t border-border hover:bg-secondary/40 group">
                  <td className="px-4 py-2.5 font-mono text-xs">{d.invoiceNo}</td>
                  <td className="px-2 py-2.5 font-medium">{d.customerName}</td>
                  <td className="px-2 py-2.5 text-right tabular">
                    {d.lines.reduce((s, l) => s + l.qty, 0)}
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono tabular font-semibold">
                    {formatBDT(d.total)}
                  </td>
                  <td className="px-2 py-2.5 text-xs text-muted-foreground">
                    {new Date(d.date).toLocaleString('en-GB')}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100">
                      <button
                        onClick={() => setOpenId(d.id)}
                        className="size-7 grid place-items-center rounded hover:bg-secondary"
                        title="View"
                      >
                        <Eye className="size-3.5" />
                      </button>
                      <button
                        onClick={() => nav(`/sales/${d.id}/edit`)}
                        className="size-7 grid place-items-center rounded hover:bg-secondary"
                        title="Convert to Sale"
                      >
                        <ArrowRightCircle className="size-3.5 text-primary" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete draft ${d.invoiceNo}?`)) deleteSale(d.id);
                        }}
                        className="size-7 grid place-items-center rounded hover:bg-destructive/10 hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No drafts saved.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          )}
        </Card>
      </div>

      <SaleDetail open={!!openId} onClose={() => setOpenId(null)} saleId={openId} />
    </div>
  );
}
