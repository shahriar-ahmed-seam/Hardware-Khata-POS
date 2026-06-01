import type {
  ExpenseCategory,
  ExpensePaymentMethod,
  ExpenseRecord,
  RecurringFrequency,
} from '@/stores/expenses';

/**
 * Maps backend expenses / expense_categories rows (snake_case) into the
 * frontend ExpenseRecord / ExpenseCategory shapes the Expenses pages consume.
 * Mirrors cashAdapter.ts / purchaseAdapter.ts.
 *
 * Single-branch assumption for now (br_mp <-> 'Mirpur Branch'); a row's
 * branch_id is surfaced as its display name via BRANCH_NAME.
 */

/** Single-branch assumption for now: id <-> display name. */
export const BRANCH_NAME: Record<string, string> = { br_mp: 'Mirpur Branch' };

/** Resolve a branch id from a display name (defaults to the primary branch). */
export function resolveBranchId(name: string): string {
  return name.startsWith('br_') ? name : 'br_mp';
}

/** An expenses row as returned by `expenses.list` (with joined category_name). */
export interface BackendExpense {
  id: string;
  ref_no: string | null;
  date: string;
  category_id: string | null;
  category_name?: string | null;
  amount: number;
  payment_method: string;
  reference: string | null;
  note: string | null;
  branch_id: string | null;
  user_id: string | null;
  attachment_name: string | null;
  recurring: number;
  frequency: string | null;
  recurring_end: string | null;
  voided: number;
  void_reason: string | null;
  created_at: string | null;
}

/** An expense_categories row as returned by `expenseCategories.list`. */
export interface BackendExpenseCategory {
  id: string;
  name: string;
  parent_id: string | null;
  emoji: string | null;
  monthly_budget: number | null;
}

export function toExpense(row: BackendExpense): ExpenseRecord {
  return {
    id: row.id,
    refNo: row.ref_no ?? undefined,
    date: row.date,
    categoryId: row.category_id ?? '',
    amount: row.amount,
    paymentMethod: row.payment_method as ExpensePaymentMethod,
    reference: row.reference ?? undefined,
    note: row.note ?? undefined,
    branch: row.branch_id ? (BRANCH_NAME[row.branch_id] ?? row.branch_id) : '',
    user: row.user_id ?? '',
    attachmentName: row.attachment_name ?? undefined,
    recurring: row.recurring === 1,
    frequency: (row.frequency as RecurringFrequency | null) ?? undefined,
    recurringEnd: row.recurring_end ?? undefined,
    voided: row.voided === 1,
    voidReason: row.void_reason ?? undefined,
    createdAt: row.created_at ?? undefined,
  };
}

export function toCategory(row: BackendExpenseCategory): ExpenseCategory {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id ?? undefined,
    emoji: row.emoji ?? undefined,
    monthlyBudget: row.monthly_budget ?? undefined,
  };
}
