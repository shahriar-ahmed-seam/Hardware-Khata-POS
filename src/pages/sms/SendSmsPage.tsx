import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  User,
  Users,
  X,
  Search,
  ArrowLeft,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Link } from 'react-router-dom';
import {
  useSms,
  estimateParts,
  isUnicode,
  renderTemplate,
  TEMPLATE_VARIABLES,
} from '@/stores/sms';
import { useCustomers } from '@/stores/contacts';
import { useSettings } from '@/stores/settings';
import { confirm } from '@/stores/confirm';
import { toast } from '@/stores/toast';
import { formatBDT, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

type Mode = 'single' | 'group' | 'manual';

interface Recipient {
  id: string;
  name: string;
  phone: string;
}

export default function SendSmsPage() {
  const navigate = useNavigate();
  const customers = useCustomers((s) => s.items);
  const groups = useSms((s) => s.groups);
  const templates = useSms((s) => s.templates);
  const credit = useSms((s) => s.credit);
  const gateway = useSms((s) => s.gateway);
  const logSend = useSms((s) => s.logSend);
  const business = useSettings((s) => s.business);

  const [mode, setMode] = useState<Mode>('single');
  const [body, setBody] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [selectedCustomers, setSelectedCustomers] = useState<Recipient[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [manualNumbers, setManualNumbers] = useState('');
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const recipients: Recipient[] = useMemo(() => {
    if (mode === 'single') return selectedCustomers;
    if (mode === 'group') {
      const g = groups.find((x) => x.id === selectedGroupId);
      if (!g) return [];
      const list: Recipient[] = [];
      g.memberIds.forEach((id) => {
        const c = customers.find((x) => x.id === id);
        if (c) list.push({ id: c.id, name: c.name, phone: c.phone });
      });
      g.manualNumbers?.forEach((n, i) =>
        list.push({ id: `manual_${i}`, name: 'Manual', phone: n }),
      );
      return list;
    }
    return manualNumbers
      .split(/[\n,]/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p, i) => ({ id: 'm_' + i, name: 'Manual', phone: p }));
  }, [mode, selectedCustomers, selectedGroupId, manualNumbers, customers, groups]);

  const filteredCustomers = useMemo(() => {
    const t = search.toLowerCase();
    return customers
      .filter((c) =>
        !t ? true : `${c.name} ${c.phone}`.toLowerCase().includes(t),
      )
      .filter((c) => !selectedCustomers.find((s) => s.id === c.id))
      .slice(0, 10);
  }, [customers, search, selectedCustomers]);

  // Render preview using first recipient's data
  const sample = recipients[0];
  const ctx: Record<string, string> = useMemo(
    () => ({
      shop_name: business.name,
      customer_name: sample?.name ?? 'Customer',
      phone: sample?.phone ?? '01XXXXXXXXX',
      invoice_no: 'INV-2026-0451',
      amount: '4,520',
      due: '0',
      date: new Date().toLocaleDateString('en-GB'),
      branch: business.defaultBranch ?? 'Mirpur Branch',
      discount: '10',
    }),
    [business, sample],
  );

  const previewBody = useMemo(() => renderTemplate(body, ctx), [body, ctx]);
  const unicode = useMemo(() => isUnicode(previewBody), [previewBody]);
  const parts = useMemo(() => estimateParts(previewBody, unicode), [previewBody, unicode]);
  const charLimit = unicode ? (parts === 1 ? 70 : 67) : parts === 1 ? 160 : 153;

  const totalCost = recipients.length * parts * credit.smsRate;
  const insufficientCredit = totalCost > credit.balance;
  const tooManyParts = parts > gateway.maxPartsPerMessage;
  const canSend =
    body.trim() && recipients.length > 0 && !insufficientCredit && !tooManyParts;

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) setBody(t.body);
  };

  const insertVariable = (v: string) => {
    setBody((b) => b + (b.endsWith(' ') || b.length === 0 ? '' : ' ') + v);
  };

  const handleSend = () => {
    if (!canSend) return;
    void doSend();
  };

  const doSend = async () => {
    if (!gateway.connected) {
      const ok = await confirm({
        title: 'Gateway not connected',
        message:
          'Messages will be queued and shown as failed until you connect a provider. Continue anyway?',
        confirmLabel: 'Send anyway',
        variant: 'destructive',
      });
      if (!ok) return;
    }
    let queuedCount = 0;
    let sentCount = 0;
    recipients.forEach((r) => {
      const personalizedBody = renderTemplate(body, { ...ctx, customer_name: r.name, phone: r.phone });
      logSend({
        toName: r.name,
        toPhone: r.phone,
        body: personalizedBody,
        templateId: templateId || undefined,
        groupId: mode === 'group' ? selectedGroupId : undefined,
        status: gateway.connected ? 'delivered' : 'failed',
        cost: gateway.connected ? credit.smsRate * parts : 0,
        parts,
        by: 'Seam',
        errorReason: gateway.connected ? undefined : 'Gateway not configured',
      });
      if (gateway.connected) sentCount += 1;
      else queuedCount += 1;
    });
    if (gateway.connected) {
      toast.success(`${sentCount} message${sentCount === 1 ? '' : 's'} sent`, {
        description: 'Delivery status updates in History.',
      });
    } else {
      toast.warning(`${queuedCount} message${queuedCount === 1 ? '' : 's'} marked failed`, {
        description: 'Gateway is offline.',
      });
    }
    navigate('/sms/history');
  };

  return (
    <div>
      <PageHeader
        title="Send SMS"
        subtitle="Single, group, or template-based messages"
        actions={
          <Link to="/sms" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> SMS
          </Link>
        }
      />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 max-w-6xl">
        {/* LEFT: composer */}
        <div className="space-y-4">
          {/* Mode toggle */}
          <Card className="p-3">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em] mb-1.5">
              Send to
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { v: 'single', icon: User, label: 'Pick customers' },
                  { v: 'group', icon: Users, label: 'Group' },
                  { v: 'manual', icon: Plus, label: 'Manual numbers' },
                ] as const
              ).map(({ v, icon: Icon, label }) => (
                <button
                  key={v}
                  onClick={() => setMode(v)}
                  className={cn(
                    'h-12 rounded-md border flex items-center justify-center gap-2 text-sm font-medium transition',
                    mode === v
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-secondary',
                  )}
                >
                  <Icon className="size-4" /> {label}
                </button>
              ))}
            </div>
          </Card>

          {/* Recipient picker */}
          {mode === 'single' && (
            <Card className="p-4 space-y-3">
              <div className="text-sm font-semibold">Recipients ({selectedCustomers.length})</div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPickerOpen(true);
                  }}
                  onFocus={() => setPickerOpen(true)}
                  placeholder="Search customer name or phone…"
                  className="pl-9"
                />
                {pickerOpen && search && filteredCustomers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-10 rounded-md border border-border bg-card shadow-lg max-h-72 overflow-auto">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomers((s) => [
                            ...s,
                            { id: c.id, name: c.name, phone: c.phone },
                          ]);
                          setSearch('');
                          setPickerOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-secondary text-left"
                      >
                        <div className="size-7 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold">
                          {c.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{c.name}</div>
                          <div className="text-[11px] font-mono text-muted-foreground">{c.phone}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedCustomers.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedCustomers.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1.5 px-2 h-7 rounded-md bg-secondary text-sm"
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="text-[11px] font-mono text-muted-foreground">{c.phone}</span>
                      <button
                        onClick={() =>
                          setSelectedCustomers((s) => s.filter((x) => x.id !== c.id))
                        }
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </Card>
          )}

          {mode === 'group' && (
            <Card className="p-4 space-y-3">
              <div className="text-sm font-semibold">Group</div>
              {groups.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No groups yet.{' '}
                  <Link to="/sms/groups" className="underline text-primary">
                    Create one
                  </Link>
                  .
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGroupId(g.id)}
                      className={cn(
                        'rounded-md border p-3 text-left transition',
                        selectedGroupId === g.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-secondary',
                      )}
                    >
                      <div className="font-semibold text-sm">{g.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {g.memberIds.length + (g.manualNumbers?.length ?? 0)} members
                      </div>
                      {g.description && (
                        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {g.description}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </Card>
          )}

          {mode === 'manual' && (
            <Card className="p-4 space-y-2">
              <div className="text-sm font-semibold">Phone numbers</div>
              <textarea
                value={manualNumbers}
                onChange={(e) => setManualNumbers(e.target.value)}
                rows={4}
                placeholder="One per line, or comma-separated:&#10;01711-100001&#10;01711-100002, 01711-100003"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y font-mono"
              />
              <div className="text-[11px] text-muted-foreground">
                BD format: 11 digits starting with <span className="font-mono">01</span>. Hyphens
                and spaces are stripped automatically.
              </div>
            </Card>
          )}

          {/* Template + body */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Message</div>
              <select
                value={templateId}
                onChange={(e) => applyTemplate(e.target.value)}
                className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/50"
              >
                <option value="">Use a template…</option>
                {templates
                  .filter((t) => t.active)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.language === 'bn' ? '· bn' : ''}
                    </option>
                  ))}
              </select>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Type your message… use {variables} like {customer_name}"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
            />
            <div className="flex flex-wrap gap-1">
              <span className="text-[11px] text-muted-foreground">Insert:</span>
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v}
                  onClick={() => insertVariable(v)}
                  className="px-2 h-6 rounded border border-border hover:bg-secondary text-[11px] font-mono"
                >
                  {v}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* RIGHT: preview + summary */}
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Preview</div>
            <div className="rounded-md bg-muted p-3 min-h-[100px] text-sm whitespace-pre-wrap">
              {previewBody || (
                <span className="text-muted-foreground italic">
                  Your message will appear here.
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Chars" value={previewBody.length} hint={`/${charLimit} per part`} />
              <Stat label="Parts" value={parts} tone={tooManyParts ? 'destructive' : undefined} />
              <Stat label="Encoding" value={unicode ? 'Unicode' : 'GSM-7'} text />
            </div>
            {tooManyParts && (
              <div className="text-[11px] text-destructive flex items-start gap-1.5">
                <AlertCircle className="size-3 mt-0.5 shrink-0" />
                Exceeds gateway max parts ({gateway.maxPartsPerMessage}). Shorten the message.
              </div>
            )}
            {unicode && (
              <div className="text-[11px] text-muted-foreground">
                Bangla / Unicode characters detected — each part holds 70 chars instead of 160.
              </div>
            )}
          </Card>

          <Card className="p-4 space-y-2">
            <div className="text-sm font-semibold">Send summary</div>
            <Row label="Recipients" value={`${formatNumber(recipients.length)}`} />
            <Row label="Per message" value={formatBDT(parts * credit.smsRate)} />
            <Row label="Total cost" value={formatBDT(totalCost)} bold />
            <Row label="After send" value={formatBDT(credit.balance - totalCost)} />
            {insufficientCredit && (
              <div className="text-[11px] text-destructive flex items-start gap-1.5">
                <AlertCircle className="size-3 mt-0.5 shrink-0" />
                Not enough credit.{' '}
                <Link to="/sms/buy" className="underline">
                  Buy more
                </Link>
                .
              </div>
            )}
            {!gateway.connected && (
              <div className="text-[11px] text-warning flex items-start gap-1.5">
                <AlertCircle className="size-3 mt-0.5 shrink-0" />
                Gateway not connected. Messages will be marked failed.
              </div>
            )}
          </Card>

          <Button
            className="w-full"
            size="lg"
            disabled={!canSend}
            onClick={handleSend}
          >
            <Send className="size-4" /> Send {recipients.length > 0 ? `to ${recipients.length}` : ''}
          </Button>
          {recipients.length > 1 && (
            <Badge variant="info" className="w-full justify-center py-1">
              Group / bulk send · variables personalized per recipient
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('tabular', bold && 'font-bold')}>{value}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  text,
  tone,
}: {
  label: string;
  value: number | string;
  hint?: string;
  text?: boolean;
  tone?: 'destructive';
}) {
  return (
    <div
      className={cn(
        'rounded-md border border-border p-2',
        tone === 'destructive' && 'border-destructive/40 bg-destructive/5',
      )}
    >
      <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
        {label}
      </div>
      <div
        className={cn(
          'tabular font-bold',
          text ? 'text-sm' : 'text-base',
          tone === 'destructive' && 'text-destructive',
        )}
      >
        {value}
      </div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
