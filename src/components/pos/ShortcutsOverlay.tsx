import { Modal } from '@/components/ui/Modal';
import type { ShortcutMap } from '@/stores/settings';
import { DEFAULT_POS_KEYS, keyLabel } from './shortcuts';

/** Rows in the order a cashier meets them. Keys come from Settings (R81). */
const ROWS: { id: keyof ShortcutMap; desc: string }[] = [
  { id: 'search', desc: 'Search or scan a product' },
  { id: 'customer', desc: 'Choose customer' },
  { id: 'orderDiscount', desc: 'Discount on the whole bill' },
  { id: 'pay', desc: 'Take payment (press again to confirm)' },
  { id: 'hold', desc: 'Hold this cart' },
  { id: 'heldCarts', desc: 'Held carts' },
  { id: 'newCart', desc: 'New cart' },
  { id: 'saveDraft', desc: 'Save as draft' },
  { id: 'saveQuotation', desc: 'Save as quotation' },
  { id: 'reprintLast', desc: 'Re-print last receipt' },
  { id: 'showHelp', desc: 'Show this list' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  /** The keys in force (saved bindings over the defaults). */
  keys?: ShortcutMap;
}

export function ShortcutsOverlay({ open, onClose, keys = DEFAULT_POS_KEYS }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard keys" subtitle="Change them in Settings → Keyboard Shortcuts" width="max-w-md">
      <div className="p-4 divide-y divide-border">
        {ROWS.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span>{r.desc}</span>
            <kbd className="text-sm tabular bg-secondary border border-border px-2 py-0.5 rounded shrink-0">
              {keyLabel(keys[r.id])}
            </kbd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 py-2 text-sm">
          <span>Close a popup</span>
          <kbd className="text-sm bg-secondary border border-border px-2 py-0.5 rounded shrink-0">Esc</kbd>
        </div>
      </div>
    </Modal>
  );
}
