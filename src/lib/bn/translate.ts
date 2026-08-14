/**
 * Runtime Bangla localisation layer.
 *
 * WHY THIS EXISTS
 * The UI is ~200 components with English text written inline. Threading a
 * `t()` call through every one of them would be a huge, risky edit touching
 * every screen. Instead this walks the rendered DOM and swaps any text that
 * EXACTLY matches a dictionary key (see `dict.ts`).
 *
 * WHY IT IS SAFE FOR SHOP DATA
 * Lookup is exact-match on a fixed dictionary of UI phrases. Product names,
 * customer names, invoice numbers, amounts and notes are not keys, so they can
 * never be rewritten. Anything not in the dictionary passes through unchanged.
 *
 * HOW THE ROUND TRIP WORKS (this is the subtle part)
 * Every write we make to the DOM comes back to us as a MutationRecord. If we
 * treated those as "React changed this text", we would throw away the English
 * original we just saved and could never restore it — the UI would be stuck in
 * Bangla. So each write is recorded in `ourWrites`, and a mutation whose value
 * still matches what we wrote is ignored. Anything else is a genuine React
 * update: we forget the old original and translate the new text afresh.
 *
 * Originals live in WeakMaps, and restoring walks the live DOM instead of
 * iterating a list, so detached nodes are never retained.
 *
 * Opt out of translation for a subtree with `data-no-i18n` on the element.
 */
import { BN } from './dict';

/** Elements whose text must never be touched. */
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA']);

/** Attributes that hold user-visible copy. */
const TEXT_ATTRS = ['placeholder', 'title', 'aria-label'] as const;

/** Trailing decorations we translate around, e.g. "Name *" or "Search…". */
const SUFFIX = /([\s:*…?.]+)$/;

/** English source text, keyed by the node we replaced it in. */
const originalText = new WeakMap<Text, string>();
const originalAttr = new WeakMap<Element, Map<string, string>>();

/** The exact values WE last wrote, so our own mutations can be ignored. */
const ourTextWrites = new WeakMap<Text, string>();
const ourAttrWrites = new WeakMap<Element, Map<string, string>>();

let observer: MutationObserver | null = null;
let active = false;

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Reverse lookup used only as a restore fallback, for nodes translated before a
 * hot reload wiped the WeakMaps. Built from unambiguous pairs only: several
 * English words share one Bangla word ("Qty"/"Quantity", "Note"/"Notes"), and
 * guessing which one to put back would corrupt the UI.
 */
const REVERSE: Record<string, string | null> = {};
for (const [en, bn] of Object.entries(BN)) {
  REVERSE[bn] = bn in REVERSE ? null : en; // null marks "ambiguous, don't touch"
}

/**
 * Translate a single phrase. Returns null when there is no translation, so
 * callers can leave the node completely untouched.
 */
export function translatePhrase(raw: string): string | null {
  const value = norm(raw);
  if (!value) return null;

  const direct = BN[value];
  if (direct) return direct;

  // "Name *", "Search…", "Total:" → translate the core, keep the decoration.
  const m = SUFFIX.exec(value);
  if (m) {
    const core = value.slice(0, -m[1].length);
    const hit = BN[core];
    if (hit) return hit + m[1];
  }
  return null;
}

function skipped(node: Node): boolean {
  let el = node.parentElement;
  while (el) {
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.hasAttribute('data-no-i18n')) return true;
    el = el.parentElement;
  }
  return false;
}

/** Preserve surrounding whitespace so inline spacing is unchanged. */
function reclothe(source: string, phrase: string): string {
  const lead = /^\s*/.exec(source)![0];
  const trail = /\s*$/.exec(source)![0];
  return lead + phrase + trail;
}

