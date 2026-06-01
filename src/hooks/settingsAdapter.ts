import type { BusinessInfo, TaxRate } from '@/stores/settings';
import type { Branch } from '@/stores/branches';
import type { User, Role, CommissionAgent } from '@/stores/users';

/**
 * Maps backend settings rows (snake_case) into the frontend store shapes that
 * the Settings pages already consume. Mirrors contactAdapter.ts / cashAdapter.ts.
 *
 * SPLIT: only the shared business ENTITIES are adapted here (business_info,
 * branches, tax_rates, users, roles, commission_agents). The device/UI PREFS
 * (appearance/pos/receipt/…) ride through settings_kv as raw JSON blobs and are
 * merged with DEFAULT_* in the settings store — no per-field adapter needed.
 *
 * NOTES
 *  - Users never carry pin_hash / password_hash (queries.listUsers omits them);
 *    `pin` is therefore omitted on read. passwordSet is best-effort false.
 *  - defaultBranch: the backend stores default_branch_id (an id). The
 *    BusinessInfoPage's field is a branch NAME. We surface default_branch_id on
 *    a separate `defaultBranchId` field and bridge id<->name best-effort in the
 *    store hydrate where the branches list is available.
 */

// ---------- business_info ----------
export interface BackendBusinessInfo {
  id: number;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  address: string | null;
  phone_primary: string | null;
  phone_alt: string | null;
  email: string | null;
  website: string | null;
  vat_tin: string | null;
  bin_no: string | null;
  trade_license_no: string | null;
  currency_symbol: string;
  currency_position: string;
  decimal_places: number;
  thousand_separator: string;
  timezone: string;
  date_format: string;
  fiscal_year_start: number;
  default_language: string;
  default_branch_id: string | null;
  updated_at: string;
}

export function toBusinessInfo(b: BackendBusinessInfo): BusinessInfo & { defaultBranchId?: string } {
  return {
    name: b.name,
    tagline: b.tagline ?? undefined,
    logoUrl: b.logo_url ?? undefined,
    address: b.address ?? undefined,
    phonePrimary: b.phone_primary ?? undefined,
    phoneAlt: b.phone_alt ?? undefined,
    email: b.email ?? undefined,
    website: b.website ?? undefined,
    vatTin: b.vat_tin ?? undefined,
    binNo: b.bin_no ?? undefined,
    tradeLicenseNo: b.trade_license_no ?? undefined,
    currencySymbol: b.currency_symbol,
    currencyPosition: (b.currency_position as BusinessInfo['currencyPosition']) ?? 'before',
    decimalPlaces: b.decimal_places,
    thousandSeparator: (b.thousand_separator as BusinessInfo['thousandSeparator']) ?? ',',
    timezone: b.timezone,
    dateFormat: b.date_format,
    fiscalYearStart: b.fiscal_year_start,
    defaultLanguage: (b.default_language as BusinessInfo['defaultLanguage']) ?? 'en',
    // id surfaced separately; the store bridges it to a name via the branches list.
    defaultBranchId: b.default_branch_id ?? undefined,
  };
}

// ---------- tax_rates ----------
export interface BackendTaxRate {
  id: string;
  name: string;
  percentage: number;
  is_default: number;
  scope: string;
  active: number;
}

export function toTaxRate(t: BackendTaxRate): TaxRate {
  return {
    id: t.id,
    name: t.name,
    percentage: t.percentage,
    isDefault: !!t.is_default,
    scope: (t.scope as TaxRate['scope']) ?? 'all',
  };
}

// ---------- branches ----------
export interface BackendBranch {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  phone_primary: string | null;
  phone_alt: string | null;
  manager: string | null;
  is_default: number;
  active: number;
  created_at: string;
}

export function toBranch(b: BackendBranch): Branch {
  return {
    id: b.id,
    name: b.name,
    code: b.code ?? undefined,
    address: b.address ?? undefined,
    phonePrimary: b.phone_primary ?? undefined,
    phoneAlt: b.phone_alt ?? undefined,
    manager: b.manager ?? undefined,
    isDefault: !!b.is_default,
    active: !!b.active,
  };
}

// ---------- users (NO hashes) ----------
export interface BackendUser {
  id: string;
  name: string;
  username: string;
  phone: string | null;
  email: string | null;
  role_id: string;
  branch_ids: string;
  status: string;
  last_login_at: string | null;
}

function parseBranchIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function toUser(u: BackendUser): User {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    phone: u.phone ?? undefined,
    email: u.email ?? undefined,
    // pin omitted on read — hashes are never returned by the backend.
    passwordSet: false,
    roleId: u.role_id,
    branchIds: parseBranchIds(u.branch_ids),
    status: (u.status as User['status']) ?? 'active',
    lastLoginAt: u.last_login_at ?? undefined,
    createdAt: u.last_login_at ?? new Date().toISOString(),
  };
}

// ---------- roles ----------
export interface BackendRole {
  id: string;
  name: string;
  description: string | null;
  is_system: number;
  permissions: string;
}

function parsePermissions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function toRole(r: BackendRole): Role {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    isSystem: !!r.is_system,
    permissions: parsePermissions(r.permissions),
  };
}

// ---------- commission_agents ----------
export interface BackendAgent {
  id: string;
  name: string;
  phone: string | null;
  commission_pct: number;
  active: number;
}

export function toAgent(a: BackendAgent): CommissionAgent {
  return {
    id: a.id,
    name: a.name,
    phone: a.phone ?? undefined,
    commissionPct: a.commission_pct,
    active: !!a.active,
  };
}
