import { useState } from 'react';
import {
  Hammer,
  Store,
  Coins,
  UserPlus,
  MapPin,
  Printer,
  Cloud,
  Check,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { useSettings } from '@/stores/settings';
import { useBranches } from '@/stores/branches';
import { useUsers } from '@/stores/users';
import { useAuth } from '@/stores/auth';
import { api, hasBackend } from '@/lib/api';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';

type StepId = 'welcome' | 'shop' | 'money' | 'admin' | 'branch' | 'printer' | 'cloud' | 'done';

const STEPS: { id: StepId; label: string; icon: any }[] = [
  { id: 'shop', label: 'Shop', icon: Store },
  { id: 'money', label: 'Currency & Tax', icon: Coins },
  { id: 'admin', label: 'Admin', icon: UserPlus },
  { id: 'branch', label: 'Branch', icon: MapPin },
  { id: 'printer', label: 'Printer', icon: Printer },
  { id: 'cloud', label: 'Cloud', icon: Cloud },
];

export default function FirstRunWizard() {
  const setBusiness = useSettings((s) => s.setBusiness);
  const taxRates = useSettings((s) => s.taxRates);
  const updateTaxRate = useSettings((s) => s.updateTaxRate);
  const addPrinter = useSettings((s) => s.addPrinter);
  const setBackup = useSettings((s) => s.setBackup);
  const branches = useBranches((s) => s.items);
  const updateBranch = useBranches((s) => s.update);
  const users = useUsers((s) => s.users);
  const updateUser = useUsers((s) => s.updateUser);
  const completeSetup = useAuth((s) => s.completeSetup);
  const completeSetupBackend = useAuth((s) => s.completeSetupBackend);

  const [step, setStep] = useState<StepId>('welcome');
  const [submitting, setSubmitting] = useState(false);

  // Shop
  const [shopName, setShopName] = useState('Hardware POS');
  const [tagline, setTagline] = useState('Built for the shop floor');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('Mirpur 10, Dhaka');

  // Money
  const [currencySymbol, setCurrencySymbol] = useState('৳');
  const [defaultTaxId, setDefaultTaxId] = useState(taxRates.find((t) => t.isDefault)?.id ?? taxRates[0]?.id ?? '');

  // Admin
  const [adminName, setAdminName] = useState('Shop Owner');
  const [adminUsername, setAdminUsername] = useState('owner');
  const [adminPin, setAdminPin] = useState('');

  // Branch
  const [branchName, setBranchName] = useState(branches[0]?.name ?? 'Main Branch');
  const [branchAddress, setBranchAddress] = useState(branches[0]?.address ?? '');

  // Printer
  const [skipPrinter, setSkipPrinter] = useState(true);
  const [printerName, setPrinterName] = useState('Counter Printer');
  const [printerWidth, setPrinterWidth] = useState<50 | 58 | 80 | 210>(80);

  // Cloud
  const [enableCloud, setEnableCloud] = useState(false);

  const idx = STEPS.findIndex((s) => s.id === step);

  const next = () => {
    if (step === 'welcome') return setStep('shop');
    const i = STEPS.findIndex((s) => s.id === step);
    if (i >= 0 && i < STEPS.length - 1) setStep(STEPS[i + 1].id);
    else if (i === STEPS.length - 1) finish();
  };
  const back = () => {
    if (step === 'shop') return setStep('welcome');
    const i = STEPS.findIndex((s) => s.id === step);
    if (i > 0) setStep(STEPS[i - 1].id);
  };

  const validStep = (): boolean => {
    if (step === 'shop') return shopName.trim().length > 0;
    if (step === 'admin') return adminName.trim().length > 0 && adminUsername.trim().length > 0 && adminPin.length >= 4;
    if (step === 'branch') return branchName.trim().length > 0;
    return true;
  };

  const finish = async () => {
    if (submitting) return;

    // ---- BACKEND PATH: persist everything through the single run-once channel ----
    if (hasBackend()) {
      setSubmitting(true);
      try {
        const result = await api<{ user: { id: string }; permissions: string[] }>('setup.complete', {
          shop: {
            name: shopName.trim(),
            tagline: tagline.trim() || undefined,
            phonePrimary: phone.trim() || undefined,
            address: address.trim() || undefined,
            currencySymbol,
          },
          defaultTaxId: defaultTaxId || undefined,
          branch: {
            name: branchName.trim(),
            address: branchAddress.trim() || undefined,
          },
          admin: {
            name: adminName.trim(),
            username: adminUsername.trim().toLowerCase(),
            pin: adminPin,
          },
          printer: skipPrinter
            ? null
            : { name: printerName.trim() || 'Counter Printer', paperWidth: printerWidth },
          cloud: enableCloud,
        });

        // The IPC layer already established the owner session; mirror it locally.
        completeSetupBackend(result);

        // Hydrate the slices so the app shows the persisted values immediately.
        await Promise.all([
          useSettings.getState().hydrate(),
          useBranches.getState().hydrate(),
          useUsers.getState().hydrate(),
        ]);

        toast.success('Setup complete — welcome!', { description: `${shopName} is ready to go.` });
      } catch (e) {
        setSubmitting(false);
        toast.error(e instanceof Error ? e.message : 'Setup failed — please try again.');
      }
      return;
    }

    // ---- MOCK PATH (no backend): unchanged local store writes ----
    // Persist shop info
    setBusiness({
      name: shopName.trim(),
      tagline: tagline.trim() || undefined,
      phonePrimary: phone.trim() || undefined,
      address: address.trim() || undefined,
      currencySymbol,
      defaultBranch: branchName.trim(),
    });
    // Default tax
    if (defaultTaxId) {
      taxRates.forEach((t) => updateTaxRate(t.id, { isDefault: t.id === defaultTaxId }));
    }
    // Branch (rename the first seed branch as the main one)
    if (branches[0]) {
      updateBranch(branches[0].id, {
        name: branchName.trim(),
        address: branchAddress.trim() || undefined,
        isDefault: true,
      });
    }
    // Admin user — reuse the seed admin (u_admin) so it stays the owner account
    const adminUser = users.find((u) => u.id === 'u_admin') ?? users[0];
    if (adminUser) {
      updateUser(adminUser.id, {
        name: adminName.trim(),
        username: adminUsername.trim().toLowerCase(),
        pin: adminPin,
        status: 'active',
      });
    }
    // Printer
    if (!skipPrinter) {
      addPrinter({
        name: printerName.trim() || 'Counter Printer',
        connection: 'USB',
        paperWidth: printerWidth,
        encoding: 'UTF-8',
        isDefault: true,
      });
    }
    // Cloud
    if (enableCloud) {
      setBackup({ cloudProvider: 'supabase', autoBackup: 'on-shift-close' });
    }
    // Complete + log the admin in
    completeSetup(adminUser?.id ?? 'u_admin');
    toast.success('Setup complete — welcome!', { description: `${shopName} is ready to go.` });
  };

  return (
    <div className="h-screen w-screen flex bg-background overflow-hidden">
      {/* LEFT progress rail */}
      <div className="hidden md:flex flex-col w-[300px] bg-gradient-to-b from-primary via-purple-600 to-accent text-white p-8 relative">
        <div className="absolute inset-0 bg-grain opacity-20" />
        <div className="relative z-10 flex items-center gap-3 mb-10">
          <div className="size-10 rounded-xl bg-white/15 grid place-items-center">
            <Hammer className="size-5" />
          </div>
          <div className="font-bold">Setup Wizard</div>
        </div>
        <div className="relative z-10 space-y-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = idx > i || step === 'done';
            const active = step === s.id;
            return (
              <div
                key={s.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition',
                  active && 'bg-white/15',
                )}
              >
                <div
                  className={cn(
                    'size-7 rounded-full grid place-items-center text-xs font-bold shrink-0',
                    done ? 'bg-white text-primary' : active ? 'bg-white/25' : 'bg-white/10',
                  )}
                >
                  {done ? <Check className="size-4" /> : <Icon className="size-3.5" />}
                </div>
                <span className={cn('text-sm', active ? 'font-semibold' : 'text-white/70')}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="relative z-10 mt-auto text-white/50 text-xs">
          Step {Math.max(1, idx + 1)} of {STEPS.length}
        </div>
      </div>

      {/* RIGHT content */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-auto p-8 md:p-12">
          <div className="max-w-lg mx-auto">
            {step === 'welcome' && (
              <div className="text-center py-10">
                <div className="size-16 rounded-2xl bg-gradient-to-br from-primary to-accent text-white grid place-items-center mx-auto mb-5">
                  <Hammer className="size-8" />
                </div>
                <h1 className="text-2xl font-bold">Welcome to Hardware POS</h1>
                <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                  Let's set up your shop in a few quick steps. You can change any of this later in
                  Settings.
                </p>
                <Button size="lg" className="mt-6" onClick={next}>
                  Get started <ArrowRight className="size-4" />
                </Button>
              </div>
            )}

            {step === 'shop' && (
              <Step title="Shop details" subtitle="Your shop's name and contact info">
                <Field label="Shop name" required>
                  <Input value={shopName} onChange={(e) => setShopName(e.target.value)} autoFocus />
                </Field>
                <Field label="Tagline">
                  <Input value={tagline} onChange={(e) => setTagline(e.target.value)} />
                </Field>
                <Field label="Phone">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXX-XXXXXX" />
                </Field>
                <Field label="Address">
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                </Field>
              </Step>
            )}

            {step === 'money' && (
              <Step title="Currency & tax" subtitle="How money and VAT are handled">
                <Field label="Currency symbol">
                  <div className="flex gap-2">
                    {['৳', '₹', '$', '€'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setCurrencySymbol(s)}
                        className={cn(
                          'size-11 rounded-md border text-lg font-semibold transition',
                          currencySymbol === s
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:bg-secondary',
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Default tax rate">
                  <div className="space-y-1.5">
                    {taxRates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setDefaultTaxId(t.id)}
                        className={cn(
                          'w-full flex items-center justify-between rounded-md border p-3 transition text-left',
                          defaultTaxId === t.id
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:bg-secondary',
                        )}
                      >
                        <span className="text-sm font-medium">{t.name}</span>
                        <span className="tabular text-sm">{t.percentage}%</span>
                      </button>
                    ))}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1.5">
                    Most BD hardware shops sell tax-inclusive — "No Tax" (0%) is a fine default.
                  </div>
                </Field>
              </Step>
            )}

            {step === 'admin' && (
              <Step title="Admin account" subtitle="The owner account with full access">
                <Field label="Full name" required>
                  <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} autoFocus />
                </Field>
                <Field label="Username" required>
                  <Input
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="owner"
                  />
                </Field>
                <Field label="PIN (4-6 digits)" required>
                  <Input
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="e.g. 1234"
                    className="font-mono tracking-widest"
                  />
                  <div className="text-[11px] text-muted-foreground mt-1">
                    You'll use this PIN to sign in and unlock the screen.
                  </div>
                </Field>
              </Step>
            )}

            {step === 'branch' && (
              <Step title="Your branch" subtitle="The shop location you operate from">
                <Field label="Branch name" required>
                  <Input value={branchName} onChange={(e) => setBranchName(e.target.value)} autoFocus />
                </Field>
                <Field label="Branch address">
                  <Input value={branchAddress} onChange={(e) => setBranchAddress(e.target.value)} />
                </Field>
                <div className="text-[12px] text-muted-foreground bg-secondary/40 rounded-md p-3">
                  You can add more branches later in Settings → Branches. This becomes your default.
                </div>
              </Step>
            )}

            {step === 'printer' && (
              <Step title="Receipt printer" subtitle="Optional — set up a thermal printer">
                <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={skipPrinter}
                    onChange={(e) => setSkipPrinter(e.target.checked)}
                  />
                  Skip for now (set up later in Settings)
                </label>
                {!skipPrinter && (
                  <>
                    <Field label="Printer name">
                      <Input value={printerName} onChange={(e) => setPrinterName(e.target.value)} />
                    </Field>
                    <Field label="Paper width">
                      <div className="flex gap-2">
                        {([50, 58, 80, 210] as const).map((w) => (
                          <button
                            key={w}
                            onClick={() => setPrinterWidth(w)}
                            className={cn(
                              'h-10 px-3 rounded-md border text-sm font-medium transition',
                              printerWidth === w
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:bg-secondary',
                            )}
                          >
                            {w === 210 ? 'A4' : `${w}mm`}
                          </button>
                        ))}
                      </div>
                    </Field>
                  </>
                )}
              </Step>
            )}

            {step === 'cloud' && (
              <Step title="Cloud backup" subtitle="Optional — sync and back up online">
                <label
                  className={cn(
                    'flex items-start gap-3 rounded-md border p-4 cursor-pointer transition',
                    enableCloud ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={enableCloud}
                    onChange={(e) => setEnableCloud(e.target.checked)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-sm">Enable cloud backup</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">
                      Automatically back up to the cloud after each shift close. You'll connect your
                      provider later in Settings → Backup & Sync.
                    </div>
                  </div>
                </label>
                <div className="text-[12px] text-muted-foreground mt-3">
                  The app works fully offline. Cloud is optional and can be enabled any time.
                </div>
              </Step>
            )}

            {step === 'done' && (
              <div className="text-center py-10">
                <div className="size-16 rounded-full bg-success/15 text-success grid place-items-center mx-auto mb-5">
                  <CheckCircle2 className="size-9" />
                </div>
                <h1 className="text-2xl font-bold">All set!</h1>
                <p className="text-muted-foreground mt-2">Taking you into the app…</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer nav */}
        {step !== 'welcome' && step !== 'done' && (
          <div className="border-t border-border px-8 py-4 flex items-center justify-between bg-card">
            <Button variant="outline" onClick={back} disabled={submitting}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            <div className="flex items-center gap-2">
              {idx === STEPS.length - 1 ? (
                <Button onClick={finish} disabled={!validStep() || submitting}>
                  <Check className="size-4" /> {submitting ? 'Setting up…' : 'Finish setup'}
                </Button>
              ) : (
                <Button onClick={next} disabled={!validStep() || submitting}>
                  Continue <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Step({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-slide-in-bottom">
      <h1 className="text-xl font-bold">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-0.5 mb-5">{subtitle}</p>}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
