/**
 * CHANNEL → PERMISSION MAP (IPC permission gate)
 *
 * Maps each WRITE/mutating backend channel to the permission id required to
 * invoke it. The ids match exactly the action ids in ALL_PERMISSIONS
 * (src/stores/users.ts) and the role permission arrays seeded in
 * backend/seed/master.ts.
 *
 * ENFORCEMENT lives in electron/ipc.ts (the IPC boundary), NOT in the backend
 * services or buildApi() — so the Node verify harness (which calls handlers
 * directly) is unaffected and stays at its baseline pass count.
 *
 * RULES
 *  - READS (list / get / dashboard.* / reports.* / search.* / *.openShiftFor /
 *    *.shiftTotals) are intentionally NOT listed → treated as OPEN. The goal is
 *    gating destructive/mutating operations, keeping reads simple and safe.
 *  - Any channel NOT in this map is treated as OPEN (read).
 *  - Admins (role with ALL_PERMISSIONS) satisfy every entry automatically.
 *  - auth.* and session.* channels are ALWAYS allowed (handled in ipc.ts); they
 *    are how a user signs in, so they can never be gated.
 */
export const CHANNEL_PERMISSIONS: Record<string, string> = {
  // ----- sales -----
  'sales.create': 'sales.create',
  'sales.addPayment': 'sales.payment',
  'sales.void': 'sales.void',
  'sales.delete': 'sales.void', // destructive purge of a draft/quotation
  'sellReturns.create': 'sales.return',

  // ----- shipments (logistics tracking; part of the sales workflow) -----
  // Shipment writes are gated behind 'sales.create' — the same role that can
  // sell can record/track a delivery. Reads (shipments.list) stay OPEN.
  'shipments.create': 'sales.create',
  'shipments.update': 'sales.create',
  'shipments.delete': 'sales.create',

  // ----- purchases -----
  'purchases.create': 'purchases.create',
  'purchases.addPayment': 'purchases.payBill',
  'purchases.cancel': 'purchases.edit',
  'purchases.delete': 'purchases.edit',
  'purchaseReturns.create': 'purchases.return',
  'suppliers.pay': 'purchases.payBill',

  // ----- stock operations -----
  'transfers.create': 'stock.transfer',
  'transfers.receive': 'stock.transfer',
  'adjustments.create': 'stock.adjustment',

  // ----- products / catalog -----
  'products.create': 'products.create',
  'products.update': 'products.edit',
  'products.delete': 'products.delete',
  'categories.create': 'products.create',
  'categories.update': 'products.edit',
  'categories.delete': 'products.delete',
  'brands.create': 'products.create',
  'brands.update': 'products.edit',
  'brands.delete': 'products.delete',
  'units.create': 'products.create',
  'units.update': 'products.edit',
  'units.delete': 'products.delete',
  // warranties = product master data → match the catalog (products.*) convention
  'warranties.create': 'products.create',
  'warranties.update': 'products.edit',
  'warranties.delete': 'products.delete',
  // price groups = customer groups → a business-settings concern
  'priceGroups.create': 'settings.business',
  'priceGroups.update': 'settings.business',
  'priceGroups.delete': 'settings.business',

  // ----- contacts -----
  'customers.create': 'contacts.editCustomers',
  'customers.update': 'contacts.editCustomers',
  'customers.delete': 'contacts.editCustomers',
  'suppliers.create': 'contacts.editSuppliers',
  'suppliers.update': 'contacts.editSuppliers',
  'suppliers.delete': 'contacts.editSuppliers',

  // ----- expenses -----
  'expenses.create': 'expenses.create',
  'expenses.update': 'expenses.create',
  'expenses.void': 'expenses.delete',
  'expenses.delete': 'expenses.delete',
  'expenseCategories.create': 'expenses.create',
  'expenseCategories.update': 'expenses.create',
  'expenseCategories.delete': 'expenses.delete',

  // ----- cash register -----
  'cash.openShift': 'cash.openShift',
  'cash.closeShift': 'cash.closeShift',
  'cash.move': 'cash.move',

  // ----- settings: business entities -----
  'business.update': 'settings.business',
  'branches.create': 'settings.business',
  'branches.update': 'settings.business',
  'branches.delete': 'settings.business',
  'branches.setDefault': 'settings.business',
  'taxRates.create': 'settings.business',
  'taxRates.update': 'settings.business',
  'taxRates.delete': 'settings.business',
  'agents.create': 'settings.business',
  'agents.update': 'settings.business',
  'agents.delete': 'settings.business',
  // device/UI preference blobs (appearance/receipt/printers/...) are app-wide
  // settings — gate writes behind the same business-settings permission.
  'settings.set': 'settings.business',

  // ----- settings: users + roles -----
  'users.create': 'settings.users',
  'users.update': 'settings.users',
  'users.delete': 'settings.users',
  'roles.create': 'settings.roles',
  'roles.update': 'settings.roles',
  'roles.delete': 'settings.roles',
};
