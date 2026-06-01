import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Paper width for the preview: receipt sizes or A4. */
  paper?: '50mm' | '58mm' | '80mm' | 'A4';
  children: ReactNode;
}

const PAPER_WIDTH: Record<NonNullable<Props['paper']>, number> = {
  '50mm': 240,
  '58mm': 280,
  '80mm': 360,
  A4: 794, // ~210mm @ 96dpi
};

/**
 * Generic print preview. Renders content centered on a paper-sized sheet with
 * a toolbar (Print / Close). When printing, a print-only stylesheet hides
 * everything except the sheet. Used by Receipt, Invoice, Z-Report, Reports.
 *
 * Pair with the `print:hidden` / `print-frame-sheet` CSS in globals.css.
 */
export function PrintFrame({ open, onClose, title = 'Print preview', paper = '80mm', children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-black/60 animate-fade-in print:bg-white print:static">
      {/* Toolbar (hidden when printing) */}
      <div className="print:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <div className="text-sm font-semibold">{title}</div>
        <div className="flex items-center gap-2">
          <Button onClick={() => window.print()}>
            <Printer className="size-4" /> Print
          </Button>
          <Button variant="outline" onClick={onClose}>
            <X className="size-4" /> Close
          </Button>
        </div>
      </div>

      {/* Scrollable preview area */}
      <div className="flex-1 overflow-auto grid place-items-start justify-center p-8 print:p-0 print:overflow-visible">
        <div
          className="print-frame-sheet bg-white text-black shadow-xl print:shadow-none"
          style={{ width: PAPER_WIDTH[paper] }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
