import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, hasBackend } from '@/lib/api';
import { toast } from '@/stores/toast';
import { useBranches } from '@/stores/branches';
import {
  toBusinessInfo,
  toTaxRate,
  type BackendBusinessInfo,
  type BackendTaxRate,
} from '@/hooks/settingsAdapter';

const CURRENT_USER = 'u_admin';

// ---------- Business Info ----------
export interface BusinessInfo {
  name: string;
  tagline?: string;
  logoUrl?: string; // local URL.createObjectURL preview; backend stores real upload path
  address?: string;
  phonePrimary?: string;
  phoneAlt?: string;
  email?: string;
  website?: string;
  vatTin?: string;
  binNo?: string; // BD Business Identification Number
  tradeLicenseNo?: string;
  currencySymbol: string;
  currencyPosition: 'before' | 'after';
  decimalPlaces: number;
  thousandSeparator: ',' | '.' | ' ' | '';
  timezone: string;
  dateFormat: string;
  fiscalYearStart: number; // month 1..12; July is BD norm = 7
  defaultLanguage: 'en' | 'bn';
  defaultBranch?: string; // by name; resolved against Branches store
}

const DEFAULT_BUSINESS: BusinessInfo = {
  name: 'Hardware POS',
  tagline: 'Built for the shop floor',
  address: 'Mirpur 10, Dhaka',
  phonePrimary: '01XXX-XXXXXX',
  email: '',
  currencySymbol: '৳',
  currencyPosition: 'before',
  decimalPlaces: 2,
  thousandSeparator: ',',
  timezone: 'Asia/Dhaka',
  dateFormat: 'DD/MM/YYYY',
  fiscalYearStart: 7,
  defaultLanguage: 'en',
  defaultBranch: 'Mirpur Branch',
};

// ---------- Tax Rates ----------
export interface TaxRate {
  id: string;
  name: string;
  percentage: number;
  isDefault?: boolean;
  scope?: 'product' | 'sale' | 'purchase' | 'all';
}

const DEFAULT_TAX_RATES: TaxRate[] = [
  { id: 'tx_15', name: 'VAT 15%', percentage: 15, scope: 'all' },
  { id: 'tx_5', name: 'VAT 5%', percentage: 5, scope: 'all' },
  { id: 'tx_0', name: 'No Tax', percentage: 0, isDefault: true, scope: 'all' },
];

// ---------- Invoice Schemes ----------
export type DocType = 'sale' | 'pos' | 'quotation' | 'draft' | 'purchase' | 'return' | 'shipment';

export interface InvoiceScheme {
  id: string;
  name: string;
  docType: DocType;
  prefix: string;
  yearFormat: 'none' | 'YY' | 'YYYY';
  separator: string;
  counterPadding: number;
  resetRule: 'never' | 'yearly' | 'monthly';
  startNumber: number;
  isDefault?: boolean;
}

const DEFAULT_SCHEMES: InvoiceScheme[] = [
  { id: 'sch_inv', name: 'Default Sale Invoice', docType: 'sale', prefix: 'INV', yearFormat: 'YYYY', separator: '-', counterPadding: 4, resetRule: 'yearly', startNumber: 1, isDefault: true },
  { id: 'sch_pos', name: 'Default POS', docType: 'pos', prefix: 'POS', yearFormat: 'YYYY', separator: '-', counterPadding: 4, resetRule: 'yearly', startNumber: 1, isDefault: true },
  { id: 'sch_qtn', name: 'Default Quotation', docType: 'quotation', prefix: 'QTN', yearFormat: 'YYYY', separator: '-', counterPadding: 4, resetRule: 'yearly', startNumber: 1, isDefault: true },
  { id: 'sch_drf', name: 'Default Draft', docType: 'draft', prefix: 'DRF', yearFormat: 'YYYY', separator: '-', counterPadding: 4, resetRule: 'yearly', startNumber: 1, isDefault: true },
  { id: 'sch_po', name: 'Default Purchase', docType: 'purchase', prefix: 'PO', yearFormat: 'YYYY', separator: '-', counterPadding: 4, resetRule: 'yearly', startNumber: 1, isDefault: true },
  { id: 'sch_rtn', name: 'Default Returns', docType: 'return', prefix: 'RTN', yearFormat: 'YYYY', separator: '-', counterPadding: 4, resetRule: 'yearly', startNumber: 1, isDefault: true },
  { id: 'sch_shp', name: 'Default Shipment', docType: 'shipment', prefix: 'SHP', yearFormat: 'YYYY', separator: '-', counterPadding: 4, resetRule: 'yearly', startNumber: 1, isDefault: true },
];

