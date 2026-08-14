import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { AuthGate } from './components/auth/AuthGate';
import { Toaster } from './components/ui/Toaster';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { PromptDialog } from './components/ui/PromptDialog';
import { useTheme } from './stores/theme';
import { useSettings } from './stores/settings';
import { useUI } from './stores/ui';
import { useAuth } from './stores/auth';
import { useFocusRescue } from './hooks/useFocusRescue';
import { initReduceAnimations } from './lib/perf';
import { applyPersistedLang } from './lib/i18n';

import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Sales from './pages/Sales';
import AddSale from './pages/AddSale';
import Drafts from './pages/Drafts';
import Quotations from './pages/Quotations';
import SellReturns from './pages/SellReturns';
import Shipments from './pages/Shipments';
import ImportSales from './pages/ImportSales';
import Products from './pages/Products';
import ProductEdit from './pages/ProductEdit';
import Categories from './pages/Categories';
import Brands from './pages/Brands';
import Units from './pages/Units';
import Warranties from './pages/Warranties';
import PriceGroups from './pages/PriceGroups';
import BulkPriceUpdate from './pages/BulkPriceUpdate';
import BarcodePrint from './pages/BarcodePrint';
import ImportProducts from './pages/ImportProducts';
import ImportOpeningStock from './pages/ImportOpeningStock';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import CustomerDues from './pages/CustomerDues';
import CustomerGroups from './pages/CustomerGroups';
import ImportCustomers from './pages/ImportCustomers';
import Suppliers from './pages/Suppliers';
import SupplierDetail from './pages/SupplierDetail';
import ImportSuppliers from './pages/ImportSuppliers';
import Purchases from './pages/Purchases';
import AddPurchase from './pages/AddPurchase';
import PurchaseReturns from './pages/PurchaseReturns';
import ImportPurchases from './pages/ImportPurchases';
import Stock from './pages/Stock';
import StockAlerts from './pages/StockAlerts';
import StockTransfers from './pages/StockTransfers';
import AddStockTransfer from './pages/AddStockTransfer';
import StockAdjustments from './pages/StockAdjustments';
import AddStockAdjustment from './pages/AddStockAdjustment';
import Expenses from './pages/Expenses';
import ExpenseCategories from './pages/ExpenseCategories';
import ImportExpenses from './pages/ImportExpenses';
import ImportHub from './pages/ImportHub';
import Reports from './pages/Reports';

/**
 * REPORTS AND SETTINGS ARE LOADED ON DEMAND.
 *
 * These 33 screens were part of the single startup bundle, so the shop's slow PC
 * parsed and compiled every report and every settings form before it could show
 * the dashboard — including the charting library, which only the dashboard
 * widgets and these reports use. None of them is ever the first screen: the app
 * opens on the dashboard or the POS.
 *
 * They are ordinary default exports, so this is purely a change of WHEN the code
 * is fetched. The files themselves are unchanged, and because everything is on
 * the local disk the load is a few milliseconds — the <Suspense> fallback below
 * is barely seen. Frequently used screens (POS, Sales, Products, Contacts) are
 * deliberately left eager: a delay at the counter is not worth the saved memory.
 */
