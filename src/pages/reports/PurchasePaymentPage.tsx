import { PaymentsReport, type PaymentRow } from '@/components/reports/PaymentsReport';

/**
 * One `reports.purchasePaymentRows` row — same filter as
 * `reports.purchasePayments`, so the rows add up to the method totals.
 */
interface BackendRow {
  id: string;
  purchase_id: string;
  ref_no: string | null;
  paid_at: string;
  method: string;
  amount: number;
  reference: string | null;
  supplier_name: string;
  user_name: string | null;
}

const mapRow = (r: BackendRow): PaymentRow => ({
  id: r.id,
  date: r.paid_at,
  ref: r.ref_no ?? '—',
  party: r.supplier_name,
  method: r.method,
  amount: r.amount,
  reference: r.reference ?? undefined,
  user: r.user_name ?? '',
});

export default function PurchasePaymentPage() {
  return (
    <PaymentsReport<BackendRow>
      title="Money paid to suppliers"
      summaryChannel="reports.purchasePayments"
      rowsChannel="reports.purchasePaymentRows"
      mapRow={mapRow}
      refHeader="Bill no."
      partyHeader="Supplier"
      userHeader="Paid by"
      searchPlaceholder="Search bill no., supplier or transaction ID…"
    />
  );
}
