import type { DB } from './db/connection.ts';
import * as q from './services/queries.ts';
import * as sales from './services/sales.ts';
import * as purchases from './services/purchases.ts';
import * as returns from './services/returns.ts';
import * as shipments from './services/shipments.ts';
import * as stockOps from './services/stockOps.ts';
import * as expenses from './services/expenses.ts';
import * as cash from './services/cash.ts';
import * as dashboard from './services/dashboard.ts';
import * as reports from './services/reports.ts';
import * as catalog from './services/catalog.ts';
import * as contacts from './services/contacts.ts';
import * as settings from './services/settings.ts';
import * as auth from './services/auth.ts';
import * as setup from './services/setup.ts';

/**
 * The backend API surface. A flat map of `channel -> handler(db, payload)`.
 * The Electron IPC layer simply forwards each channel to these handlers; tests
 * can call them directly. Keeps transport (IPC) separate from logic.
 */
export type ApiHandler = (db: DB, payload: any) => unknown;

export function buildApi(): Record<string, ApiHandler> {
  return {
    // ----- reads: lists / details -----
    'products.list': (db, p) => q.listProducts(db, p ?? {}),
    'products.get': (db, p) => q.getProduct(db, p.id, p.branchId),
    'sales.list': (db, p) => q.listSales(db, p ?? {}),
    'sales.get': (db, p) => q.getSale(db, p.id),
    'purchases.list': (db, p) => q.listPurchases(db, p ?? {}),
    'purchases.get': (db, p) => q.getPurchase(db, p.id),
    'sellReturns.list': (db, p) => q.listSellReturns(db, p ?? {}),
    'purchaseReturns.list': (db) => q.listPurchaseReturns(db),
    'shipments.list': (db, p) => q.listShipments(db, p ?? {}),
    'customers.list': (db, p) => q.listCustomers(db, p ?? {}),
    'customers.get': (db, p) => q.getCustomer(db, p.id),
    'suppliers.list': (db, p) => q.listSuppliers(db, p ?? {}),
    'suppliers.get': (db, p) => q.getSupplier(db, p.id),
    'expenses.list': (db, p) => q.listExpenses(db, p ?? {}),
    'expenseCategories.list': (db) => q.listExpenseCategories(db),
    'transfers.list': (db) => q.listTransfers(db),
    'adjustments.list': (db) => q.listAdjustments(db),
    'shifts.list': (db, p) => q.listShifts(db, p ?? {}),
    'shifts.movements': (db, p) => q.getShiftMovements(db, p.shiftId),
    'branches.list': (db) => q.listBranches(db),
    'categories.list': (db) => q.listCategories(db),
    'brands.list': (db) => q.listBrands(db),
    'units.list': (db) => q.listUnits(db),
    'warranties.list': (db) => q.listWarranties(db),
    'priceGroups.list': (db) => q.listPriceGroups(db),
    'taxRates.list': (db) => q.listTaxRates(db),
    'users.list': (db) => q.listUsers(db),
    'roles.list': (db) => q.listRoles(db),
    'agents.list': (db) => q.listAgents(db),
    'business.get': (db) => q.getBusinessInfo(db),
    'search.global': (db, p) => q.globalSearch(db, p.query, p.scope),

    // ----- writes: operations -----
    'sales.create': (db, p) => sales.createSale(db, p),
    'sales.addPayment': (db, p) => sales.addSalePayment(db, p.saleId, p.payment, p.userId),
    'sales.void': (db, p) => sales.voidSale(db, p.saleId, p.userId, p.reason),
    'sales.delete': (db, p) => sales.deleteSale(db, p.saleId),
    'purchases.create': (db, p) => purchases.createPurchase(db, p),
    'purchases.addPayment': (db, p) => purchases.addPurchasePayment(db, p.purchaseId, p.payment, p.userId),
    'purchases.cancel': (db, p) => purchases.cancelPurchase(db, p.purchaseId, p.userId, p.reason),
    'purchases.delete': (db, p) => purchases.deletePurchase(db, p.purchaseId),
    'sellReturns.create': (db, p) => returns.createSellReturn(db, p),
    'purchaseReturns.create': (db, p) => returns.createPurchaseReturn(db, p),
    'shipments.create': (db, p) => shipments.createShipment(db, p),
    'shipments.update': (db, p) => shipments.updateShipment(db, p.id, p.patch),
    'shipments.delete': (db, p) => shipments.deleteShipment(db, p.id),
    'transfers.create': (db, p) => stockOps.createTransfer(db, p),
    'transfers.receive': (db, p) => stockOps.receiveTransfer(db, p.transferId, p.received, p.userId, p.note),
    'adjustments.create': (db, p) => stockOps.createAdjustment(db, p),
    'expenses.create': (db, p) => expenses.createExpense(db, p),
    'expenses.update': (db, p) => expenses.updateExpense(db, p.id, p.patch),
    'expenses.void': (db, p) => expenses.voidExpense(db, p.id, p.reason, p.userId),
    'expenses.delete': (db, p) => expenses.deleteExpense(db, p.id),
    'expenseCategories.create': (db, p) => expenses.createExpenseCategory(db, p),
    'expenseCategories.update': (db, p) => expenses.updateExpenseCategory(db, p.id, p.patch),
    'expenseCategories.delete': (db, p) => expenses.deleteExpenseCategory(db, p.id),
    'cash.openShift': (db, p) => cash.openShift(db, p),
    'cash.closeShift': (db, p) => cash.closeShift(db, p),
    'cash.move': (db, p) => cash.recordCashMovement(db, p),
    'cash.openShiftFor': (db, p) => cash.getOpenShift(db, p.branchId),
    'cash.shiftTotals': (db, p) => cash.shiftTotals(db, p.shiftId),

    // ----- catalog CRUD -----
    'products.create': (db, p) => catalog.createProduct(db, p),
    'products.update': (db, p) => catalog.updateProduct(db, p.id, p.patch),
    'products.delete': (db, p) => catalog.deleteProduct(db, p.id),
    'categories.create': (db, p) => catalog.createCategory(db, p),
    'categories.update': (db, p) => catalog.updateCategory(db, p.id, p.patch),
    'categories.delete': (db, p) => catalog.deleteCategory(db, p.id),
    'brands.create': (db, p) => catalog.createBrand(db, p),
    'brands.update': (db, p) => catalog.updateBrand(db, p.id, p.patch),
    'brands.delete': (db, p) => catalog.deleteBrand(db, p.id),
    'units.create': (db, p) => catalog.createUnit(db, p),
    'units.update': (db, p) => catalog.updateUnit(db, p.id, p.patch),
    'units.delete': (db, p) => catalog.deleteUnit(db, p.id),
    'warranties.create': (db, p) => catalog.createWarranty(db, p),
    'warranties.update': (db, p) => catalog.updateWarranty(db, p.id, p.patch),
    'warranties.delete': (db, p) => catalog.deleteWarranty(db, p.id),
    'priceGroups.create': (db, p) => catalog.createPriceGroup(db, p),
    'priceGroups.update': (db, p) => catalog.updatePriceGroup(db, p.id, p.patch),
    'priceGroups.delete': (db, p) => catalog.deletePriceGroup(db, p.id),

    // ----- contacts CRUD (customers + suppliers) -----
    'customers.create': (db, p) => contacts.createCustomer(db, p),
    'customers.update': (db, p) => contacts.updateCustomer(db, p.id, p.patch),
    'customers.delete': (db, p) => contacts.deleteCustomer(db, p.id),
    'suppliers.create': (db, p) => contacts.createSupplier(db, p),
    'suppliers.update': (db, p) => contacts.updateSupplier(db, p.id, p.patch),
    'suppliers.delete': (db, p) => contacts.deleteSupplier(db, p.id),
    'suppliers.pay': (db, p) => contacts.paySupplier(db, p),

    // ----- settings: business entities (business/branches/tax/agents/users/roles) -----
    'business.update': (db, p) => settings.updateBusinessInfo(db, p),
    'branches.create': (db, p) => settings.createBranch(db, p),
    'branches.update': (db, p) => settings.updateBranch(db, p.id, p.patch),
    'branches.delete': (db, p) => settings.deleteBranch(db, p.id),
    'branches.setDefault': (db, p) => settings.setDefaultBranch(db, p.id),
    'taxRates.create': (db, p) => settings.createTaxRate(db, p),
    'taxRates.update': (db, p) => settings.updateTaxRate(db, p.id, p.patch),
    'taxRates.delete': (db, p) => settings.deleteTaxRate(db, p.id),
    'agents.create': (db, p) => settings.createAgent(db, p),
    'agents.update': (db, p) => settings.updateAgent(db, p.id, p.patch),
    'agents.delete': (db, p) => settings.deleteAgent(db, p.id),
    'users.create': (db, p) => settings.createUser(db, p),
    'users.update': (db, p) => settings.updateUser(db, p.id, p.patch),
    'users.delete': (db, p) => settings.deleteUser(db, p.id),
    'roles.create': (db, p) => settings.createRole(db, p),
    'roles.update': (db, p) => settings.updateRole(db, p.id, p.patch),
    'roles.delete': (db, p) => settings.deleteRole(db, p.id),

    // ----- settings: generic device/UI prefs via settings_kv -----
    'settings.get': (db, p) => settings.getSetting(db, p.key),
    'settings.set': (db, p) => settings.setSetting(db, p.key, p.value),
    'settings.getAll': (db) => settings.getAllSettings(db),

    // ----- auth: credential verification (returns sanitized data only, NO hashes) -----
    // NOTE: these handlers VERIFY credentials but do NOT establish/enforce a
    // session. The Electron IPC layer (electron/ipc.ts) owns the session and
    // permission gate; keeping these pure lets the Node harness call them.
    'auth.authenticate': (db, p) => auth.authenticate(db, p),
    'auth.verifyPin': (db, p) => auth.verifyUserPin(db, p.userId, p.pin),
    'auth.setSecret': (db, p) => auth.setUserSecret(db, p.userId, { pin: p.pin, password: p.password }),

    // ----- first-run setup: the single run-once bootstrap write-through -----
    // `setup.complete` performs ALL first-run writes in one transaction and
    // returns the sanitized admin + permissions. `setup.status` reports the
    // run-once latch. The Electron IPC layer allows these pre-session only while
    // setup has not completed (see electron/ipc.ts) — once done, the channel is
    // self-disabling (completeSetup throws 'Setup already completed').
    'setup.status': (db) => setup.setupStatus(db),
    'setup.complete': (db, p) => setup.completeSetup(db, p),

    // ----- aggregations -----
    'dashboard.stats': (db, p) => dashboard.getStats(db, p.range, p.branchId),
    'dashboard.hourlySales': (db, p) => dashboard.hourlySales(db, p.range, p.branchId),
    'dashboard.salesTrend': (db, p) => dashboard.salesTrend(db, p.days ?? 30, p.branchId),
    'dashboard.topProducts': (db, p) => dashboard.topProducts(db, p.range, p.limit ?? 10, p.branchId),
    'dashboard.recentSales': (db, p) => dashboard.recentSales(db, p.limit ?? 10, p.branchId),
    'dashboard.recentPurchases': (db, p) => dashboard.recentPurchases(db, p.limit ?? 8, p.branchId),
    'dashboard.lowStock': (db, p) => dashboard.lowStock(db, p.branchId, p.limit ?? 50),
    'dashboard.paymentBreakdown': (db, p) => dashboard.paymentMethodBreakdown(db, p.range, p.branchId),
    'dashboard.expenseBreakdown': (db, p) => dashboard.expenseBreakdown(db, p.range, p.branchId),
    'dashboard.topCustomers': (db, p) => dashboard.topCustomers(db, p.range, p.limit ?? 5, p.branchId),
    'dashboard.salesVsPurchaseVsExpense': (db, p) => dashboard.salesVsPurchaseVsExpense(db, p.months ?? 6, p.branchId),
    'dashboard.activityFeed': (db, p) => dashboard.activityFeed(db, p.limit ?? 20, p.branchId),
    'dashboard.birthdays': (db, p) => dashboard.birthdays(db, p.daysAhead ?? 7),

    'reports.profitLoss': (db, p) => reports.profitLoss(db, p.range, p.branchId),
    'reports.productSell': (db, p) => reports.productSell(db, p.range, p.branchId),
    'reports.productPurchase': (db, p) => reports.productPurchase(db, p.range, p.branchId),
    'reports.sellPayments': (db, p) => reports.sellPayments(db, p.range, p.branchId),
    'reports.purchasePayments': (db, p) => reports.purchasePayments(db, p.range, p.branchId),
    'reports.tax': (db, p) => reports.taxReport(db, p.range, p.branchId),
    'reports.trending': (db, p) => reports.trending(db, p.range, p.metric ?? 'qty', p.branchId),
    'reports.salesRep': (db, p) => reports.salesRep(db, p.range, p.branchId),
    'reports.customerGroup': (db, p) => reports.customerGroup(db, p.range, p.branchId),
    'reports.stock': (db, p) => reports.stockReport(db, p.branchId),
  };
}

export const API_CHANNELS = Object.keys(buildApi());
