import type { Customer } from '@/types/domain';
import { computeTotals, unitPrice, type ParkedCart } from './types';
import { formatBDT } from '@/lib/utils';
import { useSettings } from '@/stores/settings';
import { useBranches } from '@/stores/branches';
import type { PaymentResult } from './PaymentModal';

interface Props {
  invoiceNo: string;
  cart: ParkedCart;
  payment: PaymentResult;
  /** Resolved customer from the backend customers list, supplied by the caller.
   *  When omitted the invoice prints the walk-in label — no lookup, no seed data. */
  customer?: Customer;
  /** Who rang the sale. Printed as "Served by" when the setting is on. */
  cashierName?: string;
  /**
   * The invoice's own date/time (ISO). Defaults to NOW, which is right for a
   * receipt printed at the moment of sale — but wrong for re-printing an old
   * one, where printing today's date on last week's invoice is a factual error
   * the customer is then holding.
   */
  dateISO?: string;
  /** Optional explicit override; when omitted the identity is read from settings. */
  business?: {
    name: string;
    line2: string;
    phones: string;
    branchName: string;
    posLabel: string;
  };
}

/**
 * Print-friendly invoice. White background, dark text, no theme tokens —
 * keeps it consistent on print regardless of app theme.
 *
 * Business identity + the optional sections (logo / header lines / footer
 * lines / customer phone+address / amount-in-words / payment ref / barcode)
 * are sourced live from the Settings store (`business` + `receipt` template),
 * or from an explicit `business` prop when the caller supplies one. The
 * hard-coded placeholder identity was removed: anything missing from settings
 * simply does not print.
 */
