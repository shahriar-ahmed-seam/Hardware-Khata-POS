/**
 * Sanity checks for the Bangla layer. Run: npm run i18n:check
 *
 * Covers the three things that must never break:
 *  1. phrase lookup (including decorated forms like "Name *")
 *  2. shop DATA is never rewritten
 *  3. EN → BN → EN is a perfect round trip, even across React re-renders
 */
import { readFile } from 'node:fs/promises';
import { BN } from '../src/lib/bn/dict';

let pass = 0;
let fail = 0;
const check = (name: string, got: unknown, want: unknown) => {
  if (got === want) pass++;
  else {
    fail++;
    console.error(`FAIL ${name}\n  expected: ${JSON.stringify(want)}\n  actual:   ${JSON.stringify(got)}`);
  }
};

// --------------------------------------------------------------- minimal DOM
// The translator only needs text nodes, elements, a TreeWalker and
// MutationObserver. jsdom is not a dependency here, so this is a tiny stand-in
// that models the parts we use — including delivering mutation records
// asynchronously, which is what exposed the original round-trip bug.
class TextNode {
  nodeType = 3;
  parentElement: El | null = null;
  constructor(public nodeValue: string) {}
  get isConnected(): boolean {
    return !!this.parentElement;
  }
}

type AnyNode = TextNode | El;

