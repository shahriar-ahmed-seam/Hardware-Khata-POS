import type { DB } from '../db/connection.ts';

/**
 * THE SHOP'S BRANCH, when a write does not name one.
 *
 * The shop runs as ONE branch (owner decision, September 2026): branches can be
 * added in Settings, and the multi-branch setup comes when branching is switched
 * on. Until then the screens used to send the demo fixture's id `'br_mp'` on
 * about fifteen writes. That only worked because the seed happens to create
 * `br_mp`; after `branches.setDefault` moved the default, those writes landed on
 * the wrong branch. A write with no branch now goes to the shop's DEFAULT
 * branch, resolved here, in one place.
 *
 * Order: the branch named (if it exists) → business_info.default_branch_id →
 * the branch flagged default → the first active branch.
 */
export function shopBranchId(db: DB, branchId?: string | null): string {
  if (branchId) {
    if (!db.prepare('SELECT 1 FROM branches WHERE id = ?').get(branchId)) {
      throw new Error('That branch does not exist.');
    }
    return branchId;
  }
  const fromBusiness = db
    .prepare(
      `SELECT b.id FROM business_info bi JOIN branches b ON b.id = bi.default_branch_id
        WHERE bi.id = 1 LIMIT 1`,
    )
    .get() as { id: string } | undefined;
  if (fromBusiness) return fromBusiness.id;
  const flagged = db
    .prepare('SELECT id FROM branches ORDER BY is_default DESC, active DESC, created_at, id LIMIT 1')
    .get() as { id: string } | undefined;
  if (!flagged) throw new Error('No branch is set up yet. Add one in Settings → Branches.');
  return flagged.id;
}

/**
 * Make `id` THE default branch, in both places the default is kept.
 *
 * There are two: `branches.is_default` (what Settings → Branches' "Set default"
 * changes, and what the screens read) and `business_info.default_branch_id`
 * (what Business Info's default-branch picker changes, and what
 * {@link shopBranchId} reads first). They used to be written separately, so the
 * screens could show one branch as default while writes went to the other.
 * Every path that changes the default goes through here now. Call inside a tx.
 */
export function markDefaultBranch(db: DB, id: string): void {
  if (!db.prepare('SELECT 1 FROM branches WHERE id = ?').get(id)) {
    throw new Error('That branch does not exist.');
  }
  db.prepare('UPDATE branches SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END').run(id);
  db.prepare('UPDATE business_info SET default_branch_id = ? WHERE id = 1').run(id);
}
