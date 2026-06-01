# Hardware Shop POS

Offline-first desktop POS + lightweight ERP for a Bangladeshi hardware shop.
Electron + React + TypeScript + Vite + Tailwind on the frontend; SQLite
(`better-sqlite3`) backend in the Electron main process.

## Documentation

Start here — full handoff docs live in [`docs/`](./docs):

- **[docs/00-OVERVIEW.md](./docs/00-OVERVIEW.md)** — the big picture, stack, status
- **[docs/01-FRONTEND.md](./docs/01-FRONTEND.md)** — every UI module, store, convention
- **[docs/02-BACKEND.md](./docs/02-BACKEND.md)** — schema, services, calculations, verification
- **[docs/03-WHATS-LEFT.md](./docs/03-WHATS-LEFT.md)** — remaining work, prioritized
- **[docs/04-AGENT-HANDOFF.md](./docs/04-AGENT-HANDOFF.md)** — how to continue this project
- **[docs/05-CONTEXT-AND-HISTORY.md](./docs/05-CONTEXT-AND-HISTORY.md)** — full narrative + every decision

Plus: `TASKS.md` (running checklist), `BACKEND_NOTES.md` (accumulated backend spec),
`backend/README.md` (backend deep-dive).

## Run

```bash
npm install
npm run dev                  # launches the app (auto-rebuilds native deps for Electron)
npm run backend:verify:all   # runs 533 backend verification checks
npm run build                # production bundles (renderer + main + preload)
```

> ⚠️ `better-sqlite3` is a native module with ABI-specific builds. `npm run dev` rebuilds
> it for Electron; `npm run backend:verify*` rebuilds it for Node. A `ERR_DLOPEN_FAILED`
> error means the wrong ABI — run the matching `rebuild:*` script. Finish every session
> with `npm run rebuild:electron`. See docs/02.

## Status

| Area | Status |
|------|--------|
| Frontend (15 modules) | ✅ Built |
| Backend data layer | ✅ Built + 533 verification checks passing |
| Electron ↔ backend bridge | ✅ Wired & proven on both native ABIs |
| Store-by-store wiring (9 data slices) | ✅ Done — every module on the real backend |
| Auth (bcrypt) + IPC permission enforcement | ✅ Done |
| First-run wizard (writes a real shop) | ✅ Done |
| POS checkout (hero screen) | ✅ Done — persists via `sales.create`, mock fallback kept |
| Final end-to-end test | ✅ Done — 533 checks incl. full-shop-day E2E (`backend:verify:all`) |
| Packaging (installer) | 🔴 Next — final phase |

## Stack

- Electron (frameless custom titlebar), React 18, TypeScript, Vite
- Tailwind CSS (HSL tokens, light/dark/system), lucide-react, Recharts
- Zustand (backend-aware stores + UI state), TanStack Query (products/catalog), react-router (HashRouter)
- SQLite via `better-sqlite3`; pure TS service layer under `backend/`; `bcryptjs` for hashing

## Layout

```
electron/    main, preload, db lifecycle, IPC bridge + permission gate
src/         renderer — components/, pages/, stores/, hooks/, lib/, styles/
backend/     SQLite layer — db/, core/, services/, seed/, verify/, api.ts
docs/        handoff documentation
```
