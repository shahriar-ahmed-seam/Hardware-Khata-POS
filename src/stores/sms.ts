import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ---------- Templates ----------
export type TemplateCategory =
  | 'sale'
  | 'payment'
  | 'reminder'
  | 'promotion'
  | 'greeting'
  | 'other';

export interface SmsTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  body: string; // supports {variables}
  language: 'en' | 'bn';
  active: boolean;
  createdAt: string;
}

export const TEMPLATE_VARIABLES = [
  '{shop_name}',
  '{customer_name}',
  '{phone}',
  '{invoice_no}',
  '{amount}',
  '{due}',
  '{date}',
  '{branch}',
  '{discount}',
] as const;

/**
 * Timestamp used for the built-in starter templates/groups. They are created
 * when the app first loads, so backdating them (the old code claimed 5–60 days
 * ago) would show a fabricated history on a brand-new install.
 */
const INSTALLED_AT = new Date().toISOString();

/**
 * Starter message templates — CONFIGURATION, not sample data: every shop-specific
 * value is a `{placeholder}` filled at send time from real records.
 */
const SEED_TEMPLATES: SmsTemplate[] = [
  {
    id: 'tmpl_thanks',
    name: 'Thank you (Sale)',
    category: 'sale',
    body: 'Dear {customer_name}, thank you for shopping at {shop_name}. Invoice {invoice_no} for ৳{amount}. Visit again!',
    language: 'en',
    active: true,
    createdAt: INSTALLED_AT,
  },
  {
    id: 'tmpl_thanks_bn',
    name: 'ধন্যবাদ (Sale)',
    category: 'sale',
    body: 'প্রিয় {customer_name}, {shop_name}-এ কেনাকাটার জন্য ধন্যবাদ। ইনভয়েস {invoice_no}, মূল্য ৳{amount}। আবার আসবেন।',
    language: 'bn',
    active: true,
    createdAt: INSTALLED_AT,
  },
  {
    id: 'tmpl_payment',
    name: 'Payment received',
    category: 'payment',
    body: 'Payment of ৳{amount} received for {invoice_no}. Outstanding due: ৳{due}. — {shop_name}',
    language: 'en',
    active: true,
    createdAt: INSTALLED_AT,
  },
  {
    id: 'tmpl_due',
    name: 'Due reminder',
    category: 'reminder',
    body: 'Reminder: ৳{due} is outstanding on your account at {shop_name}. Please clear at your earliest convenience.',
    language: 'en',
    active: true,
    createdAt: INSTALLED_AT,
  },
  {
    id: 'tmpl_promo',
    name: 'Eid promo',
    category: 'promotion',
    body: 'Eid Special! {discount}% off all hardware items at {shop_name}. Valid till {date}. Visit our shop today!',
    language: 'en',
    active: true,
    createdAt: INSTALLED_AT,
  },
  {
    id: 'tmpl_birthday',
    name: 'Birthday wish',
    category: 'greeting',
    body: 'Happy Birthday {customer_name}! Thank you for being our valued customer. Enjoy a special discount on your next visit. — {shop_name}',
    language: 'en',
    active: true,
    createdAt: INSTALLED_AT,
  },
];

// ---------- Groups ----------
export interface SmsGroup {
  id: string;
  name: string;
  description?: string;
  memberIds: string[]; // customer ids; backend can join in supplier ids too
  manualNumbers?: string[]; // ad-hoc numbers not in customer table
  createdAt: string;
}

/**
 * Starter segments. These are CONFIGURATION (empty named buckets the shop fills
 * from its own customer list), not sample data — the member lists start empty.
 * The previous defaults claimed fixed members ('cu1','cu2','cu4', …) and a
 * two-month-old creation date, which is invented membership on a new install.
 */
