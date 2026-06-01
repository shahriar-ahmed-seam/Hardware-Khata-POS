import { useState } from 'react';
import { Download, Upload, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const HEADER = [
  'name',
  'company',
  'contact_person',
  'phone',
  'alt_phone',
  'email',
  'address',
  'tax_id',
  'bank_account',
  'lead_time_days',
  'payment_terms',
  'opening_balance',
  'tags',
  'notes',
];

const SAMPLE = [
  'BSRM Steels Ltd',
  'BSRM',
  'Md. Anwar Hossain',
  '02-9889600',
  '',
  '',
  'Chittagong',
  '',
  '',
  '5',
  'Net30',
  '0',
  '',
  '',
];

export default function ImportSuppliers() {
  const [stage, setStage] = useState<'idle' | 'review' | 'done'>('idle');
  const [fileName, setFileName] = useState('');
  const [stats, setStats] = useState({ rows: 0, valid: 0, errors: 0 });

  const downloadTemplate = () => {
    const csv = HEADER.join(',') + '\n' + SAMPLE.join(',') + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'suppliers_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setTimeout(() => {
      setStats({ rows: 8, valid: 8, errors: 0 });
      setStage('review');
    }, 200);
  };

  return (
    <div>
      <PageHeader
        title="Import Suppliers"
        subtitle="Bulk-add suppliers via CSV"
        actions={
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="size-4" /> Download template
          </Button>
        }
      />

      <div className="p-6 max-w-3xl space-y-4">
        <Card className="p-6 text-sm space-y-2">
          <div className="font-semibold">CSV format</div>
          <code className="block bg-secondary px-3 py-2 rounded font-mono text-[11px] overflow-x-auto whitespace-nowrap">
            {HEADER.join(', ')}
          </code>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
            <li><code>name</code> and <code>phone</code> are required.</li>
            <li><code>payment_terms</code> ∈ Cash / Net7 / Net15 / Net30 / Net60.</li>
            <li><code>opening_balance</code> sets initial payable (positive = you owe supplier).</li>
            <li><code>tags</code> separated by <code>;</code>.</li>
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
                    {stats.rows} rows · {stats.valid} valid · {stats.errors} errors
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
                <Button onClick={() => setStage('done')} disabled={stats.valid === 0}>
                  Import {stats.valid} supplier{stats.valid === 1 ? '' : 's'}
                </Button>
              </div>
            </div>
          )}

          {stage === 'done' && (
            <div className="text-center py-8">
              <CheckCircle2 className="size-12 mx-auto text-success" />
              <div className="mt-3 text-lg font-semibold">Suppliers imported</div>
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
