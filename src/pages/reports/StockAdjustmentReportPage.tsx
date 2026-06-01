import { useMemo, useState } from 'react';
import { Sliders } from 'lucide-react';
import {
  ReportToolbar,
  DEFAULT_RANGE,
  isInRange,
  type DateRange,
} from '@/components/reports/ReportToolbar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useStock, type AdjustmentType } from '@/stores/stock';
import { useReport, useBranchId } from '@/hooks/useReport';
import { hasBackend } from '@/lib/api';
import { formatBDT, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

const TYPE_TONE: Record<AdjustmentType, string> = {
  damage: 'bg-destructive/10 text-destructive',
  theft: 'bg-destructive/10 text-destructive',
  sample: 'bg-blue-500/10 text-blue-600',
  recount: 'bg-warning/10 text-warning',
  other: 'bg-secondary text-muted-foreground',
};

const ADJ_TYPES: AdjustmentType[] = ['damage', 'theft', 'sample', 'recount', 'other'];
function normalizeType(t: string): AdjustmentType {
  return (ADJ_TYPES as string[]).includes(t) ? (t as AdjustmentType) : 'other';
}

/** Shape of one adjustment row mapped for the page. */
interface AdjRow {
  id: string;
  refNo: string;
  date: string;
  branch: string;
  type: AdjustmentType;
  createdBy: string;
  lines: { qty: number; unitCost: number }[];
}

/** A `adjustments.list` row (snake_case with nested lines). */
interface BackendAdjustment {
  id: string;
  ref_no: string;
  date: string;
  branch_id: string;
  type: string;
  created_by?: string | null;
  lines: { qty: number; unit_cost: number }[];
}

export default function StockAdjustmentReportPage() {
  const adjustments = useStock((s) => s.adjustments);
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [branch, setBranch] = useState('');
  const [type, setType] = useState<AdjustmentType | ''>('');

  // Backend wiring: `adjustments.list {}` returns all rows; the type + date-range
  // (isInRange) + branch filters stay client-side, matching the mock path.
  const branchId = useBranchId(branch);
  const { data: beAdjustments, loading, backend, error } = useReport<BackendAdjustment[]>(
    'adjustments.list',
    hasBackend() ? {} : null,
    [],
  );

  // Normalize the source (backend rows mapped to the page shape, else the store)
  // BEFORE applying the shared client-side filters below.
  const source: AdjRow[] = useMemo(() => {
    // On a real backend error, do NOT fall back to the mock store — show empty.
    if (backend && error) return [];
    if (backend && beAdjustments) {
      return beAdjustments.map((a) => ({
        id: a.id,
        refNo: a.ref_no,
        date: a.date,
        branch: a.branch_id,
        type: normalizeType(a.type),
        createdBy: a.created_by ?? '',
        lines: a.lines.map((l) => ({ qty: l.qty, unitCost: l.unit_cost })),
      }));
    }
    return adjustments.map((a) => ({
      id: a.id,
      refNo: a.refNo,
      date: a.date,
      branch: a.branch,
      type: a.type,
      createdBy: a.createdBy,
      lines: a.lines.map((l) => ({ qty: l.qty, unitCost: l.unitCost })),
    }));
  }, [backend, beAdjustments, adjustments, error]);

  const filtered = useMemo(() => {
    return source
      .filter((a) => isInRange(a.date, range))
      .filter((a) => !branch || a.branch === branch || a.branch === branchId)
      .filter((a) => !type || a.type === type)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [source, range, branch, branchId, type]);

  // Group totals by type
  const summary = useMemo(() => {
    const map = new Map<AdjustmentType, { count: number; netQty: number; netValue: number }>();
    for (const adj of filtered) {
      const e = map.get(adj.type) ?? { count: 0, netQty: 0, netValue: 0 };
      e.count += 1;
      adj.lines.forEach((l) => {
        e.netQty += l.qty;
        e.netValue += l.qty * l.unitCost;
      });
      map.set(adj.type, e);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const totals = useMemo(() => {
    let netQty = 0;
    let netValue = 0;
    let lossValue = 0;
    let foundValue = 0;
    filtered.forEach((adj) => {
      adj.lines.forEach((l) => {
        const v = l.qty * l.unitCost;
        netQty += l.qty;
        netValue += v;
        if (v < 0) lossValue += v;
        else foundValue += v;
      });
    });
    return { netQty, netValue, lossValue, foundValue };
  }, [filtered]);

  return (
    <div>
      <ReportToolbar
        title="Stock Adjustment Report"
        subtitle={`${formatNumber(filtered.length)} adjustments · net value ${formatBDT(totals.netValue)}`}
        range={range}
        onRangeChange={setRange}
        branch={branch}
        onBranchChange={setBranch}
        filters={
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AdjustmentType | '')}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="">All types</option>
            <option value="damage">Damage</option>
            <option value="theft">Theft</option>
            <option value="sample">Sample</option>
            <option value="recount">Recount</option>
            <option value="other">Other</option>
          </select>
        }
      />

      <div className="p-6 space-y-4 max-w-5xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Adjustments" value={formatNumber(filtered.length)} />
          <Kpi
            label="Loss value"
            value={formatBDT(Math.abs(totals.lossValue))}
            tone="destructive"
          />
          <Kpi label="Found value" value={formatBDT(totals.foundValue)} tone="success" />
          <Kpi
            label="Net value"
            value={formatBDT(totals.netValue)}
            tone={totals.netValue < 0 ? 'destructive' : 'success'}
          />
        </div>

        {/* By type breakdown */}
        {summary.length > 0 && (
          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">By type</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {summary.map(([t, data]) => (
                <div
                  key={t}
                  className={cn('rounded-md p-3 border border-border', TYPE_TONE[t])}
                >
                  <div className="text-[10px] uppercase font-semibold tracking-[0.06em] capitalize">
                    {t}
                  </div>
                  <div className="tabular font-bold mt-1">{formatBDT(data.netValue)}</div>
                  <div className="text-[10px] mt-0.5">
                    {data.count} adj · {formatNumber(data.netQty)} units
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1fr_1.2fr_0.8fr_0.6fr_0.8fr_1fr_1fr] gap-2 px-4 py-2.5 border-b border-border bg-secondary/40 text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
            <div>Date</div>
            <div>Ref</div>
            <div>Type</div>
            <div className="text-right">Lines</div>
            <div className="text-right">Net qty</div>
            <div className="text-right">Net value</div>
            <div>By</div>
          </div>
          {filtered.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              <Sliders className="size-6 mx-auto mb-2 opacity-50" />
              {backend && loading ? 'Loading…' : backend && error ? 'Couldn’t load — backend error. Check connection and retry.' : 'No adjustments in this range.'}
            </div>
          )}
          {filtered.map((adj) => {
            const netQty = adj.lines.reduce((a, l) => a + l.qty, 0);
            const netValue = adj.lines.reduce((a, l) => a + l.qty * l.unitCost, 0);
            return (
              <div
                key={adj.id}
                className="grid grid-cols-[1fr_1.2fr_0.8fr_0.6fr_0.8fr_1fr_1fr] gap-2 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-secondary/30 text-sm cursor-pointer"
              >
                <div className="text-muted-foreground tabular">
                  {new Date(adj.date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </div>
                <div className="font-mono text-xs">{adj.refNo}</div>
                <div>
                  <Badge className={TYPE_TONE[adj.type]}>{adj.type}</Badge>
                </div>
                <div className="tabular text-right">{adj.lines.length}</div>
                <div
                  className={cn(
                    'tabular text-right font-medium',
                    netQty < 0 ? 'text-destructive' : 'text-success',
                  )}
                >
                  {netQty > 0 ? '+' : ''}
                  {formatNumber(netQty)}
                </div>
                <div
                  className={cn(
                    'tabular text-right font-semibold',
                    netValue < 0 ? 'text-destructive' : 'text-success',
                  )}
                >
                  {formatBDT(netValue)}
                </div>
                <div className="text-muted-foreground truncate">{adj.createdBy}</div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'primary' | 'success' | 'warning' | 'destructive';
}) {
  return (
    <Card className="p-4">
      <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
        {label}
      </div>
      <div
        className={cn(
          'tabular font-bold text-lg mt-1',
          tone === 'primary' && 'text-primary',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'destructive' && 'text-destructive',
        )}
      >
        {value}
      </div>
    </Card>
  );
}
