import { Link } from 'react-router-dom';
import {
  Send,
  FileText,
  Users,
  History,
  Settings as SettingsIcon,
  ShoppingCart,
  AlertCircle,
  CheckCircle2,
  Wallet,
  TrendingUp,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useSms } from '@/stores/sms';
import { formatBDT, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Tile {
  to: string;
  icon: any;
  label: string;
  desc: string;
  tone: 'primary' | 'info' | 'success' | 'warning';
}

const tiles: Tile[] = [
  { to: '/sms/send', icon: Send, label: 'Send SMS', desc: 'Single, group, or template-based send', tone: 'primary' },
  { to: '/sms/templates', icon: FileText, label: 'Templates', desc: 'Reusable messages with variables', tone: 'info' },
  { to: '/sms/groups', icon: Users, label: 'Groups', desc: 'Customer segments for blast messaging', tone: 'info' },
  { to: '/sms/history', icon: History, label: 'History', desc: 'Sent, delivered, failed messages', tone: 'success' },
  { to: '/sms/gateway', icon: SettingsIcon, label: 'Gateway', desc: 'BD provider setup, sender ID, test', tone: 'warning' },
  { to: '/sms/buy', icon: ShoppingCart, label: 'Buy SMS', desc: 'Top up credit balance', tone: 'primary' },
];

const tones: Record<Tile['tone'], string> = {
  primary: 'bg-primary/10 text-primary',
  info: 'bg-accent/10 text-accent',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
};

export default function SMS() {
  const credit = useSms((s) => s.credit);
  const gateway = useSms((s) => s.gateway);
  const history = useSms((s) => s.history);
  const templates = useSms((s) => s.templates);
  const groups = useSms((s) => s.groups);

  const sentCount = history.filter((h) => h.status !== 'failed' && h.status !== 'queued').length;
  const failedCount = history.filter((h) => h.status === 'failed').length;
  const last7Days = history.filter(
    (h) => Date.now() - new Date(h.sentAt).getTime() <= 7 * 86400000,
  ).length;
  const remainingMessages = Math.floor(credit.balance / credit.smsRate);

  return (
    <div>
      <PageHeader
        title="SMS"
        subtitle="Send messages, manage templates, and track delivery"
        actions={
          <>
            {gateway.connected ? (
              <Badge variant="success">
                <CheckCircle2 className="size-3" /> Gateway connected
              </Badge>
            ) : (
              <Badge variant="warning">
                <AlertCircle className="size-3" /> Not connected
              </Badge>
            )}
            <Link to="/sms/send">
              <Button>
                <Send className="size-4" /> Send SMS
              </Button>
            </Link>
          </>
        }
      />

      <div className="p-6 space-y-6 max-w-6xl">
        {/* Credit + KPI strip */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card className="p-4 border-l-4 border-primary">
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-primary" />
              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                Credit balance
              </div>
            </div>
            <div className="tabular font-bold text-xl mt-1.5 text-primary">
              {formatBDT(credit.balance)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              ≈ {formatNumber(remainingMessages)} messages
            </div>
          </Card>
          <Card className="p-4 border-l-4 border-success">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success" />
              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                Messages sent
              </div>
            </div>
            <div className="tabular font-bold text-xl mt-1.5">{formatNumber(sentCount)}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">all-time</div>
          </Card>
          <Card className="p-4 border-l-4 border-warning">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-warning" />
              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                Last 7 days
              </div>
            </div>
            <div className="tabular font-bold text-xl mt-1.5">{formatNumber(last7Days)}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {formatBDT(last7Days * credit.smsRate)} estimated cost
            </div>
          </Card>
          <Card
            className={cn(
              'p-4 border-l-4',
              failedCount > 0 ? 'border-destructive' : 'border-border',
            )}
          >
            <div className="flex items-center gap-2">
              <AlertCircle
                className={cn(
                  'size-4',
                  failedCount > 0 ? 'text-destructive' : 'text-muted-foreground',
                )}
              />
              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                Failed
              </div>
            </div>
            <div
              className={cn(
                'tabular font-bold text-xl mt-1.5',
                failedCount > 0 ? 'text-destructive' : '',
              )}
            >
              {formatNumber(failedCount)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {failedCount > 0 ? (
                <Link to="/sms/history" className="underline">
                  Review history
                </Link>
              ) : (
                'all delivered'
              )}
            </div>
          </Card>
        </div>

        {/* Tiles */}
        <section>
          <h2 className="text-[11px] uppercase font-semibold text-muted-foreground tracking-[0.06em] mb-2">
            Sections
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {tiles.map((it) => {
              const Icon = it.icon;
              const count =
                it.to === '/sms/templates'
                  ? templates.length
                  : it.to === '/sms/groups'
                    ? groups.length
                    : it.to === '/sms/history'
                      ? history.length
                      : undefined;
              return (
                <Link key={it.to} to={it.to}>
                  <Card className="p-4 hover:shadow-md hover:border-primary transition cursor-pointer h-full">
                    <div className="flex items-start gap-3">
                      <div className={cn('size-10 rounded-lg grid place-items-center', tones[it.tone])}>
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{it.label}</span>
                          {count !== undefined && (
                            <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 rounded">
                              {count}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{it.desc}</div>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Gateway hint */}
        {!gateway.connected && (
          <Card className="p-4 bg-warning/10 border-warning/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="size-5 text-warning mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">Gateway not configured</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  You can compose and queue messages, but they won't actually send until you
                  connect a BD SMS provider (SSL Wireless, BulkSMSBD, Zaman IT, etc.) in Gateway
                  settings.
                </div>
              </div>
              <Link to="/sms/gateway">
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
