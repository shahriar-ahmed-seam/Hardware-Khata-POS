import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, hasBackend } from '@/lib/api';
import { toast } from '@/stores/toast';
import {
  toUser,
  toRole,
  toAgent,
  type BackendUser,
  type BackendRole,
  type BackendAgent,
} from '@/hooks/settingsAdapter';

const CURRENT_USER = 'u_admin';

// ---------- Permissions ----------
// Permission groups visible to the user. Each group has actions.
export interface PermissionGroup {
  id: string;
  label: string;
  actions: { id: string; label: string }[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'pos',
    label: 'POS / Checkout',
    actions: [
      { id: 'pos.use', label: 'Open POS screen' },
      { id: 'pos.discount', label: 'Apply order discount' },
      { id: 'pos.priceOverride', label: 'Override line price' },
      { id: 'pos.holdCart', label: 'Hold cart' },
      { id: 'pos.reprint', label: 'Reprint last receipt' },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    actions: [
      { id: 'sales.view', label: 'View sales' },
      { id: 'sales.create', label: 'Create sale' },
      { id: 'sales.edit', label: 'Edit sale' },
      { id: 'sales.void', label: 'Void sale' },
      { id: 'sales.return', label: 'Process return' },
      { id: 'sales.payment', label: 'Receive payment' },
      { id: 'sales.import', label: 'Import sales CSV' },
    ],
  },
  {
    id: 'purchases',
    label: 'Purchases',
    actions: [
      { id: 'purchases.view', label: 'View purchases' },
      { id: 'purchases.create', label: 'Create purchase' },
      { id: 'purchases.edit', label: 'Edit purchase' },
      { id: 'purchases.return', label: 'Process purchase return' },
      { id: 'purchases.payBill', label: 'Pay supplier bill' },
    ],
  },
  {
    id: 'products',
    label: 'Products',
    actions: [
      { id: 'products.view', label: 'View products' },
      { id: 'products.create', label: 'Create product' },
      { id: 'products.edit', label: 'Edit product' },
      { id: 'products.delete', label: 'Delete product' },
      { id: 'products.bulkPrice', label: 'Bulk price update' },
    ],
  },
  {
    id: 'stock',
    label: 'Stock',
    actions: [
      { id: 'stock.view', label: 'View stock' },
      { id: 'stock.transfer', label: 'Stock transfer' },
      { id: 'stock.adjustment', label: 'Stock adjustment' },
    ],
  },
  {
    id: 'contacts',
    label: 'Contacts',
    actions: [
      { id: 'contacts.viewCustomers', label: 'View customers' },
      { id: 'contacts.editCustomers', label: 'Edit customers' },
      { id: 'contacts.viewSuppliers', label: 'View suppliers' },
      { id: 'contacts.editSuppliers', label: 'Edit suppliers' },
    ],
  },
  {
    id: 'expenses',
    label: 'Expenses',
    actions: [
      { id: 'expenses.view', label: 'View expenses' },
      { id: 'expenses.create', label: 'Create expense' },
      { id: 'expenses.delete', label: 'Delete expense' },
    ],
  },
  {
    id: 'cash',
    label: 'Cash Register',
    actions: [
      { id: 'cash.openShift', label: 'Open shift' },
      { id: 'cash.closeShift', label: 'Close shift' },
      { id: 'cash.move', label: 'Cash in / out' },
      { id: 'cash.zReport', label: 'View Z-Report' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    actions: [
      { id: 'reports.view', label: 'View reports' },
      { id: 'reports.export', label: 'Export reports' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    actions: [
      { id: 'settings.business', label: 'Edit business info' },
      { id: 'settings.users', label: 'Manage users' },
      { id: 'settings.roles', label: 'Manage roles' },
      { id: 'settings.devices', label: 'Manage printers / devices' },
      { id: 'settings.backup', label: 'Backup / restore' },
    ],
  },
];

export const ALL_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap((g) =>
  g.actions.map((a) => a.id),
);

// ---------- Roles ----------
export interface Role {
  id: string;
  name: string;
  description?: string;
  isSystem?: boolean; // built-in (cannot be deleted, can be edited)
  permissions: string[]; // list of permission action ids
}

const SYSTEM_ROLES: Role[] = [
  {
    id: 'role_admin',
    name: 'Admin',
    description: 'Full access — owner / shop manager',
    isSystem: true,
    permissions: ALL_PERMISSIONS,
  },
  {
    id: 'role_manager',
    name: 'Manager',
    description: 'Day-to-day operations, no destructive settings',
    isSystem: true,
    permissions: ALL_PERMISSIONS.filter(
      (p) => !['settings.users', 'settings.roles', 'settings.backup', 'products.delete'].includes(p),
    ),
  },
  {
    id: 'role_cashier',
    name: 'Cashier',
    description: 'POS-focused: checkout, returns, basic customer lookup',
    isSystem: true,
    permissions: [
      'pos.use',
      'pos.holdCart',
      'pos.reprint',
      'sales.view',
      'sales.create',
      'sales.return',
      'sales.payment',
      'products.view',
      'stock.view',
      'contacts.viewCustomers',
      'contacts.editCustomers',
      'cash.openShift',
      'cash.closeShift',
      'cash.move',
      'cash.zReport',
    ],
  },
  {
    id: 'role_stockkeeper',
    name: 'Stock Keeper',
    description: 'Receives stock, transfers, and adjusts inventory',
    isSystem: true,
    permissions: [
      'products.view',
      'products.create',
      'products.edit',
      'stock.view',
      'stock.transfer',
      'stock.adjustment',
      'purchases.view',
      'purchases.create',
      'contacts.viewSuppliers',
    ],
  },
];

// ---------- Users ----------
export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface User {
  id: string;
  name: string;
  username: string; // login handle
  phone?: string;
  email?: string;
  pin?: string; // 4-6 digit cashier PIN (mock)
  passwordSet?: boolean;
  roleId: string;
  branchIds: string[]; // branches the user can operate at; empty = all
  status: UserStatus;
  lastLoginAt?: string; // ISO
  createdAt: string;
}

const SEED_USERS: User[] = [
  {
    id: 'u_admin',
    name: 'Seam',
    username: 'seam',
    phone: '01711-000001',
    email: 'owner@hardwarepos.local',
    pin: '1234',
    passwordSet: true,
    roleId: 'role_admin',
    branchIds: [],
    status: 'active',
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'u_faruq',
    name: 'Faruq Hossain',
    username: 'faruq',
    phone: '01711-000002',
    pin: '4321',
    passwordSet: true,
    roleId: 'role_manager',
    branchIds: ['br_ut'],
    status: 'active',
    lastLoginAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 200 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'u_rana',
    name: 'Rana Ahmed',
    username: 'rana',
    phone: '01711-000003',
    pin: '1111',
    passwordSet: true,
    roleId: 'role_cashier',
    branchIds: ['br_mp'],
    status: 'active',
    lastLoginAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'u_rashed',
    name: 'Rashed Khan',
    username: 'rashed',
    phone: '01711-000004',
    pin: '2222',
    passwordSet: true,
    roleId: 'role_stockkeeper',
    branchIds: ['br_mp', 'br_ut'],
    status: 'active',
    lastLoginAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 120 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'u_arif',
    name: 'Arif Mia',
    username: 'arif',
    phone: '01711-000005',
    roleId: 'role_cashier',
    branchIds: ['br_dh'],
    status: 'inactive',
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  },
];

// ---------- Sales Commission Agents (placeholder) ----------
export interface CommissionAgent {
  id: string;
  name: string;
  phone?: string;
  commissionPct: number;
  active?: boolean;
}

interface State {
  loading: boolean;
  hydrate: () => Promise<void>;

  // Roles
  roles: Role[];
  addRole: (data: Omit<Role, 'id' | 'isSystem'>) => Role;
  updateRole: (id: string, patch: Partial<Role>) => void;
  removeRole: (id: string) => void;
  toggleRolePermission: (roleId: string, permId: string) => void;
  setRolePermissions: (roleId: string, perms: string[]) => void;

  // Users
  users: User[];
  addUser: (data: Omit<User, 'id' | 'createdAt'>) => User;
  updateUser: (id: string, patch: Partial<User>) => void;
  removeUser: (id: string) => void;

  // Commission agents
  agents: CommissionAgent[];
  addAgent: (data: Omit<CommissionAgent, 'id'>) => CommissionAgent;
  updateAgent: (id: string, patch: Partial<CommissionAgent>) => void;
  removeAgent: (id: string) => void;
}

export const useUsers = create<State>()(
  persist(
    (set, get) => ({
      loading: false,

      /**
       * Load users, roles, and agents from the backend in one pass. No-op without
       * backend (keeps persisted/seed). SYSTEM_ROLES/PERMISSION_GROUPS stay static
       * metadata — only the live `roles` rows come from the backend.
       */
      hydrate: async () => {
        if (!hasBackend()) return;
        set({ loading: true });
        try {
          const [users, roles, agents] = await Promise.all([
            api<BackendUser[]>('users.list', {}),
            api<BackendRole[]>('roles.list', {}),
            api<BackendAgent[]>('agents.list', {}),
          ]);
          set({
            users: users.map(toUser),
            roles: roles.map(toRole),
            agents: agents.map(toAgent),
            loading: false,
          });
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Failed to load users');
          set({ loading: false });
        }
      },

      roles: hasBackend() ? [] : [...SYSTEM_ROLES],
      addRole: (data) => {
        const item: Role = { id: 'role_' + Date.now(), ...data };
        if (hasBackend()) {
          void api('roles.create', {
            name: data.name,
            description: data.description,
            permissions: data.permissions ?? [],
          })
            .then(() => get().hydrate())
            .catch((e: unknown) => {
              toast.error(e instanceof Error ? e.message : 'Failed to save role');
              void get().hydrate();
            });
          return item;
        }
        set((s) => ({ roles: [...s.roles, item] }));
        return item;
      },
      updateRole: (id, patch) => {
        if (hasBackend()) {
          void api('roles.update', {
            id,
            patch: {
              name: patch.name,
              description: patch.description,
              permissions: patch.permissions,
            },
          })
            .then(() => get().hydrate())
            .catch((e: unknown) => {
              toast.error(e instanceof Error ? e.message : 'Failed to update role');
              void get().hydrate();
            });
          return;
        }
        set((s) => ({
          roles: s.roles.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        }));
      },
      removeRole: (id) => {
        if (hasBackend()) {
          void api('roles.delete', { id })
            .then(() => get().hydrate())
            .catch((e: unknown) => {
              toast.error(e instanceof Error ? e.message : 'Failed to delete role');
              void get().hydrate();
            });
          return;
        }
        set((s) => ({ roles: s.roles.filter((r) => r.id !== id || r.isSystem) }));
      },
      toggleRolePermission: (roleId, permId) => {
        // Role permission edits persist the FULL permissions array via roles.update.
        const role = get().roles.find((r) => r.id === roleId);
        if (!role) return;
        const next = role.permissions.includes(permId)
          ? role.permissions.filter((p) => p !== permId)
          : [...role.permissions, permId];
        get().setRolePermissions(roleId, next);
      },
      setRolePermissions: (roleId, perms) => {
        if (hasBackend()) {
          void api('roles.update', { id: roleId, patch: { permissions: perms } })
            .then(() => get().hydrate())
            .catch((e: unknown) => {
              toast.error(e instanceof Error ? e.message : 'Failed to update permissions');
              void get().hydrate();
            });
          return;
        }
        set((s) => ({
          roles: s.roles.map((r) => (r.id === roleId ? { ...r, permissions: perms } : r)),
        }));
      },

      users: hasBackend() ? [] : [...SEED_USERS],
      addUser: (data) => {
        const item: User = {
          id: 'u_' + Date.now(),
          createdAt: new Date().toISOString(),
          ...data,
        };
        if (hasBackend()) {
          // NOTE: optimistic id; the real backend id arrives after rehydrate.
          void api('users.create', {
            name: data.name,
            username: data.username,
            phone: data.phone,
            email: data.email,
            pin: data.pin,
            roleId: data.roleId,
            branchIds: data.branchIds,
            status: data.status,
            lastLoginAt: data.lastLoginAt,
          })
            .then(() => get().hydrate())
            .catch((e: unknown) => {
              toast.error(e instanceof Error ? e.message : 'Failed to save user');
              void get().hydrate();
            });
          return item;
        }
        set((s) => ({ users: [...s.users, item] }));
        return item;
      },
      updateUser: (id, patch) => {
        if (hasBackend()) {
          void api('users.update', {
            id,
            patch: {
              name: patch.name,
              username: patch.username,
              phone: patch.phone,
              email: patch.email,
              pin: patch.pin,
              roleId: patch.roleId,
              branchIds: patch.branchIds,
              status: patch.status,
              lastLoginAt: patch.lastLoginAt,
            },
          })
            .then(() => get().hydrate())
            .catch((e: unknown) => {
              toast.error(e instanceof Error ? e.message : 'Failed to update user');
              void get().hydrate();
            });
          return;
        }
        set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
      },
      removeUser: (id) => {
        if (hasBackend()) {
          void api('users.delete', { id })
            .then(() => get().hydrate())
            .catch((e: unknown) => {
              toast.error(e instanceof Error ? e.message : 'Failed to delete user');
              void get().hydrate();
            });
          return;
        }
        set((s) => ({ users: s.users.filter((u) => u.id !== id) }));
      },

      agents: hasBackend()
        ? []
        : [
            { id: 'ag_1', name: 'Hassan (Field)', phone: '01711-100001', commissionPct: 2, active: true },
          ],
      addAgent: (data) => {
        const item: CommissionAgent = { id: 'ag_' + Date.now(), active: true, ...data };
        if (hasBackend()) {
          void api('agents.create', {
            name: data.name,
            phone: data.phone,
            commissionPct: data.commissionPct,
            active: data.active,
          })
            .then(() => get().hydrate())
            .catch((e: unknown) => {
              toast.error(e instanceof Error ? e.message : 'Failed to save agent');
              void get().hydrate();
            });
          return item;
        }
        set((s) => ({ agents: [...s.agents, item] }));
        return item;
      },
      updateAgent: (id, patch) => {
        if (hasBackend()) {
          void api('agents.update', { id, patch })
            .then(() => get().hydrate())
            .catch((e: unknown) => {
              toast.error(e instanceof Error ? e.message : 'Failed to update agent');
              void get().hydrate();
            });
          return;
        }
        set((s) => ({
          agents: s.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        }));
      },
      removeAgent: (id) => {
        if (hasBackend()) {
          void api('agents.delete', { id })
            .then(() => get().hydrate())
            .catch((e: unknown) => {
              toast.error(e instanceof Error ? e.message : 'Failed to delete agent');
              void get().hydrate();
            });
          return;
        }
        set((s) => ({ agents: s.agents.filter((a) => a.id !== id) }));
      },
    }),
    { name: 'pos-users' },
  ),
);

// helper
export function getRoleById(roles: Role[], id: string): Role | undefined {
  return roles.find((r) => r.id === id);
}