// ---------- Receipt Template ----------
export interface ReceiptTemplate {
  paperSize: '50mm' | '80mm' | 'A4';
  showLogo: boolean;
  headerLines: string[]; // free text
  footerLines: string[]; // free text
  showCashier: boolean;
  showCustomerPhone: boolean;
  showCustomerAddress: boolean;
  showLineDiscount: boolean;
  showLineTax: boolean;
  showPaymentRef: boolean;
  showBarcode: boolean;
  showQRCode: boolean;
  showAmountInWords: boolean;
}

const DEFAULT_RECEIPT: ReceiptTemplate = {
  paperSize: '80mm',
  showLogo: true,
  headerLines: ['Thank you for your purchase'],
  footerLines: ['Returns within 7 days with receipt', 'Software by Hardware POS'],
  showCashier: true,
  showCustomerPhone: true,
  showCustomerAddress: true,
  showLineDiscount: true,
  showLineTax: false,
  showPaymentRef: true,
  showBarcode: true,
  showQRCode: false,
  showAmountInWords: true,
};

// ---------- Barcode Settings ----------
export interface BarcodeSettings {
  defaultLabel: '50x30' | 'A4-grid';
  showName: boolean;
  showSKU: boolean;
  showBarcode: boolean;
  showPrice: boolean;
  showBrand: boolean;
  showMRP: boolean;
  defaultCopies: number;
  codeType: 'Code128' | 'EAN-13';
}

const DEFAULT_BARCODE: BarcodeSettings = {
  defaultLabel: '50x30',
  showName: true,
  showSKU: true,
  showBarcode: true,
  showPrice: true,
  showBrand: false,
  showMRP: false,
  defaultCopies: 1,
  codeType: 'Code128',
};

// ---------- Printer Profiles ----------
export interface PrinterProfile {
  id: string;
  name: string;
  branch?: string;
  connection: 'USB' | 'Network' | 'Bluetooth';
  model?: string;
  ipOrPort?: string; // network ip or COM port
  paperWidth: 50 | 58 | 80 | 210;
  encoding: 'UTF-8' | 'GB18030' | 'CP437';
  isDefault?: boolean;
}

// ---------- Theme & Appearance ----------
export interface AppearancePrefs {
  themeMode: 'light' | 'dark' | 'system';
  accentHue: number; // 0..360
  density: 'compact' | 'comfortable';
  fontScale: 0.9 | 1 | 1.1 | 1.2;
}

const DEFAULT_APPEARANCE: AppearancePrefs = {
  themeMode: 'system',
  accentHue: 243, // matches existing primary indigo
  density: 'comfortable',
  fontScale: 1,
};

// ---------- POS Preferences ----------
export interface POSPrefs {
  defaultPriceMarkupPct: number;
  defaultOrderTaxPct: number;
  defaultPaymentMethod: 'Cash' | 'bKash' | 'Nagad' | 'Card' | 'Bank' | 'Credit';
  visiblePaymentMethods: string[];
  autoPrintOnSave: boolean;
  bigButtonMode: boolean;
  allowNegativeStockDefault: boolean;
  resetCustomerPerCart: boolean;
}

const DEFAULT_POS: POSPrefs = {
  defaultPriceMarkupPct: 0,
  defaultOrderTaxPct: 0,
  defaultPaymentMethod: 'Cash',
  visiblePaymentMethods: ['Cash', 'bKash', 'Nagad', 'Card', 'Bank', 'Credit'],
  autoPrintOnSave: false,
  bigButtonMode: false,
  allowNegativeStockDefault: false,
  resetCustomerPerCart: true,
};

// ---------- Cash Register Preferences ----------
export interface CashRegisterPrefs {
  varianceWarn: number;
  varianceBlock: number;
  defaultCarriedFloat: number;
  requireManagerPinOnVariance: boolean;
}

