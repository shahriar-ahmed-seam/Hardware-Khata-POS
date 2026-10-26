import { SaleDocList } from '@/components/sales/SaleDocList';

/** `/sales/quotations` — shares its list with Drafts (see SaleDocList). */
export default function Quotations() {
  return <SaleDocList kind="quotation" />;
}
