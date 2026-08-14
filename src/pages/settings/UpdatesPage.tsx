import { useEffect } from 'react';
import {
  RefreshCw,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Wifi,
} from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useUpdates } from '@/stores/updates';
import { cn } from '@/lib/utils';

/**
 * SETTINGS → UPDATES
 *
 * Three states matter to the owner and nothing else: you are up to date, there
 * is a new version, or a new version is ready to install. Everything on this
 * screen comes from the main process — see src/stores/updates.ts.
 */
export default function UpdatesPage() {
  const state = useUpdates((s) => s.state);
  const busy = useUpdates((s) => s.busy);
  const hydrate = useUpdates((s) => s.hydrate);
  const subscribe = useUpdates((s) => s.subscribe);
  const check = useUpdates((s) => s.check);
  const download = useUpdates((s) => s.download);
  const install = useUpdates((s) => s.install);
  const setAutoCheck = useUpdates((s) => s.setAutoCheck);
  const openReleases = useUpdates((s) => s.openReleases);

  useEffect(() => {
    void hydrate();
    // Download progress is pushed, not polled.
    return subscribe();
  }, [hydrate, subscribe]);

  const isDev = state.phase === 'unsupported';

  return (
    <div>
      <SettingsHeader
        title="Updates"
        subtitle="Get the newest version without copying files between computers"
        actions={
          <Button onClick={() => void check()} disabled={busy || isDev}>
            <RefreshCw className={cn('size-4', state.phase === 'checking' && 'animate-spin')} />
            Check for updates
          </Button>
        }
      />

      <div className="p-6 max-w-3xl space-y-6">
        {/* ---------------- Current state ---------------- */}
        <Card className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'size-10 rounded-md grid place-items-center shrink-0',
                state.phase === 'downloaded' || state.phase === 'available'
                  ? 'bg-primary/10 text-primary'
                  : state.phase === 'error'
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-secondary text-muted-foreground',
              )}
            >
              {state.phase === 'error' ? (
                <AlertCircle className="size-5" />
              ) : state.phase === 'available' || state.phase === 'downloaded' ? (
                <Download className="size-5" />
              ) : (
                <CheckCircle2 className="size-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">This app</span>
                <Badge variant="default">
                  <span data-no-i18n>v{state.currentVersion}</span>
                </Badge>
                {state.phase === 'up-to-date' && (
                  <Badge variant="success">
                    <CheckCircle2 className="size-3" /> Up to date
                  </Badge>
                )}
                {(state.phase === 'available' || state.phase === 'downloading') && (
                  <Badge variant="info">Update available</Badge>
                )}
                {state.phase === 'downloaded' && <Badge variant="success">Ready to install</Badge>}
              </div>

              <div className="text-xs text-muted-foreground mt-1">
                {isDev
                  ? 'Updates only work in the installed app, not while running from source.'
                  : state.lastCheckedAt
                    ? `Last checked ${new Date(state.lastCheckedAt).toLocaleString('en-GB')}`
                    : 'Not checked yet'}
              </div>
            </div>
          </div>

          {/* New version found */}
          {(state.phase === 'available' ||
            state.phase === 'downloading' ||
            state.phase === 'downloaded') && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-semibold text-sm">
                    Version <span data-no-i18n>{state.newVersion}</span> is available
                  </div>
                  {state.releaseDate && (
                    <div className="text-xs text-muted-foreground">
                      Released {new Date(state.releaseDate).toLocaleDateString('en-GB')}
                    </div>
                  )}
                </div>

                {state.phase === 'available' && (
                  <Button onClick={() => void download()} disabled={busy}>
                    <Download className="size-4" /> Download update
                  </Button>
                )}
                {state.phase === 'downloaded' && (
                  <Button onClick={() => void install()} disabled={busy}>
                    <RotateCcw className="size-4" /> Restart and install
                  </Button>
                )}
              </div>

              {state.phase === 'downloading' && (
                <div className="space-y-1.5">
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary transition-[width]"
                      style={{ width: `${state.percent ?? 0}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground tabular">
                    <span data-no-i18n>
                      {state.percent ?? 0}%
                      {state.total
                        ? ` · ${mb(state.transferred ?? 0)} / ${mb(state.total)} MB`
                        : ''}
                      {state.bytesPerSecond ? ` · ${mb(state.bytesPerSecond)} MB/s` : ''}
                    </span>
                  </div>
                </div>
              )}

              {state.phase === 'downloaded' && (
                <div className="text-xs text-muted-foreground">
                  The app will close, install, and open again. Finish any sale on screen first.
                </div>
              )}

              {state.releaseNotes && (
                <div className="text-xs text-muted-foreground whitespace-pre-line border-t border-border pt-2">
                  {state.releaseNotes}
                </div>
              )}
            </div>
          )}

          {/* NOT A FAILURE: nothing has been released yet. Shown calmly, because
              telling the owner to check their internet would send them chasing a
              problem that does not exist. */}
          {state.phase === 'error' && state.errorKind === 'no-releases' && (
            <div className="rounded-md border border-border bg-muted/40 p-4 space-y-2">
              <div className="font-semibold text-sm">No update has been published yet</div>
              <div className="text-xs text-muted-foreground">
                Your app reached the update server and it has nothing newer to offer. This is
                normal right after a fresh install — you already have the newest build.
              </div>
            </div>
          )}

          {/* A real failure — always offer the manual way out */}
          {state.phase === 'error' && state.errorKind !== 'no-releases' && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-2">
              <div className="font-semibold text-sm">Could not check for updates</div>
              <div className="text-xs text-muted-foreground break-words" data-no-i18n>
                {state.error}
              </div>
              <div className="text-xs text-muted-foreground">
                {state.errorKind === 'network'
                  ? 'The computer could not reach the internet. Try again once it is back.'
                  : 'You can also download the installer by hand.'}
              </div>
              <Button variant="outline" size="sm" onClick={() => void openReleases()}>
                <ExternalLink className="size-4" /> Open downloads page
              </Button>
            </div>
          )}
        </Card>

        {/* ---------------- Preference ---------------- */}
        <Card className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="font-semibold text-sm">Check automatically</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Looks for a new version a few seconds after the app opens. Nothing is ever
                downloaded or installed without you pressing the button.
              </div>
            </div>
            <button
              role="switch"
              aria-checked={state.autoCheck}
              onClick={() => void setAutoCheck(!state.autoCheck)}
              disabled={isDev}
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50',
                state.autoCheck ? 'bg-primary' : 'bg-secondary',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]',
                  state.autoCheck ? 'left-[1.375rem]' : 'left-0.5',
                )}
              />
            </button>
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-3 flex items-start gap-2.5">
            <Wifi className="size-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground">
              This is the only thing in the app that uses the internet. It asks GitHub whether a
              newer version exists and sends nothing about your shop — no sales, no customers, no
              names. Turn it off and the app never connects to anything.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/** Bytes → MB with one decimal. Display only. */
function mb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}