const ProfitLossPage = lazy(() => import('./pages/reports/ProfitLossPage'));
const ActivityLogPage = lazy(() => import('./pages/reports/ActivityLogPage'));
const ProductSellPage = lazy(() => import('./pages/reports/ProductSellPage'));
const ProductPurchasePage = lazy(() => import('./pages/reports/ProductPurchasePage'));
const SellPaymentPage = lazy(() => import('./pages/reports/SellPaymentPage'));
const PurchasePaymentPage = lazy(() => import('./pages/reports/PurchasePaymentPage'));
const TaxReportPage = lazy(() => import('./pages/reports/TaxReportPage'));
const TrendingPage = lazy(() => import('./pages/reports/TrendingPage'));
const SalesRepPage = lazy(() => import('./pages/reports/SalesRepPage'));
const CustomerGroupPage = lazy(() => import('./pages/reports/CustomerGroupPage'));
const ContactsReportPage = lazy(() => import('./pages/reports/ContactsReportPage'));
const StockReportPage = lazy(() => import('./pages/reports/StockReportPage'));
const StockAlertReportPage = lazy(() => import('./pages/reports/StockAlertReportPage'));
const StockAdjustmentReportPage = lazy(() => import('./pages/reports/StockAdjustmentReportPage'));
const StockTransfersReportPage = lazy(() => import('./pages/reports/StockTransfersReportPage'));
const ItemsReportPage = lazy(() => import('./pages/reports/ItemsReportPage'));
// SMS pages are intentionally NOT routed — the whole feature had no backend, so
// its credit balance, delivery status and history were placeholder values. The
// files remain under src/pages/sms/ for whenever a real BD gateway is wired up.
import Settings from './pages/Settings';
const BusinessInfoPage = lazy(() => import('./pages/settings/BusinessInfoPage'));
const BranchesPage = lazy(() => import('./pages/settings/BranchesPage'));
const TaxRatesPage = lazy(() => import('./pages/settings/TaxRatesPage'));
const InvoiceSchemesPage = lazy(() => import('./pages/settings/InvoiceSchemesPage'));
const ReceiptTemplatePage = lazy(() => import('./pages/settings/ReceiptTemplatePage'));
const BarcodeSettingsPage = lazy(() => import('./pages/settings/BarcodeSettingsPage'));
const PrintersPage = lazy(() => import('./pages/settings/PrintersPage'));
const AppearancePage = lazy(() => import('./pages/settings/AppearancePage'));
const POSPrefsPage = lazy(() => import('./pages/settings/POSPrefsPage'));
const CashRegisterPrefsPage = lazy(() => import('./pages/settings/CashRegisterPrefsPage'));
const ShortcutsPage = lazy(() => import('./pages/settings/ShortcutsPage'));
const UsersPage = lazy(() => import('./pages/settings/UsersPage'));
const RolesPage = lazy(() => import('./pages/settings/RolesPage'));
const SalesAgentsPage = lazy(() => import('./pages/settings/SalesAgentsPage'));
const BackupPage = lazy(() => import('./pages/settings/BackupPage'));
const UpdatesPage = lazy(() => import('./pages/settings/UpdatesPage'));
const PerformancePage = lazy(() => import('./pages/settings/PerformancePage'));
import CashRegister from './pages/CashRegister';
import RegisterReport from './pages/RegisterReport';
import Placeholder from './pages/Placeholder';

/**
 * Shown while an on-demand screen is fetched. Deliberately plain: a skeleton that
 * mimics a page the user has not seen yet reads as a rendering glitch, and this
 * is on screen for milliseconds from a local disk.
 */
function RouteLoading() {
  return (
    <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  );
}

