import { PaymentsReport, type PaymentRow } from '@/components/reports/PaymentsReport';

/**
 * One `reports.sellPaymentRows` row. The rows come from SQL over the whole
 * range with the same filter as `reports.sellPayments`, so they add up to the
 * method totals (asserted by the verification suite).
 */
interface BackendRow {
  id: string;
  sale_id: string;
  invoice_no: string;
  paid_at: string;
  method: string;
  amount: number;
  reference: string | null;
  customer_name: string;
  user_name: string | null;
}

const mapRow = (r: BackendRow): PaymentRow => ({
  id: r.id,
  date: r.paid_at,
  ref: r.invoice_no,
  party: r.customer_name,
  method: r.method,
  amount: r.amount,
  reference: r.reference ?? undefined,
  user: r.user_name ?? '',
});

/** Money collected — the end-of-day question, so it opens on Today. */
export default function SellPaymentPage() {
  return (
    <PaymentsReport<BackendRow>
      title="Money collected"
      summaryChannel="reports.sellPayments"
      rowsChannel="reports.sellPaymentRows"
      mapRow={mapRow}
      refHeader="Invoice"
      partyHeader="Customer"
      userHeader="Cashier"
      searchPlaceholder="Search invoice, customer or transaction ID…"
      defaultRange={{ preset: 'today' }}
    />
  );
}
