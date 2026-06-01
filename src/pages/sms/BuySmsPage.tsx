import { useState } from 'react';
import {
  ShoppingCart,
  ArrowLeft,
  Wallet,
  CheckCircle2,
  CreditCard,
  Smartphone,
  Building,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { NumberField } from '@/components/ui/NumberField';
import { useSms } from '@/stores/sms';
import { toast } from '@/stores/toast';
import { formatBDT, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Pack {
  bdt: number;
  bonus?: number; // bonus BDT credit
  popular?: boolean;
}

const PACKS: Pack[] = [
  { bdt: 100 },
  { bdt: 500, bonus: 25 },
  { bdt: 1000, bonus: 75, popular: true },
  { bdt: 2500, bonus: 250 },
  { bdt: 5000, bonus: 750 },
  { bdt: 10000, bonus: 2000 },
];

const METHODS = [
  { id: 'bkash', label: 'bKash', Icon: Smartphone, color: 'text-pink-600 bg-pink-500/10' },
  { id: 'nagad', label: 'Nagad', Icon: Smartphone, color: 'text-orange-600 bg-orange-500/10' },
  { id: 'card', label: 'Card', Icon: CreditCard, color: 'text-blue-600 bg-blue-500/10' },
  { id: 'bank', label: 'Bank transfer', Icon: Building, color: 'text-indigo-600 bg-indigo-500/10' },
] as const;

export default function BuySmsPage() {
  const credit = useSms((s) => s.credit);
  const buyCredit = useSms((s) => s.buyCredit);

  const [selectedPack, setSelectedPack] = useState<Pack | null>(PACKS[2]);
  const [custom, setCustom] = useState(0);
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('bkash');

  const customMode = custom > 0 && !selectedPack;
  const totalAmount = customMode ? custom : (selectedPack?.bdt ?? 0);
  const bonus = customMode ? 0 : (selectedPack?.bonus ?? 0);
  const totalCredit = totalAmount + bonus;
  const messages = Math.floor(totalCredit / credit.smsRate);

  const handleBuy = () => {
    if (totalCredit <= 0) return;
    buyCredit(totalCredit);
    toast.success(`Topped up ${formatBDT(totalAmount)}`, {
      description:
        (bonus > 0 ? `+${formatBDT(bonus)} bonus · ` : '') +
        `${formatNumber(messages)} messages · new balance ${formatBDT(credit.balance + totalCredit)}`,
    });
  };

  return (
    <div>
      <PageHeader
        title="Buy SMS"
        subtitle="Top up credit balance"
        actions={
          <Link
            to="/sms"
            className="inline-flex items-center gap-1 px-2 h-9 rounded-md hover:bg-secondary text-sm text-muted-foreground"
          >
            <ArrowLeft className="size-4" /> SMS
          </Link>
        }
      />

      <div className="p-6 max-w-5xl grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          {/* Current balance */}
          <Card className="p-5 border-l-4 border-primary">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-md bg-primary/10 text-primary grid place-items-center">
                <Wallet className="size-6" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                  Current balance
                </div>
                <div className="tabular font-bold text-2xl text-primary">
                  {formatBDT(credit.balance)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  ≈ {formatNumber(Math.floor(credit.balance / credit.smsRate))} messages at{' '}
                  {formatBDT(credit.smsRate)}/SMS
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-right">
                <div>
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                    Purchased
                  </div>
                  <div className="tabular font-semibold">
                    {formatBDT(credit.totalPurchased)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                    Spent
                  </div>
                  <div className="tabular font-semibold text-warning">
                    {formatBDT(credit.totalSpent)}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Pack picker */}
          <Card className="p-5 space-y-3">
            <div className="text-sm font-semibold">Choose a pack</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {PACKS.map((pack) => {
                const isSelected = selectedPack?.bdt === pack.bdt && !customMode;
                return (
                  <button
                    key={pack.bdt}
                    onClick={() => {
                      setSelectedPack(pack);
                      setCustom(0);
                    }}
                    className={cn(
                      'rounded-lg border p-4 text-left transition relative',
                      isSelected
                        ? 'border-primary bg-primary/10 ring-2 ring-ring/40'
                        : 'border-border hover:bg-secondary',
                    )}
                  >
                    {pack.popular && (
                      <div className="absolute -top-2 right-3">
                        <Badge variant="info">Popular</Badge>
                      </div>
                    )}
                    <div className="tabular font-bold text-lg">{formatBDT(pack.bdt)}</div>
                    {pack.bonus && pack.bonus > 0 && (
                      <div className="text-[11px] text-success font-semibold mt-0.5">
                        + {formatBDT(pack.bonus)} bonus
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-1">
                      ≈ {formatNumber(Math.floor((pack.bdt + (pack.bonus ?? 0)) / credit.smsRate))} messages
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Custom amount */}
          <Card className="p-5 space-y-3">
            <div className="text-sm font-semibold">Or custom amount</div>
            <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                  Amount (BDT)
                </label>
                <NumberField
                  value={custom}
                  onChangeNumber={(v) => {
                    setCustom(v);
                    if (v > 0) setSelectedPack(null);
                    else if (v === 0) setSelectedPack(PACKS[2]);
                  }}
                />
              </div>
              <div className="text-[11px] text-muted-foreground pb-2">
                {custom > 0
                  ? `≈ ${formatNumber(Math.floor(custom / credit.smsRate))} messages`
                  : 'min ৳ 50'}
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Bonus credit applies to packs only. Custom top-ups don't get bonus.
            </div>
          </Card>

          {/* Payment method */}
          <Card className="p-5 space-y-3">
            <div className="text-sm font-semibold">Payment method</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={cn(
                    'h-14 rounded-md border flex flex-col items-center justify-center gap-1 transition',
                    method === m.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-secondary',
                  )}
                >
                  <m.Icon className="size-4" />
                  <span className="text-xs font-medium">{m.label}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Order summary */}
        <div className="space-y-4">
          <Card className="p-5 space-y-3 sticky top-4">
            <div className="text-sm font-semibold">Order summary</div>
            <div className="space-y-2">
              <Row label="Pack amount" value={formatBDT(totalAmount)} />
              {bonus > 0 && (
                <Row label="Bonus credit" value={`+ ${formatBDT(bonus)}`} tone="success" />
              )}
              <div className="border-t border-border pt-2">
                <Row label="Total credit" value={formatBDT(totalCredit)} bold />
              </div>
              <Row
                label="Messages added"
                value={`≈ ${formatNumber(messages)}`}
                tone="muted"
              />
            </div>
            <div className="rounded-md bg-secondary/40 p-3 text-[11px]">
              <div className="font-semibold text-foreground mb-1">Payment method</div>
              <div className="text-muted-foreground capitalize">
                {METHODS.find((m) => m.id === method)?.label}
              </div>
            </div>
            <Button
              className="w-full"
              size="lg"
              disabled={totalCredit <= 0}
              onClick={handleBuy}
            >
              <ShoppingCart className="size-4" /> Buy {formatBDT(totalAmount)}
            </Button>
            <div className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <CheckCircle2 className="size-3 mt-0.5 shrink-0 text-success" />
              Credit added instantly to your balance after payment confirmation.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: 'success' | 'muted';
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          'tabular',
          bold && 'font-bold text-base',
          tone === 'success' && 'text-success font-semibold',
          tone === 'muted' && 'text-muted-foreground',
        )}
      >
        {value}
      </span>
    </div>
  );
}
