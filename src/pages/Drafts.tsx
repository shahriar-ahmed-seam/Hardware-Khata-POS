import { SaleDocList } from '@/components/sales/SaleDocList';

/** `/sales/drafts` — shares its list with Quotations (see SaleDocList). */
export default function Drafts() {
  return <SaleDocList kind="draft" />;
}