const DEFAULT_CASH: CashRegisterPrefs = {
  varianceWarn: 100,
  varianceBlock: 1000,
  defaultCarriedFloat: 5000,
  requireManagerPinOnVariance: true,
};

// ---------- Keyboard Shortcuts ----------
export interface ShortcutMap {
  search: string; // 'F2'
  customer: string; // 'F3'
  orderDiscount: string; // 'F4'
  heldCarts: string; // 'F5'
  saveDraft: string; // 'F6'
  saveQuotation: string; // 'F7'
  pay: string; // 'F8'
  hold: string; // 'F9'
  newCart: string; // 'F10'
  reprintLast: string; // 'Ctrl+P'
  showHelp: string; // '?'
}

const DEFAULT_SHORTCUTS: ShortcutMap = {
  search: 'F2',
  customer: 'F3',
  orderDiscount: 'F4',
  heldCarts: 'F5',
  saveDraft: 'F6',
  saveQuotation: 'F7',
  pay: 'F8',
  hold: 'F9',
  newCart: 'F10',
  reprintLast: 'Ctrl+P',
  showHelp: '?',
};

// ---------- Backup & Sync ----------
export interface BackupSettings {
  autoBackup: 'off' | 'daily' | 'on-shift-close';
  cloudProvider: 'none' | 'supabase' | 's3' | 'google-drive';
  cloudConnected: boolean;
  cloudAccount?: string;
  lastLocalBackupAt?: string;
  lastCloudSyncAt?: string;
}

const DEFAULT_BACKUP: BackupSettings = {
  autoBackup: 'on-shift-close',
  cloudProvider: 'none',
  cloudConnected: false,
};

// ---------- Combined Store ----------
interface State {
  business: BusinessInfo;
  taxRates: TaxRate[];
  schemes: InvoiceScheme[];
  receipt: ReceiptTemplate;
  barcode: BarcodeSettings;
  printers: PrinterProfile[];
  appearance: AppearancePrefs;
  pos: POSPrefs;
  cashRegister: CashRegisterPrefs;
  shortcuts: ShortcutMap;
  backup: BackupSettings;

  loading: boolean;
  hydrate: () => Promise<void>;

  setBusiness: (patch: Partial<BusinessInfo>) => void;
  // Tax
  addTaxRate: (data: Omit<TaxRate, 'id'>) => TaxRate;
  updateTaxRate: (id: string, patch: Partial<TaxRate>) => void;
  removeTaxRate: (id: string) => void;
  // Schemes
  updateScheme: (id: string, patch: Partial<InvoiceScheme>) => void;
  addScheme: (data: Omit<InvoiceScheme, 'id'>) => InvoiceScheme;
  removeScheme: (id: string) => void;
  // Receipt
  setReceipt: (patch: Partial<ReceiptTemplate>) => void;
  // Barcode
  setBarcode: (patch: Partial<BarcodeSettings>) => void;
  // Printers
  addPrinter: (data: Omit<PrinterProfile, 'id'>) => PrinterProfile;
  updatePrinter: (id: string, patch: Partial<PrinterProfile>) => void;
  removePrinter: (id: string) => void;
  // Appearance
  setAppearance: (patch: Partial<AppearancePrefs>) => void;
  // POS
  setPOS: (patch: Partial<POSPrefs>) => void;
  // Cash register
  setCashRegister: (patch: Partial<CashRegisterPrefs>) => void;
  // Shortcuts
  setShortcuts: (patch: Partial<ShortcutMap>) => void;
  resetShortcuts: () => void;
  // Backup
  setBackup: (patch: Partial<BackupSettings>) => void;
}

