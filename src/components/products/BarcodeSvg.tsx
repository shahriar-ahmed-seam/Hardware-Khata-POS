import { useMemo } from 'react';
import { encodeBarcode, type BarcodeKind } from '@/lib/barcode';

/**
 * A real, scannable barcode (EAN-13 or Code 128, src/lib/barcode.ts) as an SVG,
 * one rect per bar, so it prints sharp at any printer resolution.
 * Renders nothing when the code cannot be encoded.
 */
export function BarcodeSvg({
  code,
  prefer,
  height = '10mm',
  className,
}: {
  code: string;
  prefer?: BarcodeKind;
  /** CSS height of the bars, e.g. '10mm'. Width fills the parent. */
  height?: string;
  className?: string;
}) {
  const enc = useMemo(() => encodeBarcode(code, prefer), [code, prefer]);
  const bars = useMemo(() => {
    if (!enc) return [];
    // Merge runs of '1' into one rect each.
    const out: { x: number; w: number }[] = [];
    const m = enc.modules;
    for (let i = 0; i < m.length; ) {
      if (m[i] !== '1') {
        i++;
        continue;
      }
      let j = i;
      while (j < m.length && m[j] === '1') j++;
      out.push({ x: i, w: j - i });
      i = j;
    }
    return out;
  }, [enc]);
  if (!enc) return null;
  // Quiet zone: 10 modules each side, which scanners need to find the start.
  const quiet = 10;
  const total = enc.modules.length + quiet * 2;
  return (
    <svg
      viewBox={`0 0 ${total} 10`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      role="img"
      aria-label={enc.text}
      className={className}
      style={{ width: '100%', height, display: 'block' }}
    >
      <rect x="0" y="0" width={total} height="10" fill="#fff" />
      {bars.map((b) => (
        <rect key={b.x} x={b.x + quiet} y="0" width={b.w} height="10" fill="#000" />
      ))}
    </svg>
  );
}
