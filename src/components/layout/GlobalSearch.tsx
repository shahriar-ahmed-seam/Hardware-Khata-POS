import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Package, User, Truck, Receipt, X } from 'lucide-react';
import {
  parseSearch,
  runSearch,
  mapBackendResults,
  SCOPE_HINTS,
  type SearchScope,
  type SearchResult,
  type BackendSearchPayload,
} from '@/lib/search';
import { api, hasBackend } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

const ICONS: Record<string, any> = {
  invoice: Receipt,
  product: Package,
  customer: User,
  supplier: Truck,
};

const scopeColor: Record<SearchScope, string> = {
  all: 'bg-secondary text-secondary-foreground',
  invoice: 'bg-primary/15 text-primary',
  product: 'bg-success/15 text-success',
  sku: 'bg-success/15 text-success',
  barcode: 'bg-success/15 text-success',
  customer: 'bg-accent/15 text-accent',
  supplier: 'bg-warning/15 text-warning',
};

export function GlobalSearch() {
  const { t } = useT();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nav = useNavigate();

  // Track the input's screen position so the portal dropdown can sit right under it.
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const updateRect = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.bottom + 8, width: r.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [open, updateRect]);

  const parsed = useMemo(() => parseSearch(q), [q]);
  const backend = hasBackend();

  // Mock results computed synchronously (also the !hasBackend() fallback).
  const mockResults = useMemo(() => runSearch(parsed), [parsed]);

  // Backend results: fetched (debounced ~200ms) from search.global. A
  // monotonically-increasing request id guards against stale responses
  // overwriting newer ones (last-write-wins).
  const [beResults, setBeResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!backend) return;
    const term = parsed.term.trim();
    if (!term) {
      setBeResults([]);
      setLoading(false);
      return;
    }
    const reqId = ++reqIdRef.current;
    setLoading(true);
    const handle = setTimeout(() => {
      void api<BackendSearchPayload>('search.global', {
        query: term,
        scope: parsed.scope === 'all' ? undefined : parsed.scope,
      })
        .then((payload) => {
          // Drop stale responses.
          if (reqId !== reqIdRef.current) return;
          setBeResults(mapBackendResults(payload));
          setLoading(false);
        })
        .catch(() => {
          if (reqId !== reqIdRef.current) return;
          setBeResults([]);
          setLoading(false);
        });
    }, 200);
    return () => clearTimeout(handle);
  }, [backend, parsed.term, parsed.scope]);

  const results = backend ? beResults : mockResults;
  const showHints = parsed.scope === 'all' && !parsed.term;

  // Ctrl+K shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Close on outside click — checks both the input wrapper and the portaled panel.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  // Reset highlight when results change
  useEffect(() => setHi(0), [q]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) setOpen(true);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHi((h) => Math.min(h + 1, Math.max(0, results.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && results[hi]) {
      e.preventDefault();
      pick(results[hi].to);
    }
  };

  const pick = (to: string) => {
    nav(to);
    setOpen(false);
    setQ('');
  };

  return (
    <div ref={ref} className="titlebar-no-drag flex-1 max-w-xl mx-auto relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t('titlebar.search.placeholder')}
          className="w-full bg-secondary/70 hover:bg-secondary focus:bg-secondary text-xs rounded-md pl-8 pr-16 py-1.5 outline-none focus:ring-2 focus:ring-ring/50 placeholder:text-muted-foreground/70 transition"
        />
        {q && (
          <button
            onClick={() => {
              setQ('');
              inputRef.current?.focus();
            }}
            className="absolute right-12 top-1/2 -translate-y-1/2 size-5 grid place-items-center text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        )}
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono bg-background border border-border px-1.5 py-0.5 rounded">
          Ctrl K
        </kbd>
      </div>

      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', left: rect.left, top: rect.top, width: rect.width }}
            className="bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl overflow-hidden z-[60] animate-fade-in"
          >
          {/* Scope chip */}
          {parsed.scope !== 'all' && (
            <div className="px-3 py-1.5 border-b border-border flex items-center gap-2 text-[11px] bg-secondary/40">
              <span className={cn('px-1.5 py-0.5 rounded font-medium', scopeColor[parsed.scope])}>
                {parsed.scope}
              </span>
              <span className="text-muted-foreground">filter ·</span>
              <span className="font-mono">{parsed.term || '…'}</span>
            </div>
          )}

          {/* Hints when no query */}
          {showHints && (
            <div className="p-2">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
                Smart filters — type to narrow search
              </div>
              <div className="grid grid-cols-2 gap-1 mt-1">
                {SCOPE_HINTS.map((h) => (
                  <button
                    key={h.scope}
                    onClick={() => {
                      setQ(`#${h.scope}:`);
                      inputRef.current?.focus();
                    }}
                    className="text-left px-2 py-1.5 rounded hover:bg-secondary"
                  >
                    <div className="text-xs font-medium">{h.label}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {h.example}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {!showHints && loading && results.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              Searching…
            </div>
          )}

          {!showHints && !loading && results.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              No matches for "{parsed.term}"
            </div>
          )}

          {!showHints && results.length > 0 && (
            <div className="max-h-80 overflow-auto py-1">
              {results.map((r, i) => {
                const Icon = ICONS[r.type] ?? FileText;
                return (
                  <button
                    key={r.id}
                    onMouseEnter={() => setHi(i)}
                    onClick={() => pick(r.to)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-left',
                      i === hi ? 'bg-secondary' : 'hover:bg-secondary/60',
                    )}
                  >
                    <div className="size-7 rounded-md bg-secondary grid place-items-center text-muted-foreground shrink-0">
                      <Icon className="size-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{r.title}</div>
                      {r.subtitle && (
                        <div className="text-[10px] text-muted-foreground truncate">
                          {r.subtitle}
                        </div>
                      )}
                    </div>
                    {r.meta && (
                      <div className="text-[10px] font-mono text-muted-foreground">{r.meta}</div>
                    )}
                    <div className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground/70">
                      {r.type}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Footer hint */}
          <div className="px-3 py-1.5 border-t border-border bg-secondary/30 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              <kbd className="font-mono">↑↓</kbd> navigate ·{' '}
              <kbd className="font-mono">Enter</kbd> open ·{' '}
              <kbd className="font-mono">Esc</kbd> close
            </span>
            <span>
              Try <span className="font-mono">#invoice:</span>,{' '}
              <span className="font-mono">#product:</span>
            </span>
          </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
