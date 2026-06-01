import type { DB } from '../db/connection.ts';
import { tx } from '../db/connection.ts';
import { newId } from '../core/ids.ts';
import { round2 } from '../core/money.ts';
import { postCashToOpenShift } from './cash.ts';
import { logActivity } from './activity.ts';
import { nextRef } from './sequences.ts';

export interface CreateExpenseInput {
  date?: string;
  categoryId?: string;
  amount: number;
  paymentMethod?: string;
  reference?: string;
  note?: string;
  branchId: string;
  userId: string;
  attachmentName?: string;
  recurring?: boolean;
  frequency?: string;
  recurringEnd?: string;
}

/**
 * The drawer's expected cash is DERIVED from cash_movements (never a stored
 * running column). A cash expense posts a cash-out to the open shift on create;
 * any later mutation that changes the cash effect (amount/method change, void,
 * delete) must post a compensating movement so the derived drawer stays exact.
 *
 * DEFERRALS (see store + page comments):
 *  - Recurring expense automation: `recurring`/`frequency`/`recurring_end` are
 *    stored but no background job materializes future copies.
 *  - Single-branch assumption (br_mp <-> 'Mirpur Branch').
 *  - Budget over-spend is computed in the UI from listed expenses; there is no
 *    backend budget-alert.
 */

/** Post a cash-out for a Cash expense (drawer drops by amount). */
function applyCashOut(db: DB, branchId: string, amount: number, expenseId: string, userId: string, at: string) {
  postCashToOpenShift(db, branchId, {
    direction: 'out',
    reason: 'expense',
    amount,
    refType: 'expense',
    refId: expenseId,
    userId,
    at,
  });
}

/** Reverse a prior Cash expense's drawer hit (compensating cash-in). */
function reverseCashOut(db: DB, branchId: string, amount: number, expenseId: string, userId: string, at: string) {
  postCashToOpenShift(db, branchId, {
    direction: 'in',
    reason: 'refund',
    amount,
    refType: 'expense',
    refId: expenseId,
    userId,
    note: 'expense reversal',
    at,
  });
}

