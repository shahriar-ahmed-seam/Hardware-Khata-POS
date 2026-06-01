import { useState } from 'react';
import { Download, Upload, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const HEADER = [
  'invoice_no',
  'date',
  'customer_phone',
  'customer_name',
  'branch',
  'sku',
  'quantity',
  'unit',
  'unit_price',
  'line_discount_pct',
  'line_discount_flat',
  'order_discount_pct',
  'order_discount_flat',
  'tax_pct',
  'shipping',
  'other',
  'payment_method',
  'paid_amount',
  'reference',
  'cashier',
  'notes',
];

const SAMPLE_ROWS = [
  [
    'INV-2026-0500',
    '2026-05-26 11:42',
    '01711-220011',
    'Rahim Construction',
    'Mirpur Branch',
    'BM-CMNT-OPC',
    '20',
    'bag',
    '540',
    '0',
    '0',
    '5',
    '0',
    '0',
    '0',
    '0',
    'Cash',
    '5000',
    '',
    'Seam',
    '',
  ],
  [
    'INV-2026-0500',
    '2026-05-26 11:42',
    '01711-220011',
    'Rahim Construction',
    'Mirpur Branch',
    'BM-RBR-12',
    '150',
    'kg',
    '102',
    '0',
    '0',
    '5',
    '0',
    '0',
    '0',
    '0',
    'Cash',
    '5000',
    '',
    'Seam',
    'Multi-row sale: same invoice = same row group',
  ],
];

export default function ImportSales() {
  const [stage, setStage] = useState<'idle' | 'review' | 'done'>('idle');
  const [fileName, setFileName] = useState('');
  const [stats, setStats] = useState({ rows: 0, sales: 0, errors: 0 });

  const downloadTemplate = () => {
    const csv = HEADER.join(',') + '\n' + SAMPLE_ROWS.map((r) => r.join(',')).join('\n') + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setTimeout(() => {
      setStats({ rows: 142, sales: 24, errors: 1 });
      setStage('review');
    }, 200);
  };

  return (
    <div>
      <PageHeader
        title="Import Sales"
        subtitle="Bulk-import past invoices via CSV"
        actions={
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="size-4" /> Download template
          </Button>
        }
      />

      <div className="p-6 max-w-3xl space-y-4">
        <Card className="p-6 text-sm space-y-3">
          <div className="font-semibold">CSV format (one row per line item)</div>
          <code className="block bg-secondary px-3 py-2 rounded font-mono text-[11px] overflow-x-auto whitespace-nowrap">
            {HEADER.join(', ')}
          </code>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
            <li>
              <strong>One row per line item.</strong> Group rows by <code>invoice_no</code> — same
              invoice no means same sale.
            </li>
            <li>
              <code>date</code> in <code>YYYY-MM-DD HH:mm</code> format.
            </li>
            <li>
              <code>customer_phone</code> matches an existing customer; if not found, a customer
              is created with <code>customer_name</code>.
            </li>
            <li>
              <code>sku</code> must match an existing product. Unknown SKUs cause errors.
            </li>
            <li>
              <code>payment_method</code> ∈ Cash / bKash / Nagad / Card / Bank / Credit. Use
              repeated rows with different methods to record split payments.
            </li>
            <li>
              <code>paid_amount</code> is the amount paid for that method on that invoice
              (repeat the same value across rows of one method, or split rows with different
              methods).
            </li>
          </ul>
        </Card>

        <Card className="p-6">
          {stage === 'idle' && (
            <label className="block cursor-pointer">
              <input type="file" accept=".csv,.tsv" className="hidden" onChange={handleFile} />
              <div className="rounded-xl border-2 border-dashed border-border p-10 text-center hover:border-primary transition">
                <Upload className="size-10 mx-auto opacity-50" />
                <div className="mt-3 text-sm font-medium">Click to choose a CSV file</div>
              </div>
            </label>
          )}

          {stage === 'review' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/40">
                <FileText className="size-5 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{fileName}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {stats.rows} rows · {stats.sales} sales detected · {stats.errors} errors
                  </div>
                </div>
                <Badge variant={stats.errors > 0 ? 'warning' : 'success'}>
                  {stats.errors > 0 ? (
                    <>
                      <AlertTriangle className="size-3" /> Needs review
                    </>
                  ) : (
                    'Ready'
                  )}
                </Badge>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setStage('idle')}>
                  Cancel
                </Button>
                <Button onClick={() => setStage('done')} disabled={stats.sales === 0}>
                  Import {stats.sales} sale{stats.sales === 1 ? '' : 's'}
                </Button>
              </div>
            </div>
          )}

          {stage === 'done' && (
            <div className="text-center py-8">
              <CheckCircle2 className="size-12 mx-auto text-success" />
              <div className="mt-3 text-lg font-semibold">Sales imported</div>
              <Button className="mt-5" onClick={() => setStage('idle')}>
                Import another
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
