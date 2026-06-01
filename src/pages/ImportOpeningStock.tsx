import { useState } from 'react';
import { Download, Upload, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export default function ImportOpeningStock() {
  const [stage, setStage] = useState<'idle' | 'review' | 'done'>('idle');
  const [fileName, setFileName] = useState('');
  const [stats, setStats] = useState({ rows: 0, valid: 0, errors: 0 });

  const downloadTemplate = () => {
    const csv = 'sku,branch,quantity,unit,unit_cost\nHT-CLW-16,Mirpur Branch,42,pc,380\nBM-CMNT-OPC,Mirpur Branch,320,bag,480\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'opening_stock_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setTimeout(() => {
      setStats({ rows: 18, valid: 18, errors: 0 });
      setStage('review');
    }, 200);
  };

  return (
    <div>
      <PageHeader
        title="Import Opening Stock"
        subtitle="Set first-time stock and unit cost per branch"
        actions={
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="size-4" /> Download template
          </Button>
        }
      />

      <div className="p-6 max-w-3xl space-y-4">
        <Card className="p-6 text-sm space-y-2">
          <div className="font-semibold">Format</div>
          <code className="block bg-secondary px-3 py-2 rounded font-mono text-xs">
            sku, branch, quantity, unit, unit_cost
          </code>
          <div className="text-xs text-muted-foreground">
            Use products' base unit short code. Branch must match a Business Branch by name.
          </div>
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
                  Import {stats.valid} row{stats.valid === 1 ? '' : 's'}
                </Button>
              </div>
            </div>
          )}

          {stage === 'done' && (
            <div className="text-center py-8">
              <CheckCircle2 className="size-12 mx-auto text-success" />
              <div className="mt-3 text-lg font-semibold">Stock imported</div>
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