export function createExpense(db: DB, input: CreateExpenseInput) {
  return tx(db, () => {
    const id = newId('exp');
    const date = input.date ?? new Date().toISOString();
    const refNo = nextRef(db, 'expense');
    const method = input.paymentMethod ?? 'Cash';

    db.prepare(
      `INSERT INTO expenses (id, ref_no, date, category_id, amount, payment_method, reference, note, branch_id, user_id, attachment_name, recurring, frequency, recurring_end)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      refNo,
      date,
      input.categoryId ?? null,
      round2(input.amount),
      method,
      input.reference ?? null,
      input.note ?? null,
      input.branchId,
      input.userId,
      input.attachmentName ?? null,
      input.recurring ? 1 : 0,
      input.frequency ?? null,
      input.recurringEnd ?? null,
    );

    if (method === 'Cash') {
      applyCashOut(db, input.branchId, input.amount, id, input.userId, date);
    }

    logActivity(db, {
      by: input.userId,
      branchId: input.branchId,
      action: 'created',
      entity: 'expense',
      entityId: id,
      entityRef: refNo,
      message: input.note ?? 'Expense',
      amount: input.amount,
      at: date,
    });
    return { id, refNo };
  });
}

export interface UpdateExpenseInput {
  date?: string;
  categoryId?: string;
  amount?: number;
  paymentMethod?: string;
  reference?: string;
  note?: string;
  attachmentName?: string;
  recurring?: boolean;
  frequency?: string;
  recurringEnd?: string;
}

/**
 * Partial update (catalog-style colMap). If `amount` or `paymentMethod` changes
 * on a NON-voided expense we keep the derived drawer consistent by reversing the
 * prior cash effect and re-applying the new one:
 *   old method Cash -> compensating cash-in for the OLD amount
 *   new method Cash -> cash-out for the NEW amount
 * (A no-op when neither old nor new is Cash, or when there's no open shift.)
 */
export function updateExpense(db: DB, id: string, patch: UpdateExpenseInput) {
  return tx(db, () => {
    const cur = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!cur) throw new Error('Expense not found');
    const now = new Date().toISOString();

    const colMap: Record<string, string> = {
      date: 'date',
      categoryId: 'category_id',
      amount: 'amount',
      paymentMethod: 'payment_method',
      reference: 'reference',
      note: 'note',
      attachmentName: 'attachment_name',
      frequency: 'frequency',
      recurringEnd: 'recurring_end',
    };
    const sets: string[] = [];
    const params: Record<string, unknown> = { id };
    for (const [k, col] of Object.entries(colMap)) {
      if (k in patch) {
        sets.push(`${col} = @${k}`);
        let v = (patch as Record<string, unknown>)[k] ?? null;
        if (k === 'amount' && v != null) v = round2(v as number);
        params[k] = v;
      }
    }
    if ('recurring' in patch) {
      sets.push('recurring = @recurring');
      params.recurring = patch.recurring ? 1 : 0;
    }

    // Decide whether the cash effect must be reversed-and-reapplied.
    const branchId = cur.branch_id as string;
    const userId = cur.user_id as string;
    const wasVoided = (cur.voided as number) === 1;
    const oldMethod = cur.payment_method as string;
    const oldAmount = cur.amount as number;
    const newMethod = 'paymentMethod' in patch ? (patch.paymentMethod ?? oldMethod) : oldMethod;
    const newAmount = 'amount' in patch && patch.amount != null ? round2(patch.amount) : oldAmount;
    const cashEffectChanged =
      !wasVoided && (newMethod !== oldMethod || Math.abs(newAmount - oldAmount) > 0.001);

    if (cashEffectChanged) {
      // Reverse the OLD cash hit (if the old expense touched the drawer)…
      if (oldMethod === 'Cash') reverseCashOut(db, branchId, oldAmount, id, userId, now);
      // …then apply the NEW cash hit (if the new expense touches the drawer).
      if (newMethod === 'Cash') applyCashOut(db, branchId, newAmount, id, userId, now);
    }

    if (sets.length > 0) {
      db.prepare(`UPDATE expenses SET ${sets.join(', ')} WHERE id = @id`).run(params);
    }

    logActivity(db, {
      by: userId,
      branchId,
      action: 'edited',
      entity: 'expense',
      entityId: id,
      entityRef: cur.ref_no as string,
      message: 'Updated expense',
      amount: newAmount,
      at: now,
    });
    return { id };
  });
}

/**
 * Void an expense (soft delete). Idempotent: a no-op if already voided. When a
 * non-voided Cash expense is voided, a compensating cash-in reverses the drawer.
 */
export function voidExpense(db: DB, id: string, reason?: string, userId?: string) {
  return tx(db, () => {
    const cur = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!cur) throw new Error('Expense not found');
    if ((cur.voided as number) === 1) return { id, alreadyVoided: true };

    const now = new Date().toISOString();
    const branchId = cur.branch_id as string;
    const by = userId ?? (cur.user_id as string);

    if ((cur.payment_method as string) === 'Cash') {
      reverseCashOut(db, branchId, cur.amount as number, id, by, now);
    }

    db.prepare('UPDATE expenses SET voided = 1, void_reason = ? WHERE id = ?').run(reason ?? null, id);

    logActivity(db, {
      by,
      branchId,
      action: 'voided',
      entity: 'expense',
      entityId: id,
      entityRef: cur.ref_no as string,
      message: reason ?? 'Voided expense',
      amount: cur.amount as number,
      at: now,
    });
    return { id };
  });
}

/**
 * Hard delete. If the expense is Cash and not voided, reverse the drawer hit
 * first (compensating cash-in), then remove the row. Behaviour matches the mock
 * store, which deletes freely.
 */
export function deleteExpense(db: DB, id: string) {
  return tx(db, () => {
    const cur = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!cur) return { id, missing: true };

    const now = new Date().toISOString();
    const branchId = cur.branch_id as string;
    const userId = cur.user_id as string;

    if ((cur.payment_method as string) === 'Cash' && (cur.voided as number) === 0) {
      reverseCashOut(db, branchId, cur.amount as number, id, userId, now);
    }

    db.prepare('DELETE FROM expenses WHERE id = ?').run(id);

    logActivity(db, {
      by: userId,
      branchId,
      action: 'deleted',
      entity: 'expense',
      entityId: id,
      entityRef: cur.ref_no as string,
      message: 'Deleted expense',
      amount: cur.amount as number,
      at: now,
    });
    return { id };
  });
}

// ---------- Expense Categories ----------
export function createExpenseCategory(
  db: DB,
  input: { name: string; parentId?: string; emoji?: string; monthlyBudget?: number },
) {
  const id = newId('ec');
  db.prepare(
    'INSERT INTO expense_categories (id, name, parent_id, emoji, monthly_budget) VALUES (?,?,?,?,?)',
  ).run(id, input.name, input.parentId ?? null, input.emoji ?? null, input.monthlyBudget ?? null);
  return { id };
}

export function updateExpenseCategory(
  db: DB,
  id: string,
  patch: { name?: string; parentId?: string | null; emoji?: string; monthlyBudget?: number | null },
) {
  const cur = db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(id) as
    | { name: string; parent_id: string | null; emoji: string | null; monthly_budget: number | null }
    | undefined;
  if (!cur) throw new Error('Expense category not found');
  db.prepare(
    'UPDATE expense_categories SET name = ?, parent_id = ?, emoji = ?, monthly_budget = ? WHERE id = ?',
  ).run(
    patch.name ?? cur.name,
    patch.parentId === undefined ? cur.parent_id : patch.parentId,
    patch.emoji === undefined ? cur.emoji : patch.emoji,
    patch.monthlyBudget === undefined ? cur.monthly_budget : patch.monthlyBudget,
    id,
  );
  return { id };
}

/** Detach children + null out referencing expenses, then delete (mirrors catalog). */
export function deleteExpenseCategory(db: DB, id: string) {
  return tx(db, () => {
    db.prepare('UPDATE expense_categories SET parent_id = NULL WHERE parent_id = ?').run(id);
    db.prepare('UPDATE expenses SET category_id = NULL WHERE category_id = ?').run(id);
    db.prepare('DELETE FROM expense_categories WHERE id = ?').run(id);
    return { id };
  });
}
