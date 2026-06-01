import { useState } from 'react';
import { Download, Upload, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const SAMPLE_HEADER = [
  'name',
  'sku',
  'barcode',
  'category',
  'brand',
  'unit',
  'cost',
  'price',
  'wholesale_price',
  'contractor_price',
  'opening_stock',
  'reorder_level',
  'tax',
  'description',
];

const SAMPLE_ROW = [
  'Claw Hammer 16oz',
  'HT-CLW-16',
  '8801001000017',
  'Hand Tools',
  'Stanley',
  'pc',
  '380',
  '520',
  '470',
  '490',
  '42',
  '10',
  '0',
  'Forged steel claw hammer',
];

export default function ImportProducts() {
  const [stage, setStage] = useState<'idle' | 'mapping' | 'review' | 'done'>('idle');
  const [fileName, setFileName] = useState('');
  const [stats, setStats] = useState({ rows: 0, valid: 0, errors: 0 });

  const downloadTemplate = () => {
    const csv = SAMPLE_HEADER.join(',') + '\n' + SAMPLE_ROW.join(',') + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    // Mock parse — real parser comes with backend
    setTimeout(() => {
      setStats({ rows: 24, valid: 22, errors: 2 });
      setStage('mapping');
    }, 200);
  };

  return (
    <div>
      <PageHeader
        title="Import Products"
        subtitle="Bulk import via CSV"
        actions={
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="size-4" /> Download template
          </Button>
        }
      />

      <div className="p-6 max-w-3xl space-y-4">
        <Card className="p-6">
          <ol className="space-y-3 text-sm">
            <Step done n={1} title="Download the template">
              Use the standard CSV format. Don't change column names.
            </Step>
            <Step done={stage !== 'idle'} n={2} title="Fill in your products">
              Each row is one product. Categories and brands by name (we'll create new ones if missing).
            </Step>
            <Step done={['mapping', 'review', 'done'].includes(stage)} n={3} title="Upload the file">
              CSV up to 10MB.
            </Step>
            <Step done={stage === 'review' || stage === 'done'} n={4} title="Review and import">
              Preview detected rows; fix any errors; click Import.
            </Step>
          </ol>
        </Card>

        <Card className="p-6">
          {stage === 'idle' && (
            <label className="block cursor-pointer">
              <input type="file" accept=".csv,.tsv" className="hidden" onChange={handleFile} />
              <div className="rounded-xl border-2 border-dashed border-border p-10 text-center hover:border-primary transition">
                <Upload className="size-10 mx-auto opacity-50" />
                <div className="mt-3 text-sm font-medium">Click to choose a CSV file</div>
                <div className="text-[11px] text-muted-foreground mt-1">or drag and drop</div>
              </div>
            </label>
          )}

          {stage !== 'idle' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/40">
                <FileText className="size-5 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{fileName}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {stats.rows} rows · {stats.valid} valid · {stats.errors} errors
                  </div>
                </div>
                <Badge variant={stats.errors > 0 ? 'warning' : 'success'}>
                  {stats.errors > 0 ? 'Needs review' : 'Ready'}
                </Badge>
              </div>

              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Row</th>
                      <th className="text-left font-medium px-2 py-2">Product</th>
                      <th className="text-left font-medium px-2 py-2">Status</th>
                      <th className="text-left font-medium px-2 py-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    <Row n={1} name="Sample Hammer" status="valid" />
                    <Row n={2} name="" status="error" note="Missing required field: name" />
                    <Row n={3} name="Cement OPC 50kg" status="valid" />
                    <Row n={4} name="Wire 2.5mm²" status="warn" note="Brand 'Walton' will be created" />
                    <Row n={5} name="Bad Price" status="error" note="Invalid price: 'abc'" />
                  </tbody>
                </table>
              </Card>

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setStage('idle')}>
                  Cancel
                </Button>
                <Button
                  onClick={() => setStage('done')}
                  disabled={stats.valid === 0}
                >
                  Import {stats.valid} valid row{stats.valid === 1 ? '' : 's'}
                </Button>
              </div>
            </div>
          )}

          {stage === 'done' && (
            <div className="text-center py-8">
              <CheckCircle2 className="size-12 mx-auto text-success" />
              <div className="mt-3 text-lg font-semibold">Import complete</div>
              <div className="text-sm text-muted-foreground mt-1">
                {stats.valid} products imported · {stats.errors} skipped
              </div>
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

function Step({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: string;
  done?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <div
        className={`size-6 rounded-full grid place-items-center text-[11px] font-bold shrink-0 ${
          done ? 'bg-success text-success-foreground' : 'bg-secondary text-muted-foreground'
        }`}
      >
        {done ? '✓' : n}
      </div>
      <div>
        <div className="font-semibold">{title}</div>
        {children && <div className="text-xs text-muted-foreground mt-0.5">{children}</div>}
      </div>
    </li>
  );
}

function Row({
  n,
  name,
  status,
  note,
}: {
  n: number;
  name: string;
  status: 'valid' | 'warn' | 'error';
  note?: string;
}) {
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 font-mono text-xs">#{n}</td>
      <td className="px-2 py-2">{name || <span className="text-muted-foreground italic">—</span>}</td>
      <td className="px-2 py-2">
        {status === 'valid' && <Badge variant="success">Valid</Badge>}
        {status === 'warn' && <Badge variant="warning">Warning</Badge>}
        {status === 'error' && (
          <Badge variant="destructive">
            <AlertTriangle className="size-3" /> Error
          </Badge>
        )}
      </td>
      <td className="px-2 py-2 text-xs text-muted-foreground">{note ?? '—'}</td>
    </tr>
  );
}
