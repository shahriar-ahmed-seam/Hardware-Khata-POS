import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { Card } from '@/components/ui/Card';

/**
 * INVOICE NUMBERING — read-only for now (R12).
 *
 * The old editor saved a `schemes` blob in settings_kv, but document numbers
 * come from the backend `invoice_schemes` table, which has no channel to the
 * screen yet. Its prefix/padding edits and "Next: INV-…" preview were fiction,
 * so the page only explains this and is no longer listed on the Settings hub.
 * Bring the editor back once a channel over `invoice_schemes` exists.
 */
export default function InvoiceSchemesPage() {
  return (
    <div>
      <SettingsHeader title="Invoice numbering" />
      <div className="p-6 max-w-3xl">
        <Card className="p-5 flex items-start gap-3">
          <Info className="size-5 text-primary shrink-0 mt-0.5" aria-hidden />
          <div className="space-y-2 text-sm">
            <div className="font-semibold">Invoice numbers cannot be changed here yet</div>
            <p className="text-muted-foreground">
              The app gives every sale, purchase and return its own number automatically, one after another.
              Changing the number format is not available in this version.
            </p>
            <Link to="/settings" className="inline-flex text-primary font-medium hover:underline">
              Back to Settings
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