function applyToText(node: Text): void {
  const current = node.nodeValue;
  if (!current || !current.trim()) return;
  if (skipped(node)) return;

  const source = originalText.get(node) ?? current;
  const phrase = translatePhrase(source);
  if (!phrase) return;

  const next = reclothe(source, phrase);
  if (next === current) return;

  originalText.set(node, source);
  node.nodeValue = next;
  ourTextWrites.set(node, next);
}

function applyToAttrs(el: Element): void {
  if (el.closest('[data-no-i18n]')) return;
  for (const attr of TEXT_ATTRS) {
    const current = el.getAttribute(attr);
    if (!current) continue;

    const source = originalAttr.get(el)?.get(attr) ?? current;
    const phrase = translatePhrase(source);
    if (!phrase) continue;

    const next = reclothe(source, phrase);
    if (next === current) continue;

    const originals = originalAttr.get(el) ?? new Map<string, string>();
    originals.set(attr, source);
    originalAttr.set(el, originals);

    el.setAttribute(attr, next);

    const written = ourAttrWrites.get(el) ?? new Map<string, string>();
    written.set(attr, next);
    ourAttrWrites.set(el, written);
  }
}

/** Was this the value we ourselves last wrote? */
function isOurTextWrite(node: Text): boolean {
  return ourTextWrites.get(node) === node.nodeValue;
}
function isOurAttrWrite(el: Element, attr: string): boolean {
  return ourAttrWrites.get(el)?.get(attr) === el.getAttribute(attr);
}

function eachNode(root: Node, onText: (t: Text) => void, onEl: (e: Element) => void): void {
  if (root.nodeType === Node.TEXT_NODE) {
    onText(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;

  const el = root as Element;
  if (SKIP_TAGS.has(el.tagName) || el.hasAttribute('data-no-i18n')) return;

  onEl(el);
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n: Node | null = tw.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) onText(n as Text);
    else onEl(n as Element);
    n = tw.nextNode();
  }
}

const translateTree = (root: Node) => eachNode(root, applyToText, applyToAttrs);

/** Translate everything currently on screen and keep watching for new nodes. */
export function startBanglaUI(): void {
  if (active) return;
  active = true;

  translateTree(document.body);

  observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') {
        const node = r.target as Text;
        // Ignore the echo of our own write; otherwise React replaced the text
        // and the stored English original is stale.
        if (isOurTextWrite(node)) continue;
        originalText.delete(node);
        applyToText(node);
      } else if (r.type === 'attributes') {
        if (r.target.nodeType !== Node.ELEMENT_NODE) continue;
        const el = r.target as Element;
        const attr = r.attributeName;
        if (!attr) continue;
        if (isOurAttrWrite(el, attr)) continue;
        originalAttr.get(el)?.delete(attr);
        applyToAttrs(el);
      } else {
        r.addedNodes.forEach(translateTree);
      }
    }
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...TEXT_ATTRS],
  });
}

/**
 * Stop watching and put the visible UI back to English.
 *
 * Walks the live DOM rather than a saved list: only what is on screen matters,
 * and this way nothing keeps detached nodes alive.
 */
export function stopBanglaUI(): void {
  observer?.disconnect();
  observer = null;
  if (!active) return;
  active = false;

  eachNode(
    document.body,
    (node) => {
      const current = node.nodeValue;
      if (!current || !current.trim()) return;

      const saved = originalText.get(node);
      if (saved !== undefined) {
        if (current !== saved) node.nodeValue = saved;
        originalText.delete(node);
        ourTextWrites.delete(node);
        return;
      }
      // Fallback for nodes translated before a hot reload cleared the maps.
      const back = REVERSE[norm(current)];
      if (back) node.nodeValue = reclothe(current, back);
    },
    (el) => {
      const saved = originalAttr.get(el);
      if (!saved) return;
      for (const [attr, value] of saved) el.setAttribute(attr, value);
      originalAttr.delete(el);
      ourAttrWrites.delete(el);
    },
  );
}

/** True while the Bangla layer is running. */
export function isBanglaUIActive(): boolean {
  return active;
}
