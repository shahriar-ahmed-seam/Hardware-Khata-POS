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
  // Editing a FINALIZED invoice rewrites money that has already been taken and
  // stock that has already left the shelf. It is deliberately a SEPARATE, more
  // restricted permission than creating a sale: a cashier who mistypes an amount
  // must not be able to quietly correct it themselves — the owner does that, and
  // the reason is recorded in sale_audit.
  'sales.update': 'sales.edit',
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
  // Archiving is REVERSIBLE and destroys nothing, so it sits with the other
  // catalogue edits rather than behind the Admin-only delete permission — a
  // manager must be able to retire a discontinued line. `products.usage` is a
  // read and stays OPEN so the UI can decide which of the two to offer.
  'products.archive': 'products.edit',
  'products.unarchive': 'products.edit',
  // Recording a new buying price is a catalogue edit. Reads (costHistory /
  // costInfo) stay OPEN like every other read.
  'products.setCost': 'products.edit',
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

  // ----- backup / cloud saving -----
  // `backup.status` is an OPEN read (the Backup screen must be able to render).
  // Everything that writes a file or changes where shop data is copied to is
  // gated behind the dedicated 'settings.backup' permission — a cashier must not
  // be able to redirect snapshots to a folder of their choosing, and exporting
  // CSVs is a bulk data extraction of the entire shop.
  'backup.run': 'settings.backup',
  'backup.configure': 'settings.backup',
  'backup.export': 'settings.backup',
  'backup.verify': 'settings.backup',
  // Restore replaces the live database and relaunches the app — same permission,
  // enforced in electron/ipc.ts where the channel is handled.
  'backup.restore': 'settings.backup',
  'backup.chooseFolder': 'settings.backup',
  'backup.setFolder': 'settings.backup',
  'backup.setPdfFolder': 'settings.backup',
  'backup.folderOptions': 'settings.backup',
  'backup.reveal': 'settings.backup',
  'backup.revealPdfFolder': 'settings.backup',
  // Copying the whole shop database onto a pendrive is a bulk data extraction
  // that physically leaves the building — same permission as redirecting the
  // backup folder, and for the same reason. Listing drives is gated too: it
  // reveals what hardware is plugged into the counter PC.
  'backup.usbDrives': 'settings.backup',
  'backup.toUsb': 'settings.backup',
  // Same act, same permission: a verified copy of the whole shop database written
  // to a folder the owner points at. It exists because removable-drive detection
  // can be blocked by policy on the shop's PC.
  'backup.toFolder': 'settings.backup',

  // ----- performance flags (old hardware) -----
  // These change how the app renders for EVERYONE on that PC and one of them
  // needs a restart, so they are an owner decision, not a personal preference.
  // `perf.get` is gated too: there is nothing useful a cashier can do with it.
  'perf.get': 'settings.business',
  'perf.set': 'settings.business',

  // ----- in-app updates -----
  // `update.state` is an OPEN read so the Updates screen always renders, and so
  // a cashier can SEE which version the shop is running (useful on the phone to
  // the owner). Everything that reaches the network, writes an installer to disk,
  // relaunches the app, or changes whether the app phones home at all is gated:
  // installing software on the shop's till is an owner decision.
  'update.check': 'settings.business',
  'update.download': 'settings.business',
  'update.install': 'settings.business',
  'update.setPrefs': 'settings.business',
  'update.openReleases': 'settings.business',

  // ----- invoice PDFs -----
  // Saving an invoice PDF is part of completing a sale, so it sits behind the
  // same permission as making one — a cashier must be able to do it. Listing and
  // opening an already-saved PDF are reads and stay open.
  'invoice.savePdf': 'sales.create',

  // ----- settings: users + roles -----
  'users.create': 'settings.users',
  'users.update': 'settings.users',
  'users.delete': 'settings.users',
  'roles.create': 'settings.roles',
  'roles.update': 'settings.roles',
  'roles.delete': 'settings.roles',
};
