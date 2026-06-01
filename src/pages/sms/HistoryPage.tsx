import { useMemo, useState } from 'react';
import {
  Search,
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  History as HistoryIcon,
  Eye,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useSms, type SmsLogEntry, type SmsStatus } from '@/stores/sms';
import { confirm } from '@/stores/confirm';
import { toast } from '@/stores/toast';
import { formatBDT, formatNumber, relativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

const STATUS_META: Record<
  SmsStatus,
  { label: string; icon: any; tone: 'success' | 'warning' | 'destructive' | 'default' }
> = {
  delivered: { label: 'Delivered', icon: CheckCircle2, tone: 'success' },
  sent: { label: 'Sent', icon: CheckCircle2, tone: 'default' },
  queued: { label: 'Queued', icon: Clock, tone: 'warning' },
  failed: { label: 'Failed', icon: XCircle, tone: 'destructive' },
};

export default function HistoryPage() {
  const history = useSms((s) => s.history);
  const retrySend = useSms((s) => s.retrySend);
  const clearHistory = useSms((s) => s.clearHistory);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<SmsStatus | ''>('');
  const [view, setView] = useState<SmsLogEntry | null>(null);

  const filtered = useMemo(() => {
    return history.filter((h) => {
      if (status && h.status !== status) return false;
      if (q) {
        const t = q.toLowerCase();
        if (
          !`${h.toName ?? ''} ${h.toPhone} ${h.body} ${h.by}`.toLowerCase().includes(t)
        )
          return false;
      }
      return true;
    });
  }, [history, q, status]);

  const counts = useMemo(() => {
    const c: Record<SmsStatus, number> = { delivered: 0, sent: 0, queued: 0, failed: 0 };
    history.forEach((h) => c[h.status]++);
    return c;
  }, [history]);

  const totalCost = filtered.reduce((a, h) => a + h.cost, 0);

  return (
    <div>
      <PageHeader
        title="SMS History"
        subtitle={`${formatNumber(history.length)} messages · ${formatBDT(totalCost)} spent (filtered)`}
        actions={
          <>
            <Link
              to="/sms"
              className="inline-flex items-center gap-1 px-2 h-9 rounded-md hover:bg-secondary text-sm text-muted-foreground"
            >
              <ArrowLeft className="size-4" /> SMS
            </Link>
            {history.length > 0 && (
              <Button
                variant="outline"
                onClick={async () => {
                  if (
                    await confirm({
                      title: 'Clear all SMS history?',
                      message: 'This permanently removes all logged messages.',
                      variant: 'destructive',
                      confirmLabel: 'Clear all',
                    })
                  ) {
                    clearHistory();
                    toast.success('History cleared');
                  }
                }}
              >
                Clear all
              </Button>
            )}
          </>
        }
      />

      <div className="p-6 max-w-6xl space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Delivered" value={counts.delivered} tone="success" />
          <Kpi label="Sent" value={counts.sent} />
          <Kpi label="Queued" value={counts.queued} tone="warning" />
          <Kpi label="Failed" value={counts.failed} tone="destructive" />
        </div>

        <Card className="p-3 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone, message…"
              className="pl-9"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SmsStatus | '')}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="">All status</option>
            <option value="delivered">Delivered</option>
            <option value="sent">Sent</option>
            <option value="queued">Queued</option>
            <option value="failed">Failed</option>
          </select>
        </Card>

        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1.2fr_1.4fr_2fr_0.8fr_0.6fr_0.8fr_0.7fr] gap-2 px-4 py-2.5 border-b border-border bg-secondary/40 text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
            <div>When</div>
            <div>Recipient</div>
            <div>Message</div>
            <div>Status</div>
            <div className="text-right">Parts</div>
            <div className="text-right">Cost</div>
            <div className="text-right">Action</div>
          </div>
          {filtered.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              <HistoryIcon className="size-6 mx-auto mb-2 opacity-50" />
              No messages match.
            </div>
          )}
          {filtered.map((h) => {
            const meta = STATUS_META[h.status];
            const StatusIcon = meta.icon;
            return (
              <div
                key={h.id}
                className="grid grid-cols-[1.2fr_1.4fr_2fr_0.8fr_0.6fr_0.8fr_0.7fr] gap-2 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-secondary/30 text-sm"
              >
                <div>
                  <div className="text-muted-foreground tabular text-xs">
                    {relativeTime(h.sentAt)}
                  </div>
                  <div className="text-[11px] text-muted-foreground/60">
                    {new Date(h.sentAt).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <div className="min-w-0">
                  {h.toName && <div className="font-medium truncate">{h.toName}</div>}
                  <div className="text-[11px] font-mono text-muted-foreground">{h.toPhone}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs truncate text-muted-foreground" title={h.body}>
                    {h.body}
                  </div>
                  {h.errorReason && (
                    <div className="text-[11px] text-destructive mt-0.5 truncate">
                      {h.errorReason}
                    </div>
                  )}
                </div>
                <div>
                  <Badge variant={meta.tone}>
                    <StatusIcon className="size-3" /> {meta.label}
                  </Badge>
                </div>
                <div className="tabular text-right">{h.parts}</div>
                <div className="tabular text-right">{formatBDT(h.cost)}</div>
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => setView(h)}
                    className="size-7 grid place-items-center rounded hover:bg-secondary text-muted-foreground"
                    title="View"
                  >
                    <Eye className="size-3.5" />
                  </button>
                  {h.status === 'failed' && (
                    <button
                      onClick={() => {
                        retrySend(h.id);
                        toast.success('Message resent');
                      }}
                      className="size-7 grid place-items-center rounded hover:bg-primary/10 text-primary"
                      title="Retry"
                    >
                      <RotateCcw className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      <Modal
        open={!!view}
        onClose={() => setView(null)}
        title="Message details"
        width="max-w-lg"
      >
        {view && (
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={STATUS_META[view.status].tone}>{STATUS_META[view.status].label}</Badge>
              <Badge variant="default">{view.parts} part{view.parts === 1 ? '' : 's'}</Badge>
              <Badge variant="default">{formatBDT(view.cost)}</Badge>
            </div>
            <Row label="To" value={`${view.toName ?? '—'} · ${view.toPhone}`} />
            <Row label="Sent" value={new Date(view.sentAt).toLocaleString('en-GB')} />
            <Row label="By" value={view.by} />
            {view.errorReason && (
              <Row label="Error" value={view.errorReason} tone="destructive" />
            )}
            <div>
              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em] mb-1">
                Message
              </div>
              <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">
                {view.body}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'success' | 'warning' | 'destructive';
}) {
  return (
    <Card className="p-4">
      <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
        {label}
      </div>
      <div
        className={cn(
          'tabular font-bold text-lg mt-1',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'destructive' && 'text-destructive',
        )}
      >
        {formatNumber(value)}
      </div>
    </Card>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'destructive';
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground text-[10px] uppercase tracking-[0.06em]">
        {label}
      </span>
      <span className={cn('truncate', tone === 'destructive' && 'text-destructive')}>{value}</span>
    </div>
  );
}
