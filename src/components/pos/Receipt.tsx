import { customers as mockCustomers, type Customer } from '@/mocks/data';
import { computeTotals, unitPrice, type ParkedCart } from './types';
import { formatBDT } from '@/lib/utils';
import { useSettings } from '@/stores/settings';
import { useBranches } from '@/stores/branches';
import type { PaymentResult } from './PaymentModal';

interface Props {
  invoiceNo: string;
  cart: ParkedCart;
  payment: PaymentResult;
  /** Resolved customer (backend or mock). Falls back to a mock lookup by id. */
  customer?: Customer;
  /** Optional explicit override; when omitted the identity is read from settings. */
  business?: {
    name: string;
    line2: string;
    phones: string;
    branchName: string;
    posLabel: string;
  };
}

const DEFAULT_BUSINESS = {
  name: 'HARDWARE POS',
  line2: 'Mirpur 10, Dhaka',
  phones: '01XXXXXXXXX, 01XXXXXXXXX',
  branchName: 'Mirpur Branch',
  posLabel: 'POS - Mirpur',
};

/**
 * Print-friendly invoice. White background, dark text, no theme tokens —
 * keeps it consistent on print regardless of app theme.
 *
 * Business identity + the optional sections (logo / header lines / footer
 * lines / customer phone+address / amount-in-words / payment ref / barcode)
 * are sourced live from the Settings store (`business` + `receipt` template).
 * `DEFAULT_BUSINESS` is used only when the business name is empty (e.g. browser
 * dev with no backend) or an explicit `business` prop is supplied.
 */