export default function App() {
  const init = useTheme((s) => s.init);
  const appearance = useSettings((s) => s.appearance);
  const setDensity = useUI((s) => s.setDensity);
  const restoreSession = useAuth((s) => s.restoreSession);

  // Last-resort guard against a text box that refuses to take the caret. See
  // hooks/useFocusRescue.ts — mounted here so it also covers the login screens.
  useFocusRescue();

  useEffect(() => {
    init();
  }, [init]);

  // Under the Electron backend, the real session lives in the main process and
  // resets on restart. Ask main whether it still holds one and mirror it (or
  // clear the persisted "logged in" hint so the login screen shows). No-op in
  // browser dev (mock keeps the persisted session).
  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  // Re-apply the saved language after a reload. When it is Bangla this starts
  // the whole-UI translation layer (src/lib/bn/).
  useEffect(() => {
    applyPersistedLang();
  }, []);

  // Per-machine performance preference (Settings → Performance). Silent on
  // failure — see src/lib/perf.ts.
  useEffect(() => {
    void initReduceAnimations();
  }, []);

  // Apply persisted appearance on app load and on changes
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary', `${appearance.accentHue} 75% 58%`);
    root.style.setProperty('--ring', `${appearance.accentHue} 75% 58%`);
    root.style.setProperty('--sidebar-accent', `${appearance.accentHue} 75% 58%`);
    root.style.fontSize = `${appearance.fontScale * 16}px`;
    setDensity(appearance.density);
  }, [appearance.accentHue, appearance.fontScale, appearance.density, setDensity]);

  return (
    <>
      <AuthGate>
        <AppShell>
          {/* Boundary for the on-demand report/settings screens above. Everything
              is on the local disk, so this is on screen for a few milliseconds. */}
          <Suspense fallback={<RouteLoading />}>
          <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pos" element={<POS />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/sales/new" element={<AddSale />} />
        <Route path="/sales/import" element={<ImportSales />} />
        <Route path="/sales/drafts" element={<Drafts />} />
        <Route path="/sales/quotations" element={<Quotations />} />
        <Route path="/sales/returns" element={<SellReturns />} />
        <Route path="/sales/shipments" element={<Shipments />} />
        <Route path="/sales/:id/edit" element={<AddSale />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/purchases/new" element={<AddPurchase />} />
        <Route path="/purchases/import" element={<ImportPurchases />} />
        <Route path="/purchases/returns" element={<PurchaseReturns />} />
        <Route path="/purchases/:id/edit" element={<AddPurchase />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/new" element={<ProductEdit />} />
        <Route path="/products/:id" element={<ProductEdit />} />
        <Route path="/products/categories" element={<Categories />} />
        <Route path="/products/brands" element={<Brands />} />
        <Route path="/products/units" element={<Units />} />
        <Route path="/products/variations" element={<Placeholder title="Variations (skipped — use separate SKUs)" />} />
        <Route path="/products/barcodes" element={<BarcodePrint />} />
        <Route path="/products/price-update" element={<BulkPriceUpdate />} />
        <Route path="/products/price-groups" element={<PriceGroups />} />
        <Route path="/products/warranties" element={<Warranties />} />
        <Route path="/products/import" element={<ImportProducts />} />
        <Route path="/products/import-stock" element={<ImportOpeningStock />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/stock/alerts" element={<StockAlerts />} />
        <Route path="/stock/transfers" element={<StockTransfers />} />
        <Route path="/stock/transfers/new" element={<AddStockTransfer />} />
        <Route path="/stock/adjustments" element={<StockAdjustments />} />
        <Route path="/stock/adjustments/new" element={<AddStockAdjustment />} />
        <Route path="/contacts/customers" element={<Customers />} />
        <Route path="/contacts/customers/import" element={<ImportCustomers />} />
        <Route path="/contacts/customers/:id" element={<CustomerDetail />} />
        <Route path="/contacts/suppliers" element={<Suppliers />} />
        <Route path="/contacts/suppliers/import" element={<ImportSuppliers />} />
        <Route path="/contacts/suppliers/:id" element={<SupplierDetail />} />
        <Route path="/contacts/customer-groups" element={<CustomerGroups />} />
        <Route path="/contacts/dues" element={<CustomerDues />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/expenses/categories" element={<ExpenseCategories />} />
        <Route path="/expenses/import" element={<ImportExpenses />} />

        {/* Single hub for every bulk importer (replaces 7 sidebar rows) */}
        <Route path="/import" element={<ImportHub />} />
        <Route path="/cash-register" element={<CashRegister />} />
        <Route path="/cash-register/report" element={<RegisterReport />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/reports/profit-loss" element={<ProfitLossPage />} />
        <Route path="/reports/activity-log" element={<ActivityLogPage />} />
        <Route path="/reports/product-sell" element={<ProductSellPage />} />
        <Route path="/reports/sell-payment" element={<SellPaymentPage />} />
        <Route path="/reports/trending" element={<TrendingPage />} />
        <Route path="/reports/sales-rep" element={<SalesRepPage />} />
        <Route path="/reports/customer-group" element={<CustomerGroupPage />} />
        <Route path="/reports/product-purchase" element={<ProductPurchasePage />} />
        <Route path="/reports/purchase-payment" element={<PurchasePaymentPage />} />
        <Route path="/reports/tax" element={<TaxReportPage />} />
        <Route path="/reports/stock" element={<StockReportPage />} />
        <Route path="/reports/stock-alert" element={<StockAlertReportPage />} />
        <Route path="/reports/stock-adjustment" element={<StockAdjustmentReportPage />} />
        <Route path="/reports/stock-transfers" element={<StockTransfersReportPage />} />
        <Route path="/reports/contacts" element={<ContactsReportPage />} />
        <Route path="/reports/items" element={<ItemsReportPage />} />

        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/business" element={<BusinessInfoPage />} />
        <Route path="/settings/branches" element={<BranchesPage />} />
        <Route path="/settings/tax-rates" element={<TaxRatesPage />} />
        <Route path="/settings/invoice-schemes" element={<InvoiceSchemesPage />} />
        <Route path="/settings/receipt-template" element={<ReceiptTemplatePage />} />
        <Route path="/settings/barcode" element={<BarcodeSettingsPage />} />
        <Route path="/settings/printers" element={<PrintersPage />} />
        <Route path="/settings/appearance" element={<AppearancePage />} />
        <Route path="/settings/pos" element={<POSPrefsPage />} />
        <Route path="/settings/cash-register" element={<CashRegisterPrefsPage />} />
        <Route path="/settings/shortcuts" element={<ShortcutsPage />} />
        <Route path="/settings/users" element={<UsersPage />} />
        <Route path="/settings/roles" element={<RolesPage />} />
        <Route path="/settings/sales-agents" element={<SalesAgentsPage />} />
        <Route path="/settings/backup" element={<BackupPage />} />
        <Route path="/settings/updates" element={<UpdatesPage />} />
        <Route path="/settings/performance" element={<PerformancePage />} />
        <Route path="*" element={<Placeholder title="Not Found" />} />
        </Routes>
          </Suspense>
      </AppShell>
    </AuthGate>

      {/* Global overlays — mounted at root so they cover auth screens too */}
      <Toaster />
      <ConfirmDialog />
      <PromptDialog />
    </>
  );
}