export const useSettings = create<State>()(
  persist(
    (set, get) => {
      /**
       * Write-through helper for device/UI PREFS: optimistically apply the local
       * patch (so the UI + live theme/density effects update instantly), then
       * persist the merged next value to settings_kv under `key`. No rehydrate is
       * needed for prefs — the local copy is authoritative for the session.
       */
      const writePref = <K extends keyof State>(key: string, field: K, next: State[K]) => {
        set({ [field]: next } as Pick<State, K>);
        if (hasBackend())
          void api('settings.set', { key, value: next }).catch((e: unknown) => {
            toast.error(e instanceof Error ? e.message : `Failed to save ${key}`);
          });
      };

      return {
        business: { ...DEFAULT_BUSINESS },
        taxRates: [...DEFAULT_TAX_RATES],
        schemes: [...DEFAULT_SCHEMES],
        receipt: { ...DEFAULT_RECEIPT },
        barcode: { ...DEFAULT_BARCODE },
        printers: [],
        appearance: { ...DEFAULT_APPEARANCE },
        pos: { ...DEFAULT_POS },
        cashRegister: { ...DEFAULT_CASH },
        shortcuts: { ...DEFAULT_SHORTCUTS },
        backup: { ...DEFAULT_BACKUP },

        loading: false,

        /**
         * Hydrate the whole Settings slice from the backend:
         *  - business  ← business.get   (toBusinessInfo)
         *  - taxRates  ← taxRates.list  (toTaxRate)
         *  - prefs     ← settings.getAll keyed by name (fall back to DEFAULT_* per key)
         * No-op without backend (keeps persisted/seed). Pref keys absent from KV
         * keep their existing DEFAULT_* value.
         */
        hydrate: async () => {
          if (!hasBackend()) return;
          set({ loading: true });
          try {
            const [biz, taxes, kv] = await Promise.all([
              api<BackendBusinessInfo | undefined>('business.get', {}),
              api<BackendTaxRate[]>('taxRates.list', {}),
              api<Record<string, unknown>>('settings.getAll', {}),
            ]);

            const patch: Partial<State> = { loading: false };

            if (biz) {
              const mapped = toBusinessInfo(biz);
              // Bridge default_branch_id (id) -> defaultBranch (name) best-effort.
              const branches = useBranches.getState().items;
              const defId = (mapped as { defaultBranchId?: string }).defaultBranchId;
              const defName = defId ? branches.find((b) => b.id === defId)?.name : undefined;
              patch.business = {
                ...DEFAULT_BUSINESS,
                ...mapped,
                defaultBranch: defName ?? get().business.defaultBranch,
              };
            }
            if (Array.isArray(taxes)) patch.taxRates = taxes.map(toTaxRate);

            // Prefs: each KV key overrides its DEFAULT_* only when present.
            if (kv && typeof kv === 'object') {
              if (kv.schemes != null) patch.schemes = kv.schemes as InvoiceScheme[];
              if (kv.receipt != null) patch.receipt = kv.receipt as ReceiptTemplate;
              if (kv.barcode != null) patch.barcode = kv.barcode as BarcodeSettings;
              if (kv.printers != null) patch.printers = kv.printers as PrinterProfile[];
              if (kv.appearance != null) patch.appearance = kv.appearance as AppearancePrefs;
              if (kv.pos != null) patch.pos = kv.pos as POSPrefs;
              if (kv.cashRegister != null) patch.cashRegister = kv.cashRegister as CashRegisterPrefs;
              if (kv.shortcuts != null) patch.shortcuts = kv.shortcuts as ShortcutMap;
              if (kv.backup != null) patch.backup = kv.backup as BackupSettings;
            }

            set(patch);
          } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to load settings');
            set({ loading: false });
          }
        },

        setBusiness: (patch) => {
          // Optimistic local merge so the page reflects the edit immediately.
          set((s) => ({ business: { ...s.business, ...patch } }));
          if (hasBackend()) {
            // Bridge defaultBranch (name) -> default_branch_id (id) best-effort.
            const branches = useBranches.getState().items;
            const defaultBranchId = patch.defaultBranch
              ? branches.find((b) => b.name === patch.defaultBranch)?.id ?? null
              : undefined;
            const merged = get().business;
            void api('business.update', {
              name: merged.name,
              tagline: merged.tagline,
              logoUrl: merged.logoUrl,
              address: merged.address,
              phonePrimary: merged.phonePrimary,
              phoneAlt: merged.phoneAlt,
              email: merged.email,
              website: merged.website,
              vatTin: merged.vatTin,
              binNo: merged.binNo,
              tradeLicenseNo: merged.tradeLicenseNo,
              currencySymbol: merged.currencySymbol,
              currencyPosition: merged.currencyPosition,
              decimalPlaces: merged.decimalPlaces,
              thousandSeparator: merged.thousandSeparator,
              timezone: merged.timezone,
              dateFormat: merged.dateFormat,
              fiscalYearStart: merged.fiscalYearStart,
              defaultLanguage: merged.defaultLanguage,
              ...(defaultBranchId !== undefined ? { defaultBranchId } : {}),
              userId: CURRENT_USER,
            })
              .then(() => get().hydrate())
              .catch((e: unknown) => {
                toast.error(e instanceof Error ? e.message : 'Failed to save business info');
                void get().hydrate();
              });
          }
        },

        addTaxRate: (data) => {
          const item: TaxRate = { id: 'tx_' + Date.now(), ...data };
          if (hasBackend()) {
            void api('taxRates.create', {
              name: data.name,
              percentage: data.percentage,
              isDefault: data.isDefault,
              scope: data.scope,
            })
              .then(() => get().hydrate())
              .catch((e: unknown) => {
                toast.error(e instanceof Error ? e.message : 'Failed to save tax rate');
                void get().hydrate();
              });
            return item;
          }
          set((s) => ({ taxRates: [...s.taxRates, item] }));
          return item;
        },
        updateTaxRate: (id, patch) => {
          if (hasBackend()) {
            void api('taxRates.update', { id, patch })
              .then(() => get().hydrate())
              .catch((e: unknown) => {
                toast.error(e instanceof Error ? e.message : 'Failed to update tax rate');
                void get().hydrate();
              });
            return;
          }
          set((s) => ({ taxRates: s.taxRates.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
        },
        removeTaxRate: (id) => {
          if (hasBackend()) {
            void api('taxRates.delete', { id })
              .then(() => get().hydrate())
              .catch((e: unknown) => {
                toast.error(e instanceof Error ? e.message : 'Failed to delete tax rate');
                void get().hydrate();
              });
            return;
          }
          set((s) => ({ taxRates: s.taxRates.filter((t) => t.id !== id) }));
        },

        // ----- Invoice schemes (KV write-through) -----
        updateScheme: (id, patch) => {
          const next = get().schemes.map((x) => (x.id === id ? { ...x, ...patch } : x));
          writePref('schemes', 'schemes', next);
        },
        addScheme: (data) => {
          const item: InvoiceScheme = { id: 'sch_' + Date.now(), ...data };
          writePref('schemes', 'schemes', [...get().schemes, item]);
          return item;
        },
        removeScheme: (id) => {
          writePref('schemes', 'schemes', get().schemes.filter((x) => x.id !== id));
        },

        setReceipt: (patch) => writePref('receipt', 'receipt', { ...get().receipt, ...patch }),
        setBarcode: (patch) => writePref('barcode', 'barcode', { ...get().barcode, ...patch }),

        // ----- Printers (KV write-through) -----
        addPrinter: (data) => {
          const item: PrinterProfile = { id: 'pr_' + Date.now(), ...data };
          writePref('printers', 'printers', [...get().printers, item]);
          return item;
        },
        updatePrinter: (id, patch) => {
          const next = get().printers.map((p) => (p.id === id ? { ...p, ...patch } : p));
          writePref('printers', 'printers', next);
        },
        removePrinter: (id) => {
          writePref('printers', 'printers', get().printers.filter((p) => p.id !== id));
        },

        setAppearance: (patch) => writePref('appearance', 'appearance', { ...get().appearance, ...patch }),
        setPOS: (patch) => writePref('pos', 'pos', { ...get().pos, ...patch }),
        setCashRegister: (patch) =>
          writePref('cashRegister', 'cashRegister', { ...get().cashRegister, ...patch }),
        setShortcuts: (patch) => writePref('shortcuts', 'shortcuts', { ...get().shortcuts, ...patch }),
        resetShortcuts: () => writePref('shortcuts', 'shortcuts', { ...DEFAULT_SHORTCUTS }),
        setBackup: (patch) => writePref('backup', 'backup', { ...get().backup, ...patch }),
      };
    },
    { name: 'pos-settings' },
  ),
);

// Helper: build a sample invoice number for live preview
export function previewSchemeNumber(s: InvoiceScheme): string {
  const year = new Date().getFullYear();
  const yearStr =
    s.yearFormat === 'YYYY' ? String(year) : s.yearFormat === 'YY' ? String(year).slice(-2) : '';
  const num = String(s.startNumber).padStart(s.counterPadding, '0');
  const parts = [s.prefix];
  if (yearStr) parts.push(yearStr);
  parts.push(num);
  return parts.join(s.separator);
}
