import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type PaperSize = '50mm' | '58mm' | '80mm' | 'A4';

/**
 * On-paper widths in CSS px @96dpi. Carried over from the old PrintFrame so
 * existing receipt layouts keep the same proportions.
 */
const PAPER_WIDTH: Record<PaperSize, number> = {
  '50mm': 240,
  '58mm': 280,
  '80mm': 360,
  A4: 794, // ~210mm @ 96dpi
};

/**
 * Body marker class. The print stylesheet uses it to decide between
 * "print ONLY this sheet" and "print the page, minus the app chrome".
 * A counter (not a bare add/remove) keeps two mounted sheets from clobbering
 * each other when one of them unmounts.
 */
const BODY_MARKER = 'has-print-sheet';
let mountedSheets = 0;

interface Props {
  /** Physical paper the sheet is laid out for. Defaults to 80mm thermal. */
  paper?: PaperSize;
  children: ReactNode;
}

/**
 * Off-screen print target.
 *
 * Renders its children into a portal appended to `document.body` — i.e. OUTSIDE
 * `#root` — so the print stylesheet can hide the entire app (`#root`) and be
 * certain nothing but this sheet reaches the printer: no titlebar, no sidebar,
 * no modal scrim, no scrollbars.
 *
 * It is deliberately invisible on screen (`hidden print:block`). This is not a
 * preview — the calling modal already shows one. Mount it alongside the modal
 * and let the existing `window.print()` button do the rest.
 */
export function PrintSheet({ paper = '80mm', children }: Props) {
  const [host] = useState(() => {
    const el = document.createElement('div');
    // `print-frame-root` is the hook the @media print block in globals.css
    // keys off; `hidden print:block` keeps it out of the way on screen.
    el.className = 'print-frame-root hidden print:block';
    return el;
  });

  useEffect(() => {
    document.body.appendChild(host);
    mountedSheets += 1;
    document.body.classList.add(BODY_MARKER);
    return () => {
      mountedSheets = Math.max(0, mountedSheets - 1);
      if (mountedSheets === 0) document.body.classList.remove(BODY_MARKER);
      host.remove();
    };
  }, [host]);

  return createPortal(
    <div
      className="print-frame-sheet bg-white text-black"
      // Explicit light colour-scheme: the app may be in dark mode, and a
      // dark receipt prints as a solid black rectangle on a thermal roll.
      style={{ width: PAPER_WIDTH[paper], colorScheme: 'light' }}
    >
      {children}
    </div>,
    host,
  );
}
