import { useState } from 'react';
import {
  Save,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Send,
  Cloud,
  Eye,
  EyeOff,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { NumberField } from '@/components/ui/NumberField';
import { useSms, type GatewayProvider } from '@/stores/sms';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';

const PROVIDERS: {
  id: GatewayProvider;
  label: string;
  hint: string;
  apiUrlHint?: string;
}[] = [
  { id: 'none', label: 'None', hint: 'Mock mode — messages logged locally only' },
  { id: 'ssl-wireless', label: 'SSL Wireless', hint: 'sms.sslwireless.com' },
  { id: 'bulksmsbd', label: 'BulkSMSBD', hint: 'bulksmsbd.net' },
  { id: 'zaman-it', label: 'Zaman IT', hint: 'sms.zamanit.com' },
  { id: 'banglatrac', label: 'BanglaTrac', hint: 'panel.banglatrac.com' },
  {
    id: 'custom',
    label: 'Custom HTTP',
    hint: 'Bring-your-own provider',
    apiUrlHint: 'https://your-provider.com/api/send',
  },
];

export default function GatewayPage() {
  const gateway = useSms((s) => s.gateway);
  const setGateway = useSms((s) => s.setGateway);
  const test = useSms((s) => s.testGateway);

  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const provider = PROVIDERS.find((p) => p.id === gateway.provider);

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    const r = await test();
    setTesting(false);
    setTestResult(r);
  };

  return (
    <div>
      <PageHeader
        title="SMS Gateway"
        subtitle="Configure your BD SMS provider, sender ID, and test connection"
        actions={
          <>
            <Link
              to="/sms"
              className="inline-flex items-center gap-1 px-2 h-9 rounded-md hover:bg-secondary text-sm text-muted-foreground"
            >
              <ArrowLeft className="size-4" /> SMS
            </Link>
            <Button onClick={() => toast.success('Gateway settings saved')}>
              <Save className="size-4" /> Saved
            </Button>
          </>
        }
      />

      <div className="p-6 max-w-5xl grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* Provider picker */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Cloud className="size-4 text-muted-foreground" />
              <div className="text-sm font-semibold">Provider</div>
              {gateway.connected ? (
                <Badge variant="success">
                  <CheckCircle2 className="size-3" /> Connected
                </Badge>
              ) : (
                <Badge variant="default">Not connected</Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() =>
                    setGateway({ provider: p.id, connected: false, lastTestedAt: undefined })
                  }
                  className={cn(
                    'rounded-md border p-3 text-left transition',
                    gateway.provider === p.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-secondary',
                  )}
                >
                  <div className="font-semibold text-sm">{p.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{p.hint}</div>
                </button>
              ))}
            </div>
          </Card>

          {/* Credentials */}
          {gateway.provider !== 'none' && (
            <Card className="p-5 space-y-3">
              <div className="text-sm font-semibold">Credentials</div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                  API user / Username
                </label>
                <Input
                  value={gateway.apiUser ?? ''}
                  onChange={(e) => setGateway({ apiUser: e.target.value })}
                  placeholder="e.g. yourshop_api"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                  API key
                </label>
                <div className="relative">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={gateway.apiKey ?? ''}
                    onChange={(e) => setGateway({ apiKey: e.target.value })}
                    placeholder="••••••••••••"
                    className="pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 size-7 grid place-items-center rounded hover:bg-secondary text-muted-foreground"
                  >
                    {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Stored encrypted in OS keychain by backend (never plaintext on disk).
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                  Sender ID <span className="text-destructive">*</span>
                </label>
                <Input
                  value={gateway.senderId ?? ''}
                  onChange={(e) => setGateway({ senderId: e.target.value.toUpperCase() })}
                  placeholder="e.g. HARDWAREPOS"
                  className="font-mono"
                />
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Pre-approved alphabetic ID by your provider (BTRC requirement). Max 11 chars.
                </div>
              </div>
              {gateway.provider === 'custom' && (
                <div>
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                    API URL
                  </label>
                  <Input
                    value={gateway.apiUrl ?? ''}
                    onChange={(e) => setGateway({ apiUrl: e.target.value })}
                    placeholder={provider?.apiUrlHint ?? ''}
                    className="font-mono"
                  />
                </div>
              )}
            </Card>
          )}

          {/* Test */}
          {gateway.provider !== 'none' && (
            <Card className="p-5 space-y-3">
              <div className="text-sm font-semibold">Test connection</div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                  Test phone number
                </label>
                <Input
                  value={gateway.testPhoneNumber ?? ''}
                  onChange={(e) => setGateway({ testPhoneNumber: e.target.value })}
                  placeholder="01711-100001"
                  className="font-mono"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={runTest} disabled={testing}>
                  <Send className="size-4" />
                  {testing ? 'Testing…' : 'Send test SMS'}
                </Button>
                {gateway.lastTestedAt && (
                  <span className="text-[11px] text-muted-foreground">
                    Last tested {new Date(gateway.lastTestedAt).toLocaleString('en-GB')}
                  </span>
                )}
              </div>
              {testResult && (
                <div
                  className={cn(
                    'rounded-md p-3 text-sm flex items-start gap-2',
                    testResult.ok
                      ? 'bg-success/10 text-success border border-success/30'
                      : 'bg-destructive/10 text-destructive border border-destructive/30',
                  )}
                >
                  {testResult.ok ? (
                    <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="size-4 mt-0.5 shrink-0" />
                  )}
                  {testResult.message}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* RIGHT — defaults + automation */}
        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <div className="text-sm font-semibold">Sending defaults</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                  Default language
                </label>
                <select
                  value={gateway.defaultLanguage}
                  onChange={(e) =>
                    setGateway({ defaultLanguage: e.target.value as 'en' | 'bn' })
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                >
                  <option value="en">English</option>
                  <option value="bn">বাংলা</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                  Unicode mode
                </label>
                <select
                  value={gateway.unicodeMode}
                  onChange={(e) =>
                    setGateway({
                      unicodeMode: e.target.value as 'auto' | 'always' | 'never',
                    })
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                >
                  <option value="auto">Auto (recommended)</option>
                  <option value="always">Always Unicode</option>
                  <option value="never">Never (GSM-7 only)</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                  Max parts per message
                </label>
                <NumberField
                  value={gateway.maxPartsPerMessage}
                  onChangeNumber={(v) => setGateway({ maxPartsPerMessage: Math.max(1, v) })}
                />
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Block sends that would split into more than this many parts (cost guardrail).
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="size-4 text-warning" />
              <div className="text-sm font-semibold">Auto-send triggers</div>
            </div>
            <ToggleRow
              label="Send thank-you SMS on sale"
              desc="Uses the default 'Thank you (Sale)' template."
              checked={gateway.sendOnSale}
              onChange={(v) => setGateway({ sendOnSale: v })}
            />
            <ToggleRow
              label="Send confirmation on payment"
              desc="When a payment is recorded against any sale."
              checked={gateway.sendOnPayment}
              onChange={(v) => setGateway({ sendOnPayment: v })}
            />
            <ToggleRow
              label="Send weekly due reminder"
              desc="Every Monday morning to customers with outstanding due."
              checked={gateway.sendOnDue}
              onChange={(v) => setGateway({ sendOnDue: v })}
            />
            <ToggleRow
              label="Send birthday wish"
              desc="Morning of customer's birthday, if dob is set."
              checked={gateway.sendOnBirthday}
              onChange={(v) => setGateway({ sendOnBirthday: v })}
            />
          </Card>

          <Card className="p-4 bg-secondary/30 text-[12px] text-muted-foreground">
            <div className="font-semibold text-foreground mb-1">BD provider tips</div>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Most providers need pre-approved sender IDs (alphabetic, 3-11 chars)</li>
              <li>Bangla messages cost the same but split at 70 chars (vs 160 GSM-7)</li>
              <li>Numbers must be 11 digits starting with 01; auto-strip dashes/spaces</li>
              <li>BTRC may rate-limit promotional SMS during 9pm-9am</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