export function Receipt({
  invoiceNo,
  cart,
  payment,
  customer: customerProp,
  cashierName,
  business: businessProp,
  dateISO,
}: Props) {
  const settingsBusiness = useSettings((s) => s.business);
  const receipt = useSettings((s) => s.receipt);
  const branches = useBranches((s) => s.items);
  const activeBranch =
    branches.find((b) => b.isDefault) ?? branches.find((b) => b.active) ?? branches[0];
  const branchName = activeBranch?.name ?? settingsBusiness.defaultBranch ?? '';

  // Printed identity comes from settings (or the explicit prop). Empty fields
  // are omitted below rather than replaced with placeholder text.
  const phones = [settingsBusiness.phonePrimary, settingsBusiness.phoneAlt].filter(Boolean).join(', ');
  const business =
    businessProp ?? {
      name: settingsBusiness.name?.trim() ?? '',
      line2: settingsBusiness.address ?? '',
      phones,
      branchName,
      // Just the branch's own name. The old `POS - ${branchName}` prefix was
      // hard-coded, so a shop could neither reword nor remove it.
      posLabel: branchName,
    };

  // Blank lines are dropped so an "empty" footer prints nothing at all.
  const footerLines = receipt.footerLines.filter((l) => l.trim());

  // Customer is whatever the caller resolved from the backend list; no lookup fallback.
  const customer = customerProp;
  const totals = computeTotals(cart);
  // An explicit invoice date wins; otherwise this is a receipt being printed as
  // the sale happens, so "now" is correct.
  const stamp = dateISO ? new Date(dateISO) : new Date();
  const now = Number.isNaN(stamp.getTime()) ? new Date() : stamp;
  const date = `${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

  const totalQty = cart.lines.reduce((s, l) => s + (l.qty || 0), 0);

  // Customer line honours the template phone/address toggles.
  const customerLine = customer
    ? [
        customer.name,
        receipt.showCustomerAddress && customer.address ? customer.address : null,
        receipt.showCustomerPhone ? customer.phone : null,
      ]
        .filter(Boolean)
        .join(', ')
    : 'Walk-in';

  return (
    /* SIZING NOTE — this component is the printed artefact, so type sizes are in
       `pt` and spacing in `mm` on purpose: they are absolute, so the receipt is
       identical on paper no matter what the Settings → Appearance font-scale
       slider is set to (rem/px would ride along with it). Widths are fluid with
       an A4 cap, so the same markup fits a 50mm roll (240px) and A4 (794px). */
    <div className="bg-white text-black w-full max-w-[820px] mx-auto p-[4mm] font-[Inter,sans-serif] text-[9pt] leading-snug">
      {/*
        Top strip: date on the left, branch on the right. Both can be turned off
        in Settings → Receipt Template, and the branch shows the branch's own
        name — it used to be hard-coded as "POS - <branch>", which the shop had
        no way to edit or remove.
      */}
      {receipt.showDateAndBranch && (
        <div className="flex items-start justify-between gap-2 text-[7.5pt]">
          <div>{date}</div>
          <div className="text-right break-words">{business.posLabel}</div>
        </div>
      )}

      {/* Centered identity block. Every line here is optional: whatever the shop
          has not filled in is omitted rather than printed as blank space. */}
      <div className="text-center mt-[3mm] mb-[2mm]">
        {receipt.showLogo && settingsBusiness.logoUrl && (
          <img
            src={settingsBusiness.logoUrl}
            alt=""
            className="mx-auto mb-[2mm] h-[12mm] w-auto max-w-full object-contain"
          />
        )}
        {business.name && (
          <div className="text-[13pt] font-bold tracking-tight break-words">{business.name}</div>
        )}
        {business.line2 && <div className="break-words">{business.line2}</div>}
        {business.phones && (
          <div className="break-words">
            <span className="font-semibold">Mobile:</span> {business.phones}
          </div>
        )}
        {receipt.headerLines.filter((l) => l.trim()).map((l, i) => (
          <div key={i} className="text-[8pt] break-words">
            {l}
          </div>
        ))}
        <div className="text-[10pt] font-semibold mt-[2mm]">Invoice</div>
      </div>

      {/* Invoice meta — label/value rows rather than two columns, so a 50mm roll
          does not squeeze the values into a 2-character sliver. */}
      <div className="border-t border-b border-black/30 py-[1.5mm]">
        <Row label="Invoice No." value={invoiceNo} labelBold />
        <Row label="Date" value={date} labelBold />
        <Row label="Customer" value={customerLine} labelBold mono={false} />
        {/* The "Cashier name" setting had no effect before — nothing rendered it. */}
        {receipt.showCashier && cashierName && (
          <Row label="Served by" value={cashierName} labelBold mono={false} />
        )}
      </div>

      {/* Items. Two columns only (description block + amount): the old five
          column table needed ~400px and overflowed every thermal roll. The
          quantity × rate detail sits under the product name instead. */}
      <table className="w-full table-fixed mt-[2mm]">
        <thead className="border-b border-black/30">
          <tr>
            <th className="text-left py-[1mm] font-semibold">Product</th>
            <th className="text-right py-[1mm] font-semibold w-[26%]">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {cart.lines.map((l, i) => {
            const up = unitPrice(l);
            const sub = up * l.qty - (up * l.qty * (l.discountPct / 100) + l.discountFlat);
            return (
              <tr key={i} className="border-b border-black/10 align-top">
                <td className="py-[1mm] pr-[2mm]">
                  <div className="break-words">
                    {i + 1}. {l.name}
                    {l.sku ? `, ${l.sku}` : ''}
                  </div>
                  <div className="font-mono tabular text-[8pt]">
                    {l.qty.toFixed(2)} {l.unit} × {up.toFixed(2)}
                  </div>
                </td>
                <td className="py-[1mm] text-right font-mono tabular">{sub.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals. Right-aligned and capped at 70mm: on A4 that reads as a totals
          column, on a narrow roll the cap is wider than the paper so it simply
          uses the full width. */}
      <div className="mt-[2mm] ml-auto w-full max-w-[70mm]">
        <Row label="Total quantity" value={totalQty.toFixed(2)} />
        <Row label="Subtotal" value={`৳ ${formatBDT(totals.subtotal - totals.totalLineDiscount, { withSymbol: false })}`} />
        {totals.orderDiscount > 0 && <Row label="Order Discount" value={`− ৳ ${formatBDT(totals.orderDiscount, { withSymbol: false })}`} />}
        {totals.tax > 0 && <Row label={`VAT (${cart.orderTaxPct}%)`} value={`৳ ${formatBDT(totals.tax, { withSymbol: false })}`} />}
        {totals.shipping > 0 && <Row label="Shipping" value={`৳ ${formatBDT(totals.shipping, { withSymbol: false })}`} />}
        {totals.other > 0 && <Row label="Other Charge" value={`৳ ${formatBDT(totals.other, { withSymbol: false })}`} />}
        <Row label="Total Payable" value={`৳ ${formatBDT(totals.total, { withSymbol: false })}`} bold />
        {receipt.showAmountInWords && (
          <div className="text-[7.5pt] text-right italic break-words">({inWords(totals.total)})</div>
        )}
      </div>

      {/* Payment summary */}
      <div className="mt-[2mm] ml-auto w-full max-w-[70mm]">
        {payment.payments.map((p, i) => (
          <Row
            key={i}
            label={`${p.method}${receipt.showPaymentRef && p.reference ? ' (' + p.reference + ')' : ''}`}
            value={`৳ ${formatBDT(p.amount, { withSymbol: false })}`}
          />
        ))}
        {payment.change > 0 && (
          <Row label="Change" value={`৳ ${formatBDT(payment.change, { withSymbol: false })}`} />
        )}
        {payment.due > 0 && (
          <Row label="Current Due" value={`৳ ${formatBDT(payment.due, { withSymbol: false })}`} bold />
        )}
        {customer && customer.due > 0 && (
          <Row
            label="Total Due"
            value={`৳ ${formatBDT(customer.due + payment.due, { withSymbol: false })}`}
            bold
          />
        )}
      </div>

      {/* Barcode — width in mm so it never runs off a narrow roll */}
      {receipt.showBarcode && (
        <div className="mt-[4mm] text-center">
          <div
            className="mx-auto h-[9mm] w-full max-w-[50mm] bg-black"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg,#000 0,#000 2px,#fff 2px,#fff 4px,#000 4px,#000 5px,#fff 5px,#fff 7px,#000 7px,#000 8px,#fff 8px,#fff 11px,#000 11px,#000 13px,#fff 13px,#fff 14px)',
            }}
          />
          <div className="mt-[1mm] font-mono text-[8pt]">{invoiceNo}</div>
        </div>
      )}

      {/*
        Footer. Clearing the footer text in Settings → Receipt Template now
        prints NOTHING — no text, no rule, no reserved space.

        It used to substitute a hard-coded
        "Thank you for your purchase. · Software by Hardware POS" whenever the
        list was empty, so the shop could not remove the bottom line at all, and
        the branded line was printed on a real customer's invoice.
      */}
      {footerLines.length > 0 && (
        <div className="mt-[4mm] text-center text-[8pt] border-t border-black/30 pt-[1.5mm] break-words">
          {footerLines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  labelBold,
  mono = true,
}: {
  label: string;
  value: string;
  bold?: boolean;
  labelBold?: boolean;
  mono?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-[2mm] ${bold ? 'font-bold' : ''}`}>
      <span className={`shrink-0 ${labelBold ? 'font-semibold' : ''}`}>{label}</span>
      <span className={`min-w-0 text-right break-words ${mono ? 'font-mono tabular' : ''}`}>
        {value}
      </span>
    </div>
  );
}

// Very small "amount in words" helper — backend will replace with proper localized one.
function inWords(amount: number) {
  // Round to 2 decimals
  const taka = Math.floor(amount);
  const paisa = Math.round((amount - taka) * 100);
  const part = numberToWordsBD(taka);
  const out = `${part} taka${paisa ? ` and ${numberToWordsBD(paisa)} paisa` : ''} only`;
  return out;
}

function numberToWordsBD(n: number): string {
  if (n === 0) return 'zero';
  const ones = [
    '',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
  ];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  function under1000(num: number): string {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? '-' + ones[num % 10] : '');
    return ones[Math.floor(num / 100)] + ' hundred' + (num % 100 ? ' ' + under1000(num % 100) : '');
  }

  // BD numbering: lakh (100,000), crore (10,000,000)
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(under1000(crore) + ' crore');
  if (lakh) parts.push(under1000(lakh) + ' lakh');
  if (thousand) parts.push(under1000(thousand) + ' thousand');
  if (rest) parts.push(under1000(rest));
  return parts.join(' ');
}
