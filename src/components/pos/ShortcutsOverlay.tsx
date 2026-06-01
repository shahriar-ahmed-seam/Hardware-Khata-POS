import { Modal } from '@/components/ui/Modal';

const map = [
  { keys: 'F2', desc: 'Focus product search' },
  { keys: 'F3', desc: 'Pick customer' },
  { keys: 'F4', desc: 'Order discount' },
  { keys: 'F5', desc: 'Held / parked carts' },
  { keys: 'F6', desc: 'Save as Draft' },
  { keys: 'F7', desc: 'Save as Quotation' },
  { keys: 'F8', desc: 'Pay (open payment)' },
  { keys: 'F9', desc: 'Hold current cart' },
  { keys: 'F10', desc: 'New cart tab' },
  { keys: 'Ctrl + P', desc: 'Re-print last receipt' },
  { keys: 'Esc', desc: 'Close modal / clear focus' },
  { keys: '?', desc: 'Show this overlay' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsOverlay({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard Shortcuts" subtitle="Speed up your counter" width="max-w-md">
      <div className="p-4 space-y-2">
        {map.map((m) => (
          <div key={m.keys} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{m.desc}</span>
            <kbd className="font-mono text-[11px] bg-secondary border border-border px-2 py-0.5 rounded">
              {m.keys}
            </kbd>
          </div>
        ))}
      </div>
    </Modal>
  );
}
