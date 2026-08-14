# Agent / Developer Handoff

If you are a new agent or developer picking this project up, read this top to bottom
before touching code. It tells you how to orient, what the rules are, and how to continue
without breaking what works. For the full story of how the project got here, read
`05-CONTEXT-AND-HISTORY.md`.

## 1. Orient in 5 minutes

0. **Read `docs/07-CONTINUE-HERE.md` first** — the current state, what changed in
   the last session, the open gaps, and the environment footguns. This file gives
   you the rules; that one gives you the situation.
1. Read `docs/00-OVERVIEW.md` (the map + current status).
2. Skim `docs/01-FRONTEND.md` and `docs/02-BACKEND.md`.
3. Read `docs/03-WHATS-LEFT.md` (your work queue — packaging is the remaining 🔴).
4. Read `docs/05-CONTEXT-AND-HISTORY.md` (every decision + the working agreement).
5. Check `TASKS.md` and `BACKEND_NOTES.md` for the original spec.

## 2. Prove the current state works (do this first, every session)

```bash
npm install
npm run backend:verify:all   # must print 860 checks passed, seven suites (rebuilds for Node ABI)
npx tsc --noEmit -p tsconfig.json   # frontend typecheck — must be clean
npm run build                # renderer + main + preload must build clean
npm run rebuild:electron     # leave better-sqlite3 on the Electron ABI for `npm run dev`
```

`backend:verify:all` runs seven suites; the expected per-suite counts are:

| Suite | Checks |
|-------|-------:|
| `all.ts` (scenarios + determinism + file-DB smoke + identities) | 309 |
| `api.ts` (buildApi facade, 146 channels) | 193 |
| `run.ts` (365-day identities) | 56 |
| `e2e.ts` (full shop day) | 68 |
| `paging.ts` (paginated list reads) | 80 |
| `backup.ts` (backup & cloud saving) | 68 |
| **total** | **860** |

If these pass, the foundation is intact. If `backend:verify:all` fails, **stop and
diagnose** — a failing identity check is a real correctness bug, not a flaky test.

## 3. The non-negotiable rules

1. **Stock is `SUM(stock_movements.qty)` per (product, branch).** Never add a stored
   stock column. Every stock change is a signed, reasoned, referenced movement.
2. **Balances are derived.** Customer/supplier due and cash-drawer expected are computed
   from transactions, never stored as running totals.
3. **All money flows through `backend/core/`.** Use `computeSaleTotals`, `round2`, etc.
   Never sum raw floats in new code. Money compares within a 1-paisa epsilon.
4. **Every write is a transaction.** Wrap multi-step writes in `tx(db, () => {...})`.
5. **Match the native ABI to the runtime.** `npm run dev` → Electron ABI;
   `npm run backend:verify*` → Node ABI. Wrong ABI = `ERR_DLOPEN_FAILED`. Finish every
   session with `npm run rebuild:electron`.
6. **Add a verification check for every new invariant.** New money/stock rule → add an
   assertion in `backend/verify/` so it's protected forever.
7. **Permission enforcement lives ONLY at the IPC boundary** (`electron/ipc.ts` +
   `electron/permissions.ts`). NEVER put it in `backend/services/*` or `buildApi()` — that
   would break the Node verify harness (which calls handlers directly). Any new WRITE
   channel gets an entry in `electron/permissions.ts`.
8. **NEVER reintroduce mock/sample data.** This rule used to say the opposite (keep a
   `hasBackend()` mock fallback for browser dev). The owner has since required a clean
   product, so `src/mocks/data.ts` is deleted and every fallback is gone. Domain types live in
   `src/types/domain.ts`. If a figure has no backend source, render `'—'` and exclude it from
   totals — do NOT invent, estimate, or approximate a number. `hasBackend()` may ONLY be used
   as the "skip this query outside Electron" gate on `useReport`.
9. **Bangla is a dictionary, not a component edit.** Add a line to `src/lib/bn/dict.ts`; the
   DOM layer in `src/lib/bn/translate.ts` picks it up. Never translate by editing JSX strings,
   and never widen the lookup beyond exact matches — that is what keeps shop data safe. Run
   `npm run i18n:check` after touching either file.
10. **Font sizes go through the scale.** Don't add new `text-[Npx]` utilities; use `text-xs`
    upward. The px utilities that already exist are remapped to `rem` in `globals.css` so they
    honour the Appearance font-scale slider.
11. **A backup only counts once it's verified.** Snapshots are `VACUUM INTO` copies, reopened
    READ-ONLY (`openDatabase(file, { readonly: true })` — never WAL a snapshot) and checked with
    `PRAGMA integrity_check` + readable core tables before the run reports success; a failed one
    is deleted. Retention keys off the **filename**, not mtime (a cloud client rewrites mtime),
    and runs only after a verified success. Keep pure-SQLite backup logic in
    `backend/services/backup.ts` so the Node harness can prove it; anything needing `app`,
    `dialog` or `relaunch` goes in `electron/backup.ts`.
12. **The backup settings blob has exactly ONE writer** — the backend service. Do not mirror it
    into the renderer settings store again; two writers on the same `settings_kv` key is how an
    appearance save wiped the backup folder path.

## 4. The current job: packaging (see 03 for the full step list)

POS checkout is wired and mock-free, and Backup & Cloud saving has shipped. What's left is the
Windows installer — with `better-sqlite3` rebuilt for the **bundled** Electron at package time,
which is the #1 packaging risk — plus the manual GUI smoke test in
`docs/06-E2E-AND-SMOKE-TEST.md`. The POS hero screen remains the owner's priority surface, so
coordinate before changing it.

