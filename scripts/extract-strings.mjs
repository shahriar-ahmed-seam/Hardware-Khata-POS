// TEMP dev tool: extract candidate UI strings from src/ so the Bangla dictionary
// covers what is actually rendered. Not part of the app build.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('src');
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name)) files.push(p);
  }
})(ROOT);

const counts = new Map();
const bump = (s) => {
  if (!s) return;
  let v = s.replace(/\s+/g, ' ').trim();
  if (!v) return;
  if (v.length < 2 || v.length > 70) return;
  if (!/[A-Za-z]/.test(v)) return;             // must contain letters
  if (/^[a-z][a-zA-Z0-9]*$/.test(v)) return;   // camelCase identifiers
  if (/[{}<>$`\\]/.test(v)) return;            // template/JSX leftovers
  if (/^(px|rem|em|hsl|rgb|var|http|div|span|svg|true|false|null|undefined)/i.test(v)) return;
  if (/^[-_/.#0-9\s]+$/.test(v)) return;
  counts.set(v, (counts.get(v) ?? 0) + 1);
};

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');

  // JSX text between tags
  for (const m of src.matchAll(/>([^<>{}\n][^<>{}]*)</g)) bump(m[1]);

  // common string-valued props
  for (const m of src.matchAll(
    /\b(placeholder|title|label|heading|subtitle|desc|description|hint|emptyText|tooltip|ariaLabel|aria-label|name|text|confirmLabel|cancelLabel|message)\s*[:=]\s*'([^']+)'/g,
  ))
    bump(m[2]);
  for (const m of src.matchAll(
    /\b(placeholder|title|label|heading|subtitle|desc|description|hint|emptyText|tooltip|ariaLabel|aria-label|text|message)\s*=\s*"([^"]+)"/g,
  ))
    bump(m[2]);

  // toast / confirm strings
  for (const m of src.matchAll(/toast\.\w+\(\s*'([^']+)'/g)) bump(m[1]);
  for (const m of src.matchAll(/confirm\w*\(\s*\{[^}]*?'([^']+)'/g)) bump(m[1]);

  // string arrays of options/tabs
  for (const m of src.matchAll(/'([A-Z][A-Za-z0-9 %()\/&.,'’+-]{2,60})'/g)) bump(m[1]);
}

const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
fs.writeFileSync(
  'scripts/strings.txt',
  sorted.map(([s, n]) => `${String(n).padStart(4)}  ${s}`).join('\n'),
  'utf8',
);
console.log('unique candidates:', sorted.length, '→ scripts/strings.txt');