const SEED_GROUPS: SmsGroup[] = [
  {
    id: 'g_all_retail',
    name: 'All Retail Customers',
    description: 'Auto-built from customer group = Retail',
    memberIds: [],
    createdAt: INSTALLED_AT,
  },
  {
    id: 'g_contractors',
    name: 'Contractors',
    description: 'Builders + tradesmen segment',
    memberIds: [],
    createdAt: INSTALLED_AT,
  },
  {
    id: 'g_due',
    name: 'Customers with Due',
    description: 'Auto-built from customer.due > 0',
    memberIds: [],
    createdAt: INSTALLED_AT,
  },
];

// ---------- History ----------
export type SmsStatus = 'queued' | 'sent' | 'delivered' | 'failed';

export interface SmsLogEntry {
  id: string;
  toName?: string;
  toPhone: string;
  body: string;
  templateId?: string;
  groupId?: string;
  status: SmsStatus;
  cost: number; // BDT (per SMS, usually 0.30 - 0.50 in BD)
  parts: number; // 1 per 160 chars (en) or 70 (bn-unicode)
  sentAt: string;
  by: string;
  errorReason?: string;
}

/**
 * Message history starts EMPTY. It previously shipped five invented "sent"
 * messages (fake customer names, invoice numbers and a fake delivery failure),
 * which read as real send history on a brand-new install.
 */
const SEED_HISTORY: SmsLogEntry[] = [];

// ---------- Gateway ----------
export type GatewayProvider =
  | 'none'
  | 'ssl-wireless'
  | 'bulksmsbd'
  | 'zaman-it'
  | 'banglatrac'
  | 'custom';

export interface GatewaySettings {
  provider: GatewayProvider;
  apiUser?: string;
  apiKey?: string; // stored masked in UI; backend keychain in real
  senderId?: string; // approved BD sender ID, e.g. "HARDWAREPOS"
  apiUrl?: string; // for custom provider
  defaultLanguage: 'en' | 'bn';
  unicodeMode: 'auto' | 'always' | 'never';
  maxPartsPerMessage: number;
  testPhoneNumber?: string;
  sendOnSale: boolean;
  sendOnPayment: boolean;
  sendOnDue: boolean;
  sendOnBirthday: boolean;
  connected: boolean;
  lastTestedAt?: string;
}

const DEFAULT_GATEWAY: GatewaySettings = {
  provider: 'none',
  defaultLanguage: 'en',
  unicodeMode: 'auto',
  maxPartsPerMessage: 3,
  sendOnSale: false,
  sendOnPayment: false,
  sendOnDue: false,
  sendOnBirthday: false,
  connected: false,
};

// ---------- Credit ----------
export interface SmsCredit {
  balance: number; // remaining BDT credit
  smsRate: number; // per-SMS rate in BDT
  totalPurchased: number;
  totalSpent: number;
}

// ---------- Combined Store ----------
interface State {
  templates: SmsTemplate[];
  groups: SmsGroup[];
  history: SmsLogEntry[];
  gateway: GatewaySettings;
  credit: SmsCredit;

  // Templates
  addTemplate: (data: Omit<SmsTemplate, 'id' | 'createdAt'>) => SmsTemplate;
  updateTemplate: (id: string, patch: Partial<SmsTemplate>) => void;
  removeTemplate: (id: string) => void;

  // Groups
  addGroup: (data: Omit<SmsGroup, 'id' | 'createdAt'>) => SmsGroup;
  updateGroup: (id: string, patch: Partial<SmsGroup>) => void;
  removeGroup: (id: string) => void;

  // History
  logSend: (entry: Omit<SmsLogEntry, 'id' | 'sentAt'>) => SmsLogEntry;
  retrySend: (id: string) => void;
  clearHistory: () => void;

  // Gateway
  setGateway: (patch: Partial<GatewaySettings>) => void;
  testGateway: () => Promise<{ ok: boolean; message: string }>;

  // Credit
  buyCredit: (bdt: number) => void;
  setCredit: (patch: Partial<SmsCredit>) => void;
}

