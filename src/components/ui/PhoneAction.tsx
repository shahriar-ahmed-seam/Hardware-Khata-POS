import { Phone, Check } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from '@/stores/toast';

/**
 * A phone number the employee can act on.
 *
 * WHY THIS IS "COPY" AND NOT A `tel:` LINK.
 * A `tel:` href is the obvious thing to reach for, and it is the wrong thing here.
 * The shop runs this on a desktop PC; Windows only handles `tel:` if something is
 * registered for it (Phone Link, Skype, a softphone), and when nothing is, Electron
 * silently fails to navigate. That is a button that looks live and does nothing —
 * the exact defect this pass went through the app removing. There is no way to
 * detect the failure, so it cannot even be reported honestly.
 *
 * Copying always works, and it is what actually happens next: the number goes
 * into whatever the shop dials from. The number itself is always shown next to
 * this, so it can be read out loud without pressing anything at all.
 */
export function PhoneAction({
  phone,
  label,
  className,
}: {
  /** Raw stored number. Rendered as-is; only the copy is normalised. */
  phone: string;
  /** Whose number it is, for the toast and the tooltip. */
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const clean = phone.trim();
    try {
      await navigator.clipboard.writeText(clean);
      setCopied(true);
      toast.success(`${clean} copied`, {
        description: label ? `Dial it to reach ${label}.` : 'Dial it on your phone.',
      });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused (no permission / no secure context). Say so rather
      // than pretending it worked — the number is on screen to read anyway.
      toast.error('Could not copy the number', { description: clean });
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={label ? `Copy ${label}'s number` : 'Copy this number'}
      className={cn(
        'h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-border text-sm font-medium hover:bg-secondary hover:text-primary hover:border-primary transition shrink-0',
        className,
      )}
    >
      {copied ? <Check className="size-4" /> : <Phone className="size-4" />}
      {copied ? 'Copied' : 'Copy number'}
    </button>
  );
}

/**
 * Is this a number worth offering to dial?
 *
 * The quick-add customer form stores `'-'` when the walk-in gave no number, so a
 * "Call" affordance next to it would be a lie. Six digits is the shortest thing
 * that could plausibly be a real BD number.
 */
export function isCallable(phone?: string | null): phone is string {
  return !!phone && phone.replace(/[^0-9+]/g, '').length >= 6;
}