class El {
  nodeType = 1;
  parentElement: El | null = null;
  children: AnyNode[] = [];
  attrs = new Map<string, string>();
  constructor(public tagName: string) {}
  append(...kids: AnyNode[]) {
    for (const k of kids) {
      k.parentElement = this;
      this.children.push(k);
    }
    notify({ type: 'childList', addedNodes: kids });
    return this;
  }
  setAttribute(k: string, v: string) {
    this.attrs.set(k, v);
    notify({ type: 'attributes', target: this, attributeName: k });
  }
  getAttribute(k: string) {
    return this.attrs.get(k) ?? null;
  }
  hasAttribute(k: string) {
    return this.attrs.has(k);
  }
  closest(sel: string): El | null {
    const attr = sel.replace(/[[\]]/g, '');
    let cur: El | null = this;
    while (cur) {
      if (cur.hasAttribute(attr)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }
  /** Depth-first list of descendants, mirroring a TreeWalker. */
  descendants(): AnyNode[] {
    const out: AnyNode[] = [];
    const visit = (n: AnyNode) => {
      if (n instanceof El) for (const c of n.children) (out.push(c), visit(c));
    };
    visit(this);
    return out;
  }
}

type Rec = { type: string; target?: any; attributeName?: string; addedNodes?: AnyNode[] };
let sink: ((r: Rec[]) => void) | null = null;
let queue: Rec[] = [];
function notify(r: Rec) {
  if (!sink) return;
  queue.push(r);
}
/** Flush queued records the way the browser does — in a later task. */
function flush() {
  while (queue.length) {
    const batch = queue;
    queue = [];
    sink?.(batch);
  }
}

/** Set a text node's value the way React would (direct assignment). */
function reactWrite(node: TextNode, value: string) {
  node.nodeValue = value;
  notify({ type: 'characterData', target: node });
}

const body = new El('BODY');

(globalThis as any).Node = { TEXT_NODE: 3, ELEMENT_NODE: 1 };
(globalThis as any).NodeFilter = { SHOW_TEXT: 4, SHOW_ELEMENT: 1 };
(globalThis as any).MutationObserver = class {
  constructor(private cb: (r: Rec[]) => void) {}
  observe() {
    sink = this.cb;
  }
  disconnect() {
    sink = null;
  }
};
(globalThis as any).document = {
  body,
  documentElement: { lang: 'en', style: { setProperty() {} } },
  createTreeWalker(root: El) {
    const list = root.descendants();
    let i = -1;
    return {
      nextNode() {
        i++;
        return i < list.length ? list[i] : null;
      },
    };
  },
};

// Import AFTER the DOM stand-in exists.
const { translatePhrase, startBanglaUI, stopBanglaUI } = await import('../src/lib/bn/translate');

// ------------------------------------------------------------------ 1. lookup
check('Dashboard', translatePhrase('Dashboard'), 'ড্যাশবোর্ড');
check('Cash Register', translatePhrase('Cash Register'), 'ক্যাশ বাক্স');
check('More & Settings', translatePhrase('More & Settings'), 'আরও ও সেটিংস');
check('padded', translatePhrase('  Save Changes \n'), 'পরিবর্তন সংরক্ষণ');
check('inner whitespace', translatePhrase('Save   Changes'), 'পরিবর্তন সংরক্ষণ');
check('required marker', translatePhrase('Name *'), 'নাম *');
check('ellipsis', translatePhrase('Search…'), 'খুঁজুন…');
check('colon', translatePhrase('Total:'), 'মোট:');

// -------------------------------------------------------------- 2. shop data
for (const data of [
  'Cement OPC 50kg',
  'Rahim Construction',
  'INV-2026-0451',
  '৳ 12,450.00',
  'BM-CMNT-OPC',
  'Karim Bhai',
  '01711-223344',
])
  check(`untouched: ${data}`, translatePhrase(data), null);
check('unknown copy', translatePhrase('Some phrase nobody translated yet'), null);

// ------------------------------------------------------------ 3. round trip
const label = new TextNode('Dashboard');
const spaced = new TextNode('  Save Changes  '); // whitespace must survive
const productName = new TextNode('Cement OPC 50kg'); // data
const invoice = new TextNode('INV-2026-0451'); // data
const input = new El('INPUT');
input.setAttribute('placeholder', 'Search');
input.setAttribute('title', 'Total');
const protectedEl = new El('SPAN');
protectedEl.setAttribute('data-no-i18n', '');
const protectedText = new TextNode('Total');
protectedEl.append(protectedText);

body.append(label, spaced, productName, invoice, input, protectedEl);

const snapshot = () => ({
  label: label.nodeValue,
  spaced: spaced.nodeValue,
  product: productName.nodeValue,
  invoice: invoice.nodeValue,
  placeholder: input.getAttribute('placeholder'),
  title: input.getAttribute('title'),
  protected: protectedText.nodeValue,
});
const english = JSON.stringify(snapshot());

startBanglaUI();
flush();

check('text translated', label.nodeValue, 'ড্যাশবোর্ড');
check('whitespace kept', spaced.nodeValue, '  পরিবর্তন সংরক্ষণ  ');
check('product untouched', productName.nodeValue, 'Cement OPC 50kg');
check('invoice untouched', invoice.nodeValue, 'INV-2026-0451');
check('placeholder translated', input.getAttribute('placeholder'), 'খুঁজুন');
check('title translated', input.getAttribute('title'), 'মোট');
check('data-no-i18n respected', protectedText.nodeValue, 'Total');

// Simulate React re-rendering the same value, then a changed value, then back.
flush();
reactWrite(label, 'Dashboard');
flush();
check('survives re-render with same text', label.nodeValue, 'ড্যাশবোর্ড');

reactWrite(label, 'Settings');
flush();
check('retranslates changed text', label.nodeValue, 'সেটিংস');

reactWrite(label, 'Dashboard');
flush();

stopBanglaUI();
check('round trip restores every node', JSON.stringify(snapshot()), english);

// A second full cycle must behave identically (catches state left behind).
startBanglaUI();
flush();
check('second cycle translates', label.nodeValue, 'ড্যাশবোর্ড');
stopBanglaUI();
check('second cycle restores', JSON.stringify(snapshot()), english);

// ------------------------------------------------------- 4. dictionary hygiene
const notBengali = Object.entries(BN).filter(([, v]) => !/[\u0980-\u09FF]/.test(v));
check(`all ${Object.keys(BN).length} values are Bengali`, notBengali.length, 0);
if (notBengali.length) console.error(notBengali.slice(0, 10));

const emptyKeys = Object.entries(BN).filter(([k, v]) => !k.trim() || !v.trim());
check('no empty entries', emptyKeys.length, 0);

// ------------------------------------------------- 5. append-only consistency
// The dictionary grows by appending `Object.assign(BN, {…})` blocks, so the same
// English phrase can legitimately appear in more than one block — but the LAST
// one silently wins. If two blocks disagree, a phrase would translate one way in
// one screen and another way elsewhere, with nothing to warn us. The merged
// object cannot reveal this, so the SOURCE is parsed instead.
const source = await readFile(new URL('../src/lib/bn/dict.ts', import.meta.url), 'utf-8');
// The value is often wrapped onto the next line by the formatter, and this file
// uses CRLF endings — hence the explicit `\r?\n?` rather than a bare `\n`.
const ENTRY =
  /(?:^|\r?\n)[ \t]*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|([A-Za-z_$][\w$]*))[ \t]*:[ \t]*(?:\r?\n)?[ \t]*'((?:[^'\\]|\\.)*)'/g;
const seen = new Map<string, string>();
const conflicts: string[] = [];
let entries = 0;
for (const m of source.matchAll(ENTRY)) {
  const key = (m[1] ?? m[2] ?? m[3]).replace(/\\'/g, "'");
  const value = m[4];
  entries++;
  const prior = seen.get(key);
  if (prior !== undefined && prior !== value) conflicts.push(`${key}: "${prior}" vs "${value}"`);
  else seen.set(key, value);
}
check('the source parser found every entry', seen.size, Object.keys(BN).length);
check('duplicate keys all agree on one translation', conflicts.length, 0);
if (conflicts.length) console.error(conflicts.slice(0, 10));
console.log(`bn dictionary: ${entries} source lines, ${seen.size} distinct keys`);

console.log(`\nbn dictionary: ${Object.keys(BN).length} phrases`);
console.log(`checks: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
