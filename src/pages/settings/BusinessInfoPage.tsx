import { useEffect, useRef, useState } from 'react';
import { Save, Image as ImageIcon, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { useSettings, type BusinessInfo } from '@/stores/settings';
import { useBranches } from '@/stores/branches';
import { toast } from '@/stores/toast';
import { fileToStoredImage, usableImage } from '@/lib/imageFile';
import { cn, formatBDT } from '@/lib/utils';
import { formatDate } from '@/lib/formatDate';

/**
 * B12: edits typed here and not saved survive leaving the page. They are kept
 * in memory (not persisted) and restored on return, with a toast to go back.
 */
let unsavedDraft: BusinessInfo | null = null;

const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD MMM YYYY'];

/*
 * Not shown (saved values are kept and sent back unchanged):
 *  - Timezone and fiscal-year start: nothing in the app reads them (R81).
 *  - Default language: applying it at first launch needs the startup code
 *    (App.tsx / i18n), which this page cannot do; the titlebar EN / বাংলা toggle
 *    is the language switch.
 */

export default function BusinessInfoPage() {
  const business = useSettings((s) => s.business);
  const setBusiness = useSettings((s) => s.setBusiness);
  const hydrate = useSettings((s) => s.hydrate);
  const branches = useBranches((s) => s.items);
  const hydrateBranches = useBranches((s) => s.hydrate);

  const [draft, setDraft] = useState<BusinessInfo>(() => unsavedDraft ?? business);
  const [logoPreview, setLogoPreview] = useState(usableImage((unsavedDraft ?? business).logoUrl));
  const [logoBusy, setLogoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  // True while the draft came back from an earlier visit: hydrate must not wipe it.
  const restored = useRef(unsavedDraft !== null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(business);
  const leaveState = useRef({ dirty, draft });
  leaveState.current = { dirty, draft };
  useEffect(() => {
    unsavedDraft = null; // consumed by this visit
    return () => {
      if (!leaveState.current.dirty) return;
      unsavedDraft = leaveState.current.draft;
      toast.warning('Business info is not saved yet', {
        action: {
          label: 'Go back',
          onClick: () => {
            window.location.hash = '#/settings/business';
          },
        },
      });
    };
  }, []);

  // Hydrate from backend on mount (branches first so the default-branch picker
  // and the id<->name bridge in the store have data to resolve against).
  useEffect(() => {
    void hydrateBranches().then(() => hydrate());
  }, [hydrate, hydrateBranches]);

  // Keep the local draft in sync once the async hydrate replaces `business`.
  useEffect(() => {
    if (restored.current) return;
    setDraft(business);
    setLogoPreview(usableImage(business.logoUrl));
  }, [business]);

  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  /**
   * Store the logo bytes, not a `blob:` handle to them.
   *
   * The old version saved `URL.createObjectURL(f)`, which is only valid for the
   * current window — so the logo vanished on the next restart AND printed as a
   * broken image on every receipt (Receipt.tsx renders this value). Transparency
   * is preserved, because a shop logo is usually a transparent PNG and would
   * otherwise gain a black box.
   */
  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // let the same file be re-picked after a failure
    if (!f) return;
    setLogoBusy(true);
    try {
      const stored = await fileToStoredImage(f, { maxEdge: 320, preserveAlpha: true });
      setLogoPreview(stored);
      set('logoUrl', stored);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not use that picture');
    } finally {
      setLogoBusy(false);
    }
  };

  const removeLogo = () => {
    setLogoPreview(undefined);
    set('logoUrl', undefined);
  };

  const save = async () => {
    setSaving(true);
    const ok = await setBusiness(draft);
    setSaving(false);
    if (!ok) return; // the store already showed the reason
    restored.current = false;
    toast.success('Business info saved');
  };

  const discard = () => {
    restored.current = false;
    setDraft(business);
    setLogoPreview(usableImage(business.logoUrl));
  };

  // Live sample through the app's real formatters, using the unsaved draft.
  const moneySample = formatBDT(1234567.5, { format: draft });
  const dateSample = formatDate(new Date(), { pattern: draft.dateFormat });
  const decimalOptions = Array.from(new Set([0, 2, draft.decimalPlaces])).sort((a, b) => a - b);

  return (
    <div>
      <SettingsHeader
        title="Shop details"
        actions={
          <>
            {dirty && <span className="text-xs text-warning font-medium">Unsaved changes</span>}
            <Button onClick={() => void save()} disabled={saving || !dirty}>
              <Save className="size-4" /> {saving ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
            </Button>
          </>
        }
      />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT — what prints on every receipt */}
        <div className="xl:col-span-2 space-y-4">
          <Section title="Identity">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Shop name" required>
                {(f) => <Input {...f} value={draft.name} onChange={(e) => set('name', e.target.value)} />}
              </FormField>
              <FormField label="Primary phone">
                {(f) => (
                  <Input {...f} value={draft.phonePrimary ?? ''} onChange={(e) => set('phonePrimary', e.target.value)} />
                )}
              </FormField>
              <FormField label="Address" className="md:col-span-2">
                {(f) => (
                  <textarea
                    {...f}
                    value={draft.address ?? ''}
                    onChange={(e) => set('address', e.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
                  />
                )}
              </FormField>
              <FormField label="Tagline">
                {(f) => <Input {...f} value={draft.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} />}
              </FormField>
              <FormField label="Alternate phone">
                {(f) => <Input {...f} value={draft.phoneAlt ?? ''} onChange={(e) => set('phoneAlt', e.target.value)} />}
              </FormField>
              <FormField label="Email">
                {(f) => <Input {...f} value={draft.email ?? ''} onChange={(e) => set('email', e.target.value)} />}
              </FormField>
              <FormField label="Website">
                {(f) => <Input {...f} value={draft.website ?? ''} onChange={(e) => set('website', e.target.value)} />}
              </FormField>
            </div>
          </Section>

          <Section title="Tax & Legal">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormField label="VAT TIN">
                {(f) => <Input {...f} value={draft.vatTin ?? ''} onChange={(e) => set('vatTin', e.target.value)} />}
              </FormField>
              <FormField label="BIN no.">
                {(f) => <Input {...f} value={draft.binNo ?? ''} onChange={(e) => set('binNo', e.target.value)} />}
              </FormField>
              <FormField label="Trade License no.">
                {(f) => (
                  <Input {...f} value={draft.tradeLicenseNo ?? ''} onChange={(e) => set('tradeLicenseNo', e.target.value)} />
                )}
              </FormField>
            </div>
          </Section>

          <Section title="Money format">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormField label="Currency symbol" required>
                {(f) => (
                  <Input {...f} value={draft.currencySymbol} onChange={(e) => set('currencySymbol', e.target.value)} />
                )}
              </FormField>
              <FormField label="Currency position">
                {(f) => (
                  <Select
                    {...f}
                    value={draft.currencyPosition}
                    onChange={(e) => set('currencyPosition', e.target.value as 'before' | 'after')}
                  >
                    <option value="before">{formatBDT(100, { format: { ...draft, currencyPosition: 'before' } })}</option>
                    <option value="after">{formatBDT(100, { format: { ...draft, currencyPosition: 'after' } })}</option>
                  </Select>
                )}
              </FormField>
              <FormField label="Decimal places">
                {(f) => (
                  <Select {...f} value={draft.decimalPlaces} onChange={(e) => set('decimalPlaces', Number(e.target.value))}>
                    {decimalOptions.map((n) => (
                      <option key={n} value={n}>
                        {formatBDT(100, { withSymbol: false, format: { ...draft, decimalPlaces: n } })}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Sample</span>{' '}
              <span className="tabular font-semibold" data-no-i18n>
                {moneySample}
              </span>
            </div>
          </Section>

          {/* Expert formats: closed by default. */}
          <details className="group rounded-lg border border-border bg-card">
            <summary className="cursor-pointer select-none list-none flex items-center gap-2 p-4 text-sm font-semibold focus-ring rounded-lg">
              <ChevronDown className="size-4 transition-transform -rotate-90 group-open:rotate-0" />
              <span>More formats</span>
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-4 pb-4">
              <FormField label="Thousand separator">
                {(f) => (
                  <Select
                    {...f}
                    value={draft.thousandSeparator}
                    onChange={(e) => set('thousandSeparator', e.target.value as BusinessInfo['thousandSeparator'])}
                  >
                    <option value=",">Comma · 1,000</option>
                    <option value=".">Dot · 1.000</option>
                    <option value=" ">Space · 1 000</option>
                    <option value="">None · 1000</option>
                  </Select>
                )}
              </FormField>
              <FormField label="Date format" hint={<span data-no-i18n>{dateSample}</span>}>
                {(f) => (
                  <Select {...f} value={draft.dateFormat} onChange={(e) => set('dateFormat', e.target.value)}>
                    {DATE_FORMATS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField label="Default branch">
                {(f) => (
                  <Select {...f} value={draft.defaultBranch ?? ''} onChange={(e) => set('defaultBranch', e.target.value)}>
                    {branches.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            </div>
          </details>
        </div>

        {/* RIGHT — logo */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">Logo</div>
            <label className="block cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={(e) => void onLogo(e)} />
              <div
                className={cn(
                  'w-full rounded-xl border-2 border-dashed border-border hover:border-primary/60 grid place-items-center bg-secondary/30 transition relative overflow-hidden',
                  logoPreview ? 'h-32' : 'h-40',
                )}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="" className="absolute inset-0 size-full object-contain p-3" />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <ImageIcon className="size-8 mx-auto mb-2 opacity-50" />
                    <div className="text-sm">Click to upload</div>
                    {/* SVG is not offered: the logo is re-encoded to a bitmap so
                        it can be stored with the shop data and printed. */}
                    <div className="text-xs mt-0.5">PNG or JPG · saved with your data</div>
                  </div>
                )}
                {logoBusy && (
                  <div className="absolute inset-0 grid place-items-center bg-background/70 text-sm font-medium">
                    Saving picture…
                  </div>
                )}
              </div>
            </label>
            {logoPreview && (
              <div className="flex items-center justify-end mt-2">
                <Button type="button" variant="outline" onClick={removeLogo}>
                  <X className="size-4" /> Remove
                </Button>
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-3">Used on receipts, invoice header, splash screen.</div>
          </Card>
        </div>
      </div>

      {/* Save is always reachable while there is something to save. */}
      {dirty && (
        <div className="sticky bottom-0 z-10 border-t border-border bg-card/95 backdrop-blur px-6 py-3 flex items-center justify-end gap-3">
          <span className="text-sm text-warning font-medium mr-auto">Unsaved changes</span>
          <Button variant="outline" size="lg" onClick={discard} disabled={saving}>
            Discard
          </Button>
          <Button size="lg" onClick={() => void save()} disabled={saving}>
            <Save className="size-5" /> {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      )}
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