## 5. How the two processes talk

```
React component / store
  → useQuery/useMutation OR store.hydrate()/api(...)
    → src/lib/api.ts  api('channel', payload)
      → window.api.db.invoke   (preload bridge)
        → ipcMain 'api:invoke' (electron/ipc.ts)
            ├─ session.*/auth.*/setup.*  → handled directly (sign-in / bootstrap)
            ├─ permission gate (electron/permissions.ts) for WRITE channels
            └─ buildApi()[channel](db, payload)   (backend/api.ts)
                 → service → core → SQLite
        ← { ok, data } | { ok, error }
```

Errors come back as `{ ok:false, error }`; `api()` throws `ApiError`; stores `.catch()` it
and `toast.error` + rehydrate. Reads are open; writes require a session + permission.

## 6. The established slice-wiring pattern (for any remaining mock surface)

1. **Backend**: add the missing write handler to `backend/services/*.ts` (tx, reuse
   `core/`), register the channel in `backend/api.ts`, add a scenario test +
   an api round-trip in `backend/verify/`, and (if it's a WRITE) map it in
   `electron/permissions.ts`.
2. **Adapter**: `src/hooks/xxxAdapter.ts` (snake↔camel).
3. **Store**: `loading` + `hydrate()`; writes do `api(...).then(hydrate).catch(toast+hydrate)`.
   There is no mock branch (rule 8). Keep synchronous optimistic `add()` returns.
4. **Pages**: `useEffect(() => void hydrate(), [hydrate])` on entry pages; Skeletons on load;
   toast/confirm on writes.
5. **Verify**: typecheck (backend + frontend) → `backend:verify:all` → `build` →
   `rebuild:electron`. Report the new check count.

## 7. Adding a new backend capability (cheat sheet)

- Read query → add to `backend/services/queries.ts` + channel in `api.ts`.
- Write op → new function in the right `backend/services/*.ts`, wrap in `tx`, reuse
  `core/calc.ts`, record movements/cash/activity, add channel, **add a scenario test**,
  **map it in `electron/permissions.ts`**.
- New table/column → edit `backend/db/schema.ts` (the TS strings run at runtime). Keep
  `schema.sql` in sync for reference. Bump the migration version if needed.

## 8. Things that will bite you (learned the hard way)

- **ABI mismatch** — the #1 recurring issue. See rule 5.
- **`due` must clamp at 0** — overpayment must never produce negative due.
- **Returns inherit the customer from the sale** — needed for StoreCredit/CreditAdjust.
- **Branch name vs id** — backend uses ids (`br_mp`); several UI pages use names. Always
  resolve via `resolveBranchId`/`useBranchId` before a backend write.
- **Schema as `fs.readFileSync` breaks after bundling** — schema is inlined as a TS string.
- **Permission gate placement** — keep it at the IPC layer only (rule 7).
- **Session resets on restart** — by design; don't try to persist a "logged in" flag under
  backend.
- **Stores swallow errors only via `.catch(toast)`** — keep that; a silent write failure
  is a UX bug.

## 9. Commands reference

```bash
npm run dev                  # Electron app (auto-rebuilds for Electron ABI)
npm run build                # production bundles
npm run backend:typecheck    # tsc on backend only
npm run backend:verify       # 56 identity checks (rebuilds Node ABI)
npm run backend:scenarios    # scenario tests
npm run backend:e2e          # 68 full-shop-day checks
npm run backend:paging       # 80 paged-list-read checks
npm run backend:backup       # 105 backup, cloud & invoice-PDF checks
npm run backend:verify:all   # everything — seven suites, 860 checks
npm run i18n:check           # 32 Bangla dictionary assertions
npm run i18n:extract         # list untranslated source strings
npm run rebuild:electron     # switch better-sqlite3 → Electron ABI (run last each session)
npm run rebuild:node         # switch better-sqlite3 → Node ABI
```

## 10. Working agreement with the owner (important context)

- The owner (Seam) drives module-by-module: they say "start X" / "do as recommended", the
  agent applies sensible BD-hardware-shop defaults (what UltimatePOS / Glorious POS do),
  builds, the owner reviews and says "lock it".
- The owner's hard constraint: **do not ruin data input/output, calculations, or sync.**
  That's why enforcement is at the IPC layer (harness stays green) and every slice is verified
  end-to-end before moving on.
- The owner wants **rigorous verification** and a **final thorough test** before the
  installer.
- The **POS hero screen** is the owner's main focus — deferred deliberately so it gets a
  deep, careful pass with the backend ready.
- For a dev handoff, detail is good (counts, paths, channels). In user-facing chat, keep
  summaries friendly.

## 11. Definition of done for the whole project

1. ✅ Every data module reads/writes the real SQLite backend. No mock data path exists.
2. ✅ Auth + permissions enforced at the IPC layer.
3. ✅ First-run wizard creates a real shop; demo seed available for evaluation.
4. ✅ POS checkout writes real sales (the last data surface — done).
5. 🔴 Final end-to-end test pass: every screen verified against real data + edge cases.
6. 🔴 Windows installer built with native deps rebuilt for the bundled Electron.
7. ✅ Backup & Cloud saving: verified snapshots into a folder the owner's cloud client syncs,
   retention, restore, CSV export (`npm run backend:backup`).
8. 🟡 (Later/optional) hosted multi-device sync, SMS gateway, thermal printing, multi-branch.
