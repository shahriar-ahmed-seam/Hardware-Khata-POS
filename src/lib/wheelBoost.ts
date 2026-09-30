/**
 * MOUSE-WHEEL SPEED ON LINUX.
 *
 * Chromium on Linux (X11, which Electron 22 uses) scrolls about 53px per wheel
 * notch; on Windows it is 100px. So on a Linux PC every list here moved at half
 * the speed people expect and needed twice the wheel turning. This doubles the
 * distance on Linux only — Windows (the shop's own PC) is left exactly as it is,
 * because this module does nothing there.
 *
 * How: a wheel listener finds the box under the pointer that can actually
 * scroll that way (walking up to its parents, like the browser does when a list
 * reaches its end), cancels the native scroll and glides that box by twice the
 * distance. Nothing else changes:
 *  - Ctrl + wheel (zoom), line/page-mode events and anything another handler
 *    already took are left to the browser;
 *  - with nothing scrollable under the pointer the browser keeps the event;
 *  - "Reduce animations" (Settings → Performance) makes the step instant;
 *  - a scrollbar drag, a key press or scrollIntoView during the glide wins —
 *    the glide just stops.
 */

const FACTOR = 2;
/** Share of the remaining distance covered each frame (≈ 200 ms to settle). */
const EASE = 0.35;

type Glide = {
  tx: number;
  ty: number;
  setX: number;
  setY: number;
  raf: number;
  /** Finishes the step if animation frames stall (window covered / throttled). */
  timer: ReturnType<typeof setTimeout> | 0;
  last: number;
};
/** A frame at 60 Hz; the ease is scaled to real frame time. */
const FRAME_MS = 1000 / 60;
const FALLBACK_MS = 350;
const glides = new WeakMap<Element, Glide>();

const reduceMotion = () => document.documentElement.classList.contains('reduce-motion');

function scrollable(el: Element, axis: 'x' | 'y', dir: number): boolean {
  const cs = getComputedStyle(el);
  const ov = axis === 'y' ? cs.overflowY : cs.overflowX;
  if (ov !== 'auto' && ov !== 'scroll' && ov !== 'overlay') return false;
  const max = axis === 'y' ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;
  if (max < 1) return false;
  // Where the box is heading (mid-glide), not where it is this frame.
  const g = glides.get(el);
  const at = g ? (axis === 'y' ? g.ty : g.tx) : axis === 'y' ? el.scrollTop : el.scrollLeft;
  return dir > 0 ? at < max - 0.5 : at > 0.5;
}

function targetFor(start: EventTarget | null, axis: 'x' | 'y', dir: number): Element | null {
  let el = start instanceof Element ? start : null;
  while (el && el !== document.body && el !== document.documentElement) {
    if (scrollable(el, axis, dir)) return el;
    el = el.parentElement;
  }
  return null;
}

function glide(el: Element, dx: number, dy: number) {
  const maxX = el.scrollWidth - el.clientWidth;
  const maxY = el.scrollHeight - el.clientHeight;
  const clamp = (v: number, max: number) => Math.min(Math.max(0, v), Math.max(0, max));
  let g = glides.get(el);
  if (!g) {
    g = {
      tx: el.scrollLeft,
      ty: el.scrollTop,
      setX: el.scrollLeft,
      setY: el.scrollTop,
      raf: 0,
      timer: 0,
      last: 0,
    };
    glides.set(el, g);
  }
  g.tx = clamp(g.tx + dx, maxX);
  g.ty = clamp(g.ty + dy, maxY);

  const finish = () => {
    const cur = glides.get(el);
    if (!cur) return;
    cancelAnimationFrame(cur.raf);
    if (cur.timer) clearTimeout(cur.timer);
    el.scrollLeft = cur.tx;
    el.scrollTop = cur.ty;
    glides.delete(el);
  };

  if (reduceMotion()) {
    finish();
    return;
  }
  // Each notch re-arms the safety net; the glide itself settles well before it.
  if (g.timer) clearTimeout(g.timer);
  g.timer = setTimeout(finish, FALLBACK_MS);
  if (g.raf) return; // already gliding — the new target is picked up

  const step = (now: number) => {
    const cur = glides.get(el);
    if (!cur) return;
    // Something else moved the box between frames. A big jump is a person
    // (scrollbar drag, Page Down, a jump to a row): stop and let it be. A small
    // one is the browser keeping content steady while something above it
    // resizes (scroll anchoring) — follow it, or every such nudge cut the
    // wheel step short.
    const extX = el.scrollLeft - cur.setX;
    const extY = el.scrollTop - cur.setY;
    if (Math.abs(extX) > 48 || Math.abs(extY) > 48) {
      if (cur.timer) clearTimeout(cur.timer);
      glides.delete(el);
      return;
    }
    cur.tx += extX;
    cur.ty += extY;
    const rx = cur.tx - el.scrollLeft;
    const ry = cur.ty - el.scrollTop;
    if (Math.abs(rx) < 0.5 && Math.abs(ry) < 0.5) {
      finish();
      return;
    }
    // Same feel at 30 Hz as at 60 Hz: the ease is scaled to the frame time.
    const dt = cur.last ? Math.min(100, now - cur.last) : FRAME_MS;
    cur.last = now;
    const k = 1 - Math.pow(1 - EASE, dt / FRAME_MS);
    el.scrollLeft += rx * k;
    el.scrollTop += ry * k;
    // Read back: the browser rounds to whole device pixels.
    cur.setX = el.scrollLeft;
    cur.setY = el.scrollTop;
    cur.raf = requestAnimationFrame(step);
  };
  g.raf = requestAnimationFrame(step);
}

function onWheel(e: WheelEvent) {
  if (e.defaultPrevented || e.ctrlKey || e.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return;
  // Shift + wheel scrolls sideways; some builds still report it as deltaY.
  const shiftSideways = e.shiftKey && e.deltaX === 0;
  const horizontal = shiftSideways || Math.abs(e.deltaX) > Math.abs(e.deltaY);
  const d = shiftSideways ? e.deltaY : horizontal ? e.deltaX : e.deltaY;
  if (d === 0) return;
  const el = targetFor(e.target, horizontal ? 'x' : 'y', d);
  if (!el) return;
  e.preventDefault();
  glide(el, horizontal ? d * FACTOR : 0, horizontal ? 0 : d * FACTOR);
}

/** Call once at start-up. A no-op everywhere except Linux. */
export function installWheelBoost(): void {
  const ua = navigator.userAgent;
  if (!/Linux/.test(ua) || /Android|CrOS/.test(ua)) return;
  // Non-passive so the native (half-speed) scroll can be cancelled.
  window.addEventListener('wheel', onWheel, { passive: false });
}