export const useSms = create<State>()(
  persist(
    (set, get) => ({
      templates: [...SEED_TEMPLATES],
      groups: [...SEED_GROUPS],
      history: SEED_HISTORY,
      gateway: { ...DEFAULT_GATEWAY },
      // No credit until the shop actually buys some. The old defaults claimed a
      // ৳250 balance from ৳500 purchased — invented money on a fresh install.
      // `smsRate` stays as a configuration default (typical BD per-SMS price).
      credit: {
        balance: 0,
        smsRate: 0.4,
        totalPurchased: 0,
        totalSpent: 0,
      },

      addTemplate: (data) => {
        const item: SmsTemplate = {
          id: 'tmpl_' + Date.now(),
          createdAt: new Date().toISOString(),
          ...data,
        };
        set((s) => ({ templates: [item, ...s.templates] }));
        return item;
      },
      updateTemplate: (id, patch) =>
        set((s) => ({
          templates: s.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      removeTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

      addGroup: (data) => {
        const item: SmsGroup = {
          id: 'g_' + Date.now(),
          createdAt: new Date().toISOString(),
          ...data,
        };
        set((s) => ({ groups: [item, ...s.groups] }));
        return item;
      },
      updateGroup: (id, patch) =>
        set((s) => ({ groups: s.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
      removeGroup: (id) => set((s) => ({ groups: s.groups.filter((g) => g.id !== id) })),

      logSend: (entry) => {
        const item: SmsLogEntry = {
          id: 'sms_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          sentAt: new Date().toISOString(),
          ...entry,
        };
        set((s) => ({
          history: [item, ...s.history],
          credit: {
            ...s.credit,
            balance: Math.max(0, s.credit.balance - item.cost),
            totalSpent: s.credit.totalSpent + item.cost,
          },
        }));
        return item;
      },
      retrySend: (id) =>
        set((s) => ({
          history: s.history.map((h) =>
            h.id === id
              ? {
                  ...h,
                  status: 'delivered' as SmsStatus,
                  cost: get().credit.smsRate,
                  errorReason: undefined,
                  sentAt: new Date().toISOString(),
                }
              : h,
          ),
        })),
      clearHistory: () => set({ history: [] }),

      setGateway: (patch) => set((s) => ({ gateway: { ...s.gateway, ...patch } })),
      testGateway: async () => {
        const g = get().gateway;
        if (g.provider === 'none' || !g.apiKey || !g.senderId) {
          return { ok: false, message: 'Configure provider, API key and sender ID first.' };
        }
        // Mock async test
        await new Promise((r) => setTimeout(r, 600));
        set((s) => ({
          gateway: { ...s.gateway, connected: true, lastTestedAt: new Date().toISOString() },
        }));
        return { ok: true, message: 'Gateway connection successful (mock).' };
      },

      buyCredit: (bdt) =>
        set((s) => ({
          credit: {
            ...s.credit,
            balance: s.credit.balance + bdt,
            totalPurchased: s.credit.totalPurchased + bdt,
          },
        })),
      setCredit: (patch) => set((s) => ({ credit: { ...s.credit, ...patch } })),
    }),
    // v2: drops the cached fake send history and the invented ৳250 credit
    // balance that shipped before the mock removal.
    { name: 'pos-sms', version: 2 },
  ),
);

// ---------- Helpers ----------

/** Estimate parts based on Unicode (Bangla) vs GSM-7 (English). */
export function estimateParts(body: string, unicode: boolean): number {
  if (!body) return 0;
  const len = body.length;
  if (unicode) {
    if (len <= 70) return 1;
    return Math.ceil(len / 67);
  }
  if (len <= 160) return 1;
  return Math.ceil(len / 153);
}

/** Detect if message contains characters outside GSM-7 (i.e. needs Unicode). */
export function isUnicode(body: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[^\x00-\x7F]/.test(body);
}

/** Render variables in a template body using a context object. */
export function renderTemplate(body: string, ctx: Record<string, string | number>): string {
  return body.replace(/\{(\w+)\}/g, (_, k) => {
    const v = ctx[k];
    return v === undefined || v === null ? `{${k}}` : String(v);
  });
}