export function Receipt({ invoiceNo, cart, payment, customer: customerProp, business: businessProp }: Props) {
  const settingsBusiness = useSettings((s) => s.business);
  const receipt = useSettings((s) => s.receipt);
  const branches = useBranches((s) => s.items);
  const activeBranch =
    branches.find((b) => b.isDefault) ?? branches.find((b) => b.active) ?? branches[0];
  const branchName = activeBranch?.name ?? settingsBusiness.defaultBranch ?? DEFAULT_BUSINESS.branchName;

  // Derive the printed identity from settings; fall back to DEFAULT_BUSINESS
  // when the business name is empty. An explicit prop always wins.
  const phones = [settingsBusiness.phonePrimary, settingsBusiness.phoneAlt].filter(Boolean).join(', ');
  const business =
    businessProp ??
    (settingsBusiness.name?.trim()
      ? {
          name: settingsBusiness.name,
          line2: settingsBusiness.address ?? '',
          phones: phones || DEFAULT_BUSINESS.phones,
          branchName,
          posLabel: `POS - ${branchName}`,
        }
      : DEFAULT_BUSINESS);

  const customer = customerProp ?? mockCustomers.find((c) => c.id === cart.customerId);
  const totals = computeTotals(cart);
  const now = new Date();
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
    <div className="bg-white text-black w-[820px] p-8 mx-auto font-[Inter,sans-serif] text-[12.5px] leading-snug">
      {/* Header strip */}
      <div className="flex items-start justify-between text-[11px]">
        <div>{date}</div>
        <div>{business.posLabel}</div>
      </div>

      {/* Centered title block */}
      <div className="text-center mt-4 mb-3">
        {receipt.showLogo && settingsBusiness.logoUrl && (
          <img
            src={settingsBusiness.logoUrl}
            alt=""
            className="mx-auto mb-2 h-12 w-auto object-contain"
          />
        )}
        <div className="text-[18px] font-bold tracking-tight">{business.name}</div>
        <div>{business.line2}</div>
        <div>
          <span className="font-semibold">Mobile:</span> {business.phones}
        </div>
        {receipt.headerLines.filter((l) => l.trim()).map((l, i) => (
          <div key={i} className="text-[11px]">
            {l}
          </div>
        ))}
        <div className="text-[14px] font-semibold mt-2">Invoice</div>
      </div>

      {/* Invoice meta */}
      <div className="grid grid-cols-2 gap-2 border-t border-b border-black/30 py-2 text-[12.5px]">
        <div>
          <div>
            <span className="font-semibold">Invoice No.</span>
          </div>
          <div>
            <span className="font-semibold">Date</span>
          </div>
          <div>
            <span className="font-semibold">Customer</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono">{invoiceNo}</div>
          <div className="font-mono">{date}</div>
          <div>{customerLine}</div>
        </div>
      </div>

      {/* Items table */}
      <table className="w-full mt-3 text-[12.5px]">
        <thead className="border-b border-black/30">
          <tr>
            <th className="text-left py-1 font-semibold w-6">#</th>
            <th className="text-left py-1 font-semibold">Product</th>
            <th className="text-right py-1 font-semibold">Quantity</th>
            <th className="text-right py-1 font-semibold">Unit Price</th>
            <th className="text-right py-1 font-semibold">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {cart.lines.map((l, i) => {
            const up = unitPrice(l);
            const sub = up * l.qty - (up * l.qty * (l.discountPct / 100) + l.discountFlat);
            return (
              <tr key={i} className="border-b border-black/10">
                <td className="py-1 align-top">{i + 1}</td>
                <td className="py-1 align-top">{l.name}{l.sku ? `, ${l.sku}` : ''}</td>
                <td className="py-1 text-right font-mono tabular">
                  {l.qty.toFixed(2)} {l.unit}
                </td>
                <td className="py-1 text-right font-mono tabular">{up.toFixed(2)}</td>
                <td className="py-1 text-right font-mono tabular">{sub.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div></div>
        <div className="text-[12.5px]">
          <Row label="Total quantity" value={totalQty.toFixed(2)} />
          <Row label="Subtotal" value={`৳ ${formatBDT(totals.subtotal - totals.totalLineDiscount, { withSymbol: false })}`} />
          {totals.orderDiscount > 0 && <Row label="Order Discount" value={`− ৳ ${formatBDT(totals.orderDiscount, { withSymbol: false })}`} />}
          {totals.tax > 0 && <Row label={`VAT (${cart.orderTaxPct}%)`} value={`৳ ${formatBDT(totals.tax, { withSymbol: false })}`} />}
          {totals.shipping > 0 && <Row label="Shipping" value={`৳ ${formatBDT(totals.shipping, { withSymbol: false })}`} />}
          {totals.other > 0 && <Row label="Other Charge" value={`৳ ${formatBDT(totals.other, { withSymbol: false })}`} />}
          <Row label="Total Payable" value={`৳ ${formatBDT(totals.total, { withSymbol: false })}`} bold />
          {receipt.showAmountInWords && (
            <div className="text-[11px] text-right italic">({inWords(totals.total)})</div>
          )}
        </div>
      </div>

      {/* Payment summary */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div></div>
        <div className="text-[12.5px]">
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
      </div>

      {/* Barcode */}
      {receipt.showBarcode && (
        <div className="mt-5 text-center">
          <div
            className="mx-auto h-10 w-56 bg-black"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg,#000 0,#000 2px,#fff 2px,#fff 4px,#000 4px,#000 5px,#fff 5px,#fff 7px,#000 7px,#000 8px,#fff 8px,#fff 11px,#000 11px,#000 13px,#fff 13px,#fff 14px)',
            }}
          />
          <div className="mt-1 font-mono text-[11px]">{invoiceNo}</div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 text-center text-[11px] border-t border-black/30 pt-2">
        {receipt.footerLines.filter((l) => l.trim()).length > 0
          ? receipt.footerLines
              .filter((l) => l.trim())
              .map((l, i) => <div key={i}>{l}</div>)
          : 'Thank you for your purchase. · Software by Hardware POS'}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold' : ''}`}>
      <span>{label}</span>
      <span className="font-mono tabular">{value}</span>
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
