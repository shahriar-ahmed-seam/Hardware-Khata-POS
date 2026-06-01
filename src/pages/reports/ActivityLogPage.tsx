import { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Edit2,
  XCircle,
  CreditCard,
  RotateCcw,
  Truck,
  LogIn,
  LogOut,
  Lock,
  Unlock,
  ArrowLeftRight,
  Sliders,
  Trash2,
  Upload,
  Activity as ActivityIcon,
} from 'lucide-react';
import {
  ReportToolbar,
  DEFAULT_RANGE,
  isInRange,
  type DateRange,
} from '@/components/reports/ReportToolbar';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useActivity, type ActivityAction, type ActivityEntity } from '@/stores/activity';
import { useUsers } from '@/stores/users';
import { useBranches } from '@/stores/branches';
import { useReport } from '@/hooks/useReport';
import { hasBackend } from '@/lib/api';
import { formatBDT, relativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

const ACTION_META: Record<
  ActivityAction,
  { icon: any; tone: 'primary' | 'info' | 'success' | 'warning' | 'destructive' | 'default' }
> = {
  created: { icon: Plus, tone: 'primary' },
  edited: { icon: Edit2, tone: 'default' },
  voided: { icon: XCircle, tone: 'destructive' },
  paid: { icon: CreditCard, tone: 'success' },
  returned: { icon: RotateCcw, tone: 'warning' },
  shipped: { icon: Truck, tone: 'info' },
  opened: { icon: Unlock, tone: 'primary' },
  closed: { icon: Lock, tone: 'default' },
  transferred: { icon: ArrowLeftRight, tone: 'info' },
  adjusted: { icon: Sliders, tone: 'warning' },
  login: { icon: LogIn, tone: 'default' },
  logout: { icon: LogOut, tone: 'default' },
  deleted: { icon: Trash2, tone: 'destructive' },
  imported: { icon: Upload, tone: 'info' },
};

const ENTITY_LABELS: Record<ActivityEntity, string> = {
  sale: 'Sale',
  purchase: 'Purchase',
  return: 'Return',
  shipment: 'Shipment',
  product: 'Product',
  customer: 'Customer',
  supplier: 'Supplier',
  expense: 'Expense',
  shift: 'Shift',
  transfer: 'Transfer',
  adjustment: 'Adjustment',
  user: 'User',
  settings: 'Settings',
};

const TONE_CLASS: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  info: 'bg-accent/10 text-accent',
  default: 'bg-secondary text-muted-foreground',
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const KNOWN_ACTIONS = Object.keys(ACTION_META) as ActivityAction[];
const KNOWN_ENTITIES = Object.keys(ENTITY_LABELS) as ActivityEntity[];
function normalizeAction(a: string): ActivityAction {
  return (KNOWN_ACTIONS as string[]).includes(a) ? (a as ActivityAction) : 'edited';
}
function normalizeEntity(e: string): ActivityEntity {
  return (KNOWN_ENTITIES as string[]).includes(e) ? (e as ActivityEntity) : 'settings';
}

/** A `dashboard.activityFeed` row (activity_log, snake_case). */
interface BackendActivity {
  id: string;
  at: string;
  by_user: string | null;
  branch_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  entity_ref: string | null;
  message: string | null;
  amount: number | null;
}

interface EventRow {
  id: string;
  at: string;
  by: string;
  action: ActivityAction;
  entity: ActivityEntity;
  entityId?: string;
  entityRef?: string;
  message: string;
  amount?: number;
  branch?: string;
}

export default function ActivityLogPage() {
  const events = useActivity((s) => s.events);
  const users = useUsers((s) => s.users);
  const branches = useBranches((s) => s.items);

  const [range, setRange] = useState<DateRange>({ preset: 'thisWeek' });
  const [branch, setBranch] = useState('');
  const [q, setQ] = useState('');
  const [user, setUser] = useState('');
  const [action, setAction] = useState<ActivityAction | ''>('');
  const [entity, setEntity] = useState<ActivityEntity | ''>('');

  // Backend wiring: `dashboard.activityFeed` returns the latest activity_log
  // rows. DEFERRED: the feed is limit-capped (500) with NO server-side
  // range/user/entity filters yet, so very large histories beyond the cap won't
  // appear. ALL filtering (range/user/action/entity/search) + day-grouping
  // below stays CLIENT-SIDE over the fetched set, identical to the mock path.
  const { data: beActivity, loading, backend, error } = useReport<BackendActivity[]>(
    'dashboard.activityFeed',
    hasBackend() ? { limit: 500 } : null,
    [],
  );

  const branchNameById = useMemo(
    () => new Map(branches.map((b) => [b.id, b.name])),
    [branches],
  );

  // Normalize the source set (backend rows mapped to the page shape, else store)
  // before the existing client-side filtering runs.
  const sourceEvents: EventRow[] = useMemo(() => {
    // On a real backend error, do NOT fall back to the mock store — show empty.
    if (backend && error) return [];
    if (backend && beActivity) {
      return beActivity.map((r) => ({
        id: r.id,
        at: r.at,
        by: r.by_user ?? '',
        action: normalizeAction(r.action),
        entity: normalizeEntity(r.entity),
        entityId: r.entity_id ?? undefined,
        entityRef: r.entity_ref ?? undefined,
        message: r.message ?? '',
        amount: r.amount ?? undefined,
        branch: r.branch_id ? (branchNameById.get(r.branch_id) ?? r.branch_id) : undefined,
      }));
    }
    return events;
  }, [backend, beActivity, events, branchNameById, error]);

  const filtered = useMemo(() => {
    return sourceEvents.filter((e) => {
      if (!isInRange(e.at, range)) return false;
      if (branch && e.branch !== branch) return false;
      if (user && e.by !== user) return false;
      if (action && e.action !== action) return false;
      if (entity && e.entity !== entity) return false;
      if (q) {
        const t = q.toLowerCase();
        if (!`${e.message} ${e.entityRef ?? ''} ${e.by}`.toLowerCase().includes(t)) return false;
      }
      return true;
    });
  }, [sourceEvents, range, branch, user, action, entity, q]);

  // Group by day for nicer reading
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const ev of filtered) {
      const key = new Date(ev.at).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div>
      <ReportToolbar
        title="Activity Log"
        subtitle={`${filtered.length} events in range`}
        range={range}
        onRangeChange={setRange}
        branch={branch}
        onBranchChange={setBranch}
        filters={
          <>
            <select
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as ActivityAction | '')}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="">All actions</option>
              {(Object.keys(ACTION_META) as ActivityAction[]).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select
              value={entity}
              onChange={(e) => setEntity(e.target.value as ActivityEntity | '')}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="">All entities</option>
              {(Object.keys(ENTITY_LABELS) as ActivityEntity[]).map((e) => (
                <option key={e} value={e}>
                  {ENTITY_LABELS[e]}
                </option>
              ))}
            </select>
          </>
        }
      />

      <div className="p-6 max-w-4xl space-y-4">
        <Card className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search message, ref, user…"
              className="pl-9"
            />
          </div>
        </Card>

        {grouped.length === 0 && (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            <ActivityIcon className="size-6 mx-auto mb-2 opacity-50" />
            {backend && loading ? 'Loading…' : backend && error ? 'Couldn’t load — backend error. Check connection and retry.' : 'No activity matches your filters.'}
          </Card>
        )}

        {grouped.map(([day, items]) => (
          <section key={day}>
            <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em] mb-2 px-1">
              {day} <span className="text-muted-foreground/60">· {items.length}</span>
            </div>
            <Card className="overflow-hidden">
              {items.map((e, idx) => {
                const meta = ACTION_META[e.action];
                const Icon = meta.icon;
                return (
                  <div
                    key={e.id}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 hover:bg-secondary/30 transition',
                      idx !== items.length - 1 && 'border-b border-border',
                    )}
                  >
                    <div
                      className={cn(
                        'size-9 rounded-md grid place-items-center shrink-0',
                        TONE_CLASS[meta.tone],
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{e.by}</span>
                        <span className="text-sm text-muted-foreground">{e.action}</span>
                        <Badge variant="default">{ENTITY_LABELS[e.entity]}</Badge>
                        {e.entityRef && (
                          <span className="text-[11px] font-mono text-muted-foreground bg-secondary px-1.5 rounded">
                            {e.entityRef}
                          </span>
                        )}
                        {e.amount !== undefined && (
                          <span
                            className={cn(
                              'text-[11px] font-semibold tabular',
                              e.amount < 0 ? 'text-destructive' : 'text-success',
                            )}
                          >
                            {e.amount < 0 ? '−' : ''}
                            {formatBDT(Math.abs(e.amount))}
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-muted-foreground mt-0.5">{e.message}</div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span className="tabular">{relativeTime(e.at)}</span>
                        {e.branch && <span>· {e.branch}</span>}
                      </div>
                    </div>
                    <div className="size-7 rounded-full bg-secondary text-muted-foreground grid place-items-center text-[10px] font-bold shrink-0">
                      {initials(e.by)}
                    </div>
                  </div>
                );
              })}
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}
