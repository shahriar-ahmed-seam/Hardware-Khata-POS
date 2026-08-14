import { useSettings } from '@/stores/settings';
import type { PaperSize } from '@/components/ui/PrintSheet';

/** Settings stores the physical width in mm; PrintSheet wants the union. */
const BY_MM: Record<number, PaperSize> = {
  50: '50mm',
  58: '58mm',
  80: '80mm',
  210: 'A4',
};

/**
 * Paper size of the configured receipt printer, for `<PrintSheet paper={…}>`.
 *
 * Uses the printer flagged `isDefault`, else the first configured one. Falls
 * back to 80mm when the shop has not set a printer up yet — that is the most
 * common thermal roll and matches the previous hard-coded behaviour.
 */
export function usePaperWidth(): PaperSize {
  const printers = useSettings((s) => s.printers);
  const profile = printers.find((p) => p.isDefault) ?? printers[0];
  return (profile && BY_MM[profile.paperWidth]) || '80mm';
}
