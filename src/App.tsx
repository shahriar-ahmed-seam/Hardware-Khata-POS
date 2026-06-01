import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { AuthGate } from './components/auth/AuthGate';
import { Toaster } from './components/ui/Toaster';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { useTheme } from './stores/theme';
import { useSettings } from './stores/settings';
import { useUI } from './stores/ui';
import { useAuth } from './stores/auth';

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
import Reports from './pages/Reports';
import ProfitLossPage from './pages/reports/ProfitLossPage';
import ActivityLogPage from './pages/reports/ActivityLogPage';
import ProductSellPage from './pages/reports/ProductSellPage';
import ProductPurchasePage from './pages/reports/ProductPurchasePage';
import SellPaymentPage from './pages/reports/SellPaymentPage';
import PurchasePaymentPage from './pages/reports/PurchasePaymentPage';
import TaxReportPage from './pages/reports/TaxReportPage';
import TrendingPage from './pages/reports/TrendingPage';
import SalesRepPage from './pages/reports/SalesRepPage';
import CustomerGroupPage from './pages/reports/CustomerGroupPage';
import ContactsReportPage from './pages/reports/ContactsReportPage';
import StockReportPage from './pages/reports/StockReportPage';
import StockAlertReportPage from './pages/reports/StockAlertReportPage';
import StockAdjustmentReportPage from './pages/reports/StockAdjustmentReportPage';
import StockTransfersReportPage from './pages/reports/StockTransfersReportPage';
import ItemsReportPage from './pages/reports/ItemsReportPage';
import SMS from './pages/SMS';
import SendSmsPage from './pages/sms/SendSmsPage';
import TemplatesPage from './pages/sms/TemplatesPage';
import GroupsPage from './pages/sms/GroupsPage';
import HistoryPage from './pages/sms/HistoryPage';
import GatewayPage from './pages/sms/GatewayPage';
import BuySmsPage from './pages/sms/BuySmsPage';
import Settings from './pages/Settings';
import BusinessInfoPage from './pages/settings/BusinessInfoPage';
import BranchesPage from './pages/settings/BranchesPage';
import TaxRatesPage from './pages/settings/TaxRatesPage';
import InvoiceSchemesPage from './pages/settings/InvoiceSchemesPage';
import ReceiptTemplatePage from './pages/settings/ReceiptTemplatePage';
import BarcodeSettingsPage from './pages/settings/BarcodeSettingsPage';
import PrintersPage from './pages/settings/PrintersPage';
import AppearancePage from './pages/settings/AppearancePage';
import POSPrefsPage from './pages/settings/POSPrefsPage';
import CashRegisterPrefsPage from './pages/settings/CashRegisterPrefsPage';
import ShortcutsPage from './pages/settings/ShortcutsPage';
import UsersPage from './pages/settings/UsersPage';
import RolesPage from './pages/settings/RolesPage';
import SalesAgentsPage from './pages/settings/SalesAgentsPage';
import BackupPage from './pages/settings/BackupPage';
import CashRegister from './pages/CashRegister';
import RegisterReport from './pages/RegisterReport';
import Placeholder from './pages/Placeholder';

export default function App() {
  const init = useTheme((s) => s.init);
  const appearance = useSettings((s) => s.appearance);
  const setDensity = useUI((s) => s.setDensity);
  const restoreSession = useAuth((s) => s.restoreSession);

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
        <Route path="/sms" element={<SMS />} />
        <Route path="/sms/send" element={<SendSmsPage />} />
        <Route path="/sms/templates" element={<TemplatesPage />} />
        <Route path="/sms/groups" element={<GroupsPage />} />
        <Route path="/sms/history" element={<HistoryPage />} />
        <Route path="/sms/gateway" element={<GatewayPage />} />
        <Route path="/sms/buy" element={<BuySmsPage />} />
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
        <Route path="*" element={<Placeholder title="Not Found" />} />
        </Routes>
      </AppShell>
    </AuthGate>

      {/* Global overlays — mounted at root so they cover auth screens too */}
      <Toaster />
      <ConfirmDialog />
    </>
  );
}
