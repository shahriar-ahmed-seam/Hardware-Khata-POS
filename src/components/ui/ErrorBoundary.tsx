import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw, Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  info?: ErrorInfo;
}

/**
 * App-level error boundary. Catches render-time errors so a single broken page
 * doesn't blank the whole window. Offers reload + copy-details.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production this would log to a crash store / file. For now, console.
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info);
    this.setState({ info });
  }

  reset = () => this.setState({ hasError: false, error: undefined, info: undefined });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const { error, info } = this.state;
    const details = `${error?.name}: ${error?.message}\n${error?.stack ?? ''}\n${info?.componentStack ?? ''}`;

    return (
      <div className="h-full w-full grid place-items-center p-8">
        <div className="max-w-lg w-full text-center">
          <div className="size-14 rounded-full bg-destructive/10 text-destructive grid place-items-center mx-auto mb-4">
            <AlertOctagon className="size-7" />
          </div>
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground mt-1">
            This screen hit an unexpected error. Your data is safe. Try reloading the view; if it
            keeps happening, note what you were doing and report it.
          </p>
          {error && (
            <pre className="mt-4 text-left text-[11px] bg-secondary/60 rounded-md p-3 max-h-40 overflow-auto font-mono text-muted-foreground">
              {error.name}: {error.message}
            </pre>
          )}
          <div className="flex items-center justify-center gap-2 mt-5">
            <Button onClick={this.reset}>
              <RotateCcw className="size-4" /> Try again
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload app
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                navigator.clipboard?.writeText(details);
              }}
            >
              <Copy className="size-4" /> Copy details
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
