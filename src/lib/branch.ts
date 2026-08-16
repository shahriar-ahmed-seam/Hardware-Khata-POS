import { useBranches, type Branch } from '@/stores/branches';

/**
 * BRANCH ID ↔ DISPLAY NAME, IN ONE PLACE.
 *
 * WHY THIS FILE EXISTS
 * The backend keys everything by branch ID (`stock_movements.branch_id`,
 * `expenses.branch_id`, `cash_shifts.branch_id`), while most of the UI was built
 * around branch NAMES in dropdowns. Something has to translate, and that
 * translation had been copied five times:
 *
 *   - `hooks/cashAdapter.ts`  → `BRANCH_NAME = { br_mp: 'Mirpur Branch' }`
 *   - `hooks/expenseAdapter.ts` → the same literal map
 *   - `stores/sales.ts` / `stores/purchases.ts` → a local `resolveBranchToId`
 *   - `stores/stock.ts` → a local `branchIdToName`
 *
 * The first two were the demo fixture's branch name hard-coded. The screens that
 * render a branch were fixed earlier, but a row read back THROUGH those adapters
 * still displayed "Mirpur Branch" on a shop whose branch is called something
 * else — and the matching `resolveBranchId` collapsed EVERY unrecognised name to
 * `br_mp`, so on a real multi-branch shop an expense or a shift could be written
 * against the wrong branch entirely.
 *
 * Everything now resolves against `stores/branches`, which is loaded from
 * `branches.list`. There is no hard-coded branch name or id left in this path.
 *
 * READ NON-REACTIVELY, ON PURPOSE
 * These are called from zustand store actions and from pure adapter functions —
 * neither of which can use a hook — so the branch list is read with
 * `useBranches.getState()`. For a React component that must RE-RENDER when the
 * branch list arrives, subscribe with `useBranches((s) => s.items)` instead, or
 * use `useBranchId` in `hooks/useReport.ts` for the report toolbars (that one has
 * different semantics: '' means "all branches" and it returns `undefined`).
 */

function items(): Branch[] {
  return useBranches.getState().items;
}

/** The shop's default branch (or the first one), if the list has loaded. */
export function defaultBranch(): Branch | undefined {
  const list = items();
  return list.find((b) => b.isDefault) ?? list[0];
}

/** The default branch's id, or undefined while the branch list is still empty. */
export function defaultBranchId(): string | undefined {
  return defaultBranch()?.id;
}

/** The default branch's display name, or '' while the branch list is empty. */
export function defaultBranchName(): string {
  return defaultBranch()?.name ?? '';
}

/**
 * A branch id → its display name.
 *
 * Falls back to the id itself rather than to a guessed name: showing `br_x9` is
 * an obvious "we don't know this one", while printing the wrong shop's branch
 * name on a Z-report is a lie the owner cannot spot.
 */
export function branchNameOf(id: string | null | undefined): string {
  if (!id) return '';
  return items().find((b) => b.id === id)?.name ?? id;
}

/**
 * Anything the UI holds for a branch (an id, a display name, or nothing) → a
 * real branch id, for a WRITE.
 *
 * Resolution order, most specific first:
 *   1. an id that actually exists in the branch list
 *   2. an exact display-name match
 *   3. a case-insensitive / trimmed name match (dropdown values get re-typed)
 *   4. an `br_`-prefixed value we cannot find — passed through, because the
 *      caller clearly means a specific branch and silently swapping it for the
 *      default is how a movement lands on the wrong branch
 *   5. the default branch
 *
 * Returns `undefined` only when the branch list has not loaded AND the caller
 * gave nothing usable. Callers on a write path must treat that as a failure
 * rather than inventing an id — see `requireBranchId`.
 */
export function branchIdOf(value: string | null | undefined): string | undefined {
  const list = items();
  if (value) {
    const byId = list.find((b) => b.id === value);
    if (byId) return byId.id;
    const byName = list.find((b) => b.name === value);
    if (byName) return byName.id;
    const needle = value.trim().toLowerCase();
    const loose = list.find((b) => b.name.trim().toLowerCase() === needle);
    if (loose) return loose.id;
    if (value.startsWith('br_')) return value;
  }
  return defaultBranchId();
}

/**
 * Same as {@link branchIdOf} but throws instead of returning undefined.
 *
 * For write paths, because the alternative is worse: posting a movement, an
 * expense or a shift with a null/invented branch id puts a row in the ledger
 * that no branch-scoped figure will ever include again. A thrown error surfaces
 * as a toast the owner can act on ("branches not loaded"), and the store's
 * existing `.catch(toast + rehydrate)` already handles it.
 */
export function requireBranchId(value: string | null | undefined): string {
  const id = branchIdOf(value);
  if (!id) {
    throw new Error(
      'No branch is available yet. Open Settings → Branches to confirm your branch, then try again.',
    );
  }
  return id;
}
