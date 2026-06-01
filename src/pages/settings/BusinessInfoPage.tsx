import { useEffect, useState } from 'react';
import { Save, Image as ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { NumberField } from '@/components/ui/NumberField';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { useSettings } from '@/stores/settings';
import { useBranches } from '@/stores/branches';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';

const TIMEZONES = [
  'Asia/Dhaka',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'UTC',
];
const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD MMM YYYY'];
const FY_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July (BD default)', 'August', 'September', 'October', 'November', 'December',
];

export default function BusinessInfoPage() {
  const business = useSettings((s) => s.business);
  const setBusiness = useSettings((s) => s.setBusiness);
  const hydrate = useSettings((s) => s.hydrate);
  const branches = useBranches((s) => s.items);
  const hydrateBranches = useBranches((s) => s.hydrate);

  const [draft, setDraft] = useState(business);
  const [logoPreview, setLogoPreview] = useState(business.logoUrl);

  // Hydrate from backend on mount (branches first so the default-branch picker
  // and the id<->name bridge in the store have data to resolve against).
  useEffect(() => {
    void hydrateBranches().then(() => hydrate());
  }, [hydrate, hydrateBranches]);

  // Keep the local draft in sync once the async hydrate replaces `business`.
  useEffect(() => {
    setDraft(business);
    setLogoPreview(business.logoUrl);
  }, [business]);

  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setLogoPreview(url);
    set('logoUrl', url);
  };

  const removeLogo = () => {
    setLogoPreview(undefined);
    set('logoUrl', undefined);
  };

  const save = () => {
    setBusiness(draft);
    toast.success('Business info saved');
  };

  return (
    <div>
      <SettingsHeader
        title="Business Info"
        subtitle="Shop identity, currency, locale"
        actions={
          <Button onClick={save}>
            <Save className="size-4" /> Save Changes
          </Button>
        }
      />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT — basic info */}
        <div className="xl:col-span-2 space-y-4">
          <Section title="Identity">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Shop name" required>
                <Input value={draft.name} onChange={(e) => set('name', e.target.value)} />
              </Field>
              <Field label="Tagline">
                <Input value={draft.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} />
              </Field>
              <Field label="Address" className="md:col-span-2">
                <textarea
                  value={draft.address ?? ''}
                  onChange={(e) => set('address', e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
                />
              </Field>
              <Field label="Primary phone">
                <Input value={draft.phonePrimary ?? ''} onChange={(e) => set('phonePrimary', e.target.value)} />
              </Field>
              <Field label="Alternate phone">
                <Input value={draft.phoneAlt ?? ''} onChange={(e) => set('phoneAlt', e.target.value)} />
              </Field>
              <Field label="Email">
                <Input value={draft.email ?? ''} onChange={(e) => set('email', e.target.value)} />
              </Field>
              <Field label="Website">
                <Input value={draft.website ?? ''} onChange={(e) => set('website', e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title="Tax & Legal">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="VAT TIN">
                <Input value={draft.vatTin ?? ''} onChange={(e) => set('vatTin', e.target.value)} />
              </Field>
              <Field label="BIN no.">
                <Input value={draft.binNo ?? ''} onChange={(e) => set('binNo', e.target.value)} />
              </Field>
              <Field label="Trade License no.">
                <Input value={draft.tradeLicenseNo ?? ''} onChange={(e) => set('tradeLicenseNo', e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title="Locale & Currency">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Currency symbol" required>
                <Input value={draft.currencySymbol} onChange={(e) => set('currencySymbol', e.target.value)} />
              </Field>
              <Field label="Currency position">
                <select
                  value={draft.currencyPosition}
                  onChange={(e) => set('currencyPosition', e.target.value as 'before' | 'after')}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                >
                  <option value="before">{draft.currencySymbol} 100.00</option>
                  <option value="after">100.00 {draft.currencySymbol}</option>
                </select>
              </Field>
              <Field label="Decimal places">
                <NumberField value={draft.decimalPlaces} onChangeNumber={(v) => set('decimalPlaces', v)} />
              </Field>
              <Field label="Thousand separator">
                <select
                  value={draft.thousandSeparator}
                  onChange={(e) => set('thousandSeparator', e.target.value as any)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                >
                  <option value=",">Comma · 1,000</option>
                  <option value=".">Dot · 1.000</option>
                  <option value=" ">Space · 1 000</option>
                  <option value="">None · 1000</option>
                </select>
              </Field>
              <Field label="Timezone">
                <select
                  value={draft.timezone}
                  onChange={(e) => set('timezone', e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                >
                  {TIMEZONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date format">
                <select
                  value={draft.dateFormat}
                  onChange={(e) => set('dateFormat', e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                >
                  {DATE_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Default language">
                <select
                  value={draft.defaultLanguage}
                  onChange={(e) => set('defaultLanguage', e.target.value as 'en' | 'bn')}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                >
                  <option value="en">English</option>
                  <option value="bn">বাংলা (Bangla)</option>
                </select>
              </Field>
              <Field label="Fiscal year starts">
                <select
                  value={draft.fiscalYearStart}
                  onChange={(e) => set('fiscalYearStart', Number(e.target.value))}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                >
                  {FY_MONTHS.map((m, i) => (
                    <option key={i} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Default branch">
                <select
                  value={draft.defaultBranch ?? ''}
                  onChange={(e) => set('defaultBranch', e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>
        </div>

        {/* RIGHT — logo */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">Logo</div>
            <label className="block cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
              <div
                className={cn(
                  'aspect-square w-full rounded-xl border-2 border-dashed border-border hover:border-primary/60 grid place-items-center bg-secondary/30 transition relative overflow-hidden',
                )}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="" className="absolute inset-0 size-full object-contain p-4" />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <ImageIcon className="size-10 mx-auto mb-2 opacity-50" />
                    <div className="text-sm">Click to upload</div>
                    <div className="text-[11px] mt-0.5">PNG / SVG up to 1MB</div>
                  </div>
                )}
              </div>
            </label>
            {logoPreview && (
              <div className="flex items-center justify-end mt-2">
                <Button type="button" variant="ghost" size="sm" onClick={removeLogo}>
                  <X className="size-3.5" /> Remove
                </Button>
              </div>
            )}
            <div className="text-[11px] text-muted-foreground mt-3">
              Used on receipts, invoice header, splash screen.
            </div>
          </Card>

          <Card className="p-4 text-xs space-y-1.5 text-muted-foreground">
            <div className="text-sm font-semibold text-foreground">Preview</div>
            <div>
              <span className="font-mono tabular text-foreground">
                {draft.currencyPosition === 'before' ? draft.currencySymbol + ' ' : ''}
                {(1234.5).toLocaleString('en-IN', {
                  minimumFractionDigits: draft.decimalPlaces,
                  maximumFractionDigits: draft.decimalPlaces,
                })}
                {draft.currencyPosition === 'after' ? ' ' + draft.currencySymbol : ''}
              </span>
            </div>
            <div>Timezone: {draft.timezone}</div>
            <div>Date sample: {new Date().toLocaleDateString('en-GB')}</div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 space-y-3">
      <div className="text-sm font-semibold">{title}</div>
      {children}
    </Card>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(className)}>
      <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}
