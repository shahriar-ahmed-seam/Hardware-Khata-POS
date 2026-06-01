import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Lock,
  Banknote,
  ArrowDown,
  ArrowUp,
  Receipt,
  Clock,
  History,
  Plus,
  Filter,
  ScanBarcode,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  useCashRegister,
  MOVEMENT_DIRECTION,
  MOVEMENT_LABEL,
  shiftDuration,
} from '@/stores/cashRegister';
import { OpenShiftModal } from '@/components/cash/OpenShiftModal';
import { CashMoveModal } from '@/components/cash/CashMoveModal';
import { CloseShiftModal } from '@/components/cash/CloseShiftModal';
import { ShiftReport } from '@/components/cash/ShiftReport';
import { formatBDT, cn } from '@/lib/utils';

export default function CashRegister() {
  const branch = 'Mirpur Branch'; // future: from titlebar branch context
  const cashier = 'Seam';
  const hydrate = useCashRegister((s) => s.hydrate);
  const getCurrent = useCashRegister((s) => s.getCurrentShift);
  const movements = useCashRegister((s) => s.movements);
  const shift = getCurrent(branch);

  const [openShiftOpen, setOpenShiftOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState<null | 'in' | 'out'>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [xOpen, setXOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');

  // Mirror Purchases.tsx: hydrate from the backend on mount so the shift +
  // movements reflect the DB. Runs before the auto-open effect so we don't flash
  // the "Open Shift" modal while the real open shift is still loading.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Auto-open the "Open Shift" modal if no shift exists
  useEffect(() => {
    if (!shift) setOpenShiftOpen(true);
  }, [shift]);

  if (!shift) {
    return (
      <div>
        <PageHeader title="Cash Register" subtitle={branch} />
        <div className="p-6 max-w-xl">
          <Card className="p-8 text-center">
            <Lock className="size-10 mx-auto opacity-40" />
            <div className="mt-3 text-lg font-semibold">No active shift</div>
            <p className="text-sm text-muted-foreground mt-1">
              Open a shift to start recording cash sales, payments, and expenses.
            </p>
            <Button className="mt-5" onClick={() => setOpenShiftOpen(true)}>
              <Banknote className="size-4" /> Open Shift
            </Button>
          </Card>
        </div>
        <OpenShiftModal
          open={openShiftOpen}
          onClose={() => setOpenShiftOpen(false)}
          branch={branch}
          cashier={cashier}
        />
      </div>
    );
  }

  const shiftMovements = movements
    .filter((m) => m.shiftId === shift.id)
    .filter((m) => filter === 'all' || MOVEMENT_DIRECTION[m.type] === filter)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const cashIn = movements
    .filter((m) => m.shiftId === shift.id && MOVEMENT_DIRECTION[m.type] === 'in')
    .reduce((s, m) => s + m.amount, 0);
  const cashOut = movements
    .filter((m) => m.shiftId === shift.id && MOVEMENT_DIRECTION[m.type] === 'out')
    .reduce((s, m) => s + m.amount, 0);
  const expected = shift.openingCash + cashIn - cashOut;

  return (
    <div>
      <PageHeader
        title="Cash Register"
        subtitle={`Shift #${shift.shiftNo} · ${branch}`}
        actions={
          <>
            <Link to="/cash-register/report">
              <Button variant="outline" size="sm">
                <History className="size-4" /> Register Report
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => setXOpen(true)}>
              <Receipt className="size-4" /> X-Report
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setCloseOpen(true)}>
              <Lock className="size-4" /> Close Shift
            </Button>
          </>
        }
      />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* LEFT — KPIs + movements */}
        <div className="xl:col-span-2 space-y-4">
          {/* Shift status */}
          <Card className="p-4 flex flex-wrap items-center gap-4 bg-gradient-to-br from-success/5 to-card border-success/20">
            <div className="size-10 rounded-full bg-success/15 text-success grid place-items-center">
              <Banknote className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Shift Open</span>
                <Badge variant="success">#{shift.shiftNo}</Badge>
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Clock className="size-3" /> {shiftDuration(shift)} elapsed
                </span>
              </div>
              <div className="text-[12px] text-muted-foreground mt-0.5">
                Opened {new Date(shift.openedAt).toLocaleString('en-GB')} by {shift.openedBy}
                {shift.openingNote ? ` · ${shift.openingNote}` : ''}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 w-full md:w-auto">
              <Stat label="Opening" value={formatBDT(shift.openingCash)} />
              <Stat label="In" value={formatBDT(cashIn)} tone="success" />
              <Stat label="Out" value={formatBDT(cashOut)} tone="warning" />
            </div>
          </Card>

          {/* Expected in drawer */}
          <Card className="p-5 flex items-center justify-between bg-gradient-to-br from-primary/5 to-card edge-top">
            <div>
              <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                Expected in drawer right now
              </div>
              <div className="font-mono tabular text-3xl font-bold text-primary mt-1">
                {formatBDT(expected)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                = Opening {formatBDT(shift.openingCash, { withSymbol: false })} + In{' '}
                {formatBDT(cashIn, { withSymbol: false })} − Out{' '}
                {formatBDT(cashOut, { withSymbol: false })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setMoveOpen('in')}>
                <ArrowDown className="size-4" /> Cash In
              </Button>
              <Button variant="outline" onClick={() => setMoveOpen('out')}>
                <ArrowUp className="size-4" /> Cash Out
              </Button>
            </div>
          </Card>

          {/* Movements */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent movements</CardTitle>
                  <CardDescription>{shiftMovements.length} entries</CardDescription>
                </div>
                <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-xs">
                  {(['all', 'in', 'out'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={cn(
                        'px-3 h-7 rounded font-medium transition capitalize',
                        filter === f
                          ? 'bg-card shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {f === 'all' ? 'All' : f === 'in' ? 'Cash In' : 'Cash Out'}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Time</th>
                    <th className="text-left px-2 py-2 font-medium">Type</th>
                    <th className="text-left px-2 py-2 font-medium">Reference</th>
                    <th className="text-left px-2 py-2 font-medium">Note</th>
                    <th className="text-left px-2 py-2 font-medium">By</th>
                    <th className="text-right px-4 py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftMovements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                        No movements yet. Activity from POS, payments and expenses will show here.
                      </td>
                    </tr>
                  ) : (
                    shiftMovements.map((m) => (
                      <tr key={m.id} className="border-t border-border">
                        <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(m.at).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-2 py-2">
                          <Badge variant={MOVEMENT_DIRECTION[m.type] === 'in' ? 'success' : 'warning'}>
                            {MOVEMENT_LABEL[m.type]}
                          </Badge>
                        </td>
                        <td className="px-2 py-2 text-xs">{m.reference ?? '—'}</td>
                        <td className="px-2 py-2 text-xs text-muted-foreground truncate max-w-[180px]">
                          {m.reason ? `${m.reason}${m.note ? ' · ' + m.note : ''}` : m.note ?? '—'}
                        </td>
                        <td className="px-2 py-2 text-xs text-muted-foreground">{m.cashier}</td>
                        <td
                          className={cn(
                            'px-4 py-2 text-right font-mono tabular',
                            MOVEMENT_DIRECTION[m.type] === 'in' ? 'text-success' : 'text-warning',
                          )}
                        >
                          {MOVEMENT_DIRECTION[m.type] === 'in' ? '+' : '−'}
                          {formatBDT(m.amount, { withSymbol: false })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — Quick actions + tips */}
        <div className="space-y-4">
          <Card className="p-4 space-y-2">
            <div className="text-sm font-semibold">Quick actions</div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setMoveOpen('in')}>
                <ArrowDown className="size-4" /> Cash In
              </Button>
              <Button variant="outline" onClick={() => setMoveOpen('out')}>
                <ArrowUp className="size-4" /> Cash Out
              </Button>
              <Link to="/pos">
                <Button variant="outline" className="w-full">
                  <ScanBarcode className="size-4" /> Open POS
                </Button>
              </Link>
              <Button variant="outline" onClick={() => setXOpen(true)}>
                <Receipt className="size-4" /> X-Report
              </Button>
            </div>
            <Button variant="destructive" className="w-full" onClick={() => setCloseOpen(true)}>
              <Lock className="size-4" /> Close Shift
            </Button>
          </Card>

          <Card className="p-4 space-y-2 text-xs text-muted-foreground">
            <div className="text-sm font-semibold text-foreground">How shifts work</div>
            <p>
              All cash sales, customer payments, supplier payments, and expenses tie into the
              currently open shift. At close, you count the drawer; the system shows variance vs
              expected.
            </p>
            <p>
              Variance under{' '}
              <span className="font-mono tabular">
                {formatBDT(useCashRegister.getState().varianceWarnThreshold)}
              </span>{' '}
              is fine. Above warns. Above{' '}
              <span className="font-mono tabular">
                {formatBDT(useCashRegister.getState().varianceBlockThreshold)}
              </span>{' '}
              needs manager override.
            </p>
          </Card>
        </div>
      </div>

      <CashMoveModal
        open={!!moveOpen}
        onClose={() => setMoveOpen(null)}
        shiftId={shift.id}
        cashier={cashier}
        defaultDirection={moveOpen ?? 'in'}
      />
      <CloseShiftModal open={closeOpen} onClose={() => setCloseOpen(false)} shift={shift} cashier={cashier} />
      <ShiftReport open={xOpen} onClose={() => setXOpen(false)} shift={shift} variant="X" />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'warning';
}) {
  return (
    <div className="rounded-md border border-border bg-card p-2">
      <div className="text-[9px] uppercase text-muted-foreground">{label}</div>
      <div
        className={cn(
          'font-mono tabular font-bold text-sm mt-0.5',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
        )}
      >
        {value}
      </div>
    </div>
  );
}

void Plus;
void Filter;
