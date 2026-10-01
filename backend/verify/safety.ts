/**
 * ============================================================================
 *  SAFETY — money that could change with no clear sign (October 2026 round)
 * ============================================================================
 *
 * Each section is one of the "can go wrong with no clear sign" findings from
 * the money review: an opening balance rewritten by a cashier, a contact with a
 * balance deleted, store credit that went nowhere, a double-saved purchase, an
 * unchecked shift close … Each check asserts the refusal AND that nothing moved.
 *
 * Run as part of `backend:verify:all` (via all.ts), or alone:
 *   npx tsx backend/verify/safety.ts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, migrate, type DB } from '../db/connection.ts';
import { openShift, closeShift, carriedForwardCash, manualCashMove, getOpenShift } from '../services/cash.ts';
import { seedMaster } from '../seed/master.ts';
import { Suite } from './assert.ts';
import { recordMovement } from '../services/stock.ts';
import { createSale } from '../services/sales.ts';
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../services/contacts.ts';
import { customerDue, customerLedger, supplierDue, supplierLedger } from '../services/ledger.ts';
import { createExpense, updateExpense, deleteExpense } from '../services/expenses.ts';
import { createUser, updateUser, deleteUser, createRole, updateRole } from '../services/settings.ts';
import { createSellReturn } from '../services/returns.ts';
import { round2 } from '../core/money.ts';
import { backupHealth, makeBackupFolder, setBackupConfig } from '../services/backup.ts';
import { PS2_LOGICAL_DISK_SCRIPT, parseLogicalDiskLines, parseWmicCsv } from '../../electron/drives.ts';
import { receiveCustomerPayment, payToSupplier } from '../services/accounts.ts';
import {
  addPurchasePayment,
  cancelPurchase,
  createPurchase,
  receivePurchase,
  updatePurchase,
} from '../services/purchases.ts';
import {
  CREDIT_LIMIT_BLOCKED,
  DISCOUNT_BLOCKED,
  PRICE_BELOW_LIST_BLOCKED,
  saleRulesCheck,
  withRuleNotes,
  type SaleRights,
} from '../services/saleRules.ts';
import {
  BALANCE_EDIT_BLOCKED,
  MANAGER_PERMISSION,
  contactBalanceGateError,
  refreshedSession,
  stampActor,
  type GateSession,
} from '../../electron/guard.ts';

function fresh(): DB {
  const db = openDatabase(':memory:');
  migrate(db);
  seedMaster(db);
  recordMovement(db, { productId: 'p1', branchId: 'br_mp', reason: 'opening_stock', qty: 100, unitCost: 380 });
  return db;
}

/** Run `fn`; the check passes only if it throws (optionally matching `pattern`). */
function refuses(s: Suite, name: string, fn: () => unknown, pattern?: RegExp) {
  try {
    fn();
    s.ok(name, false, 'expected a refusal, but it went through');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    s.ok(name, pattern ? pattern.test(msg) : true, `refused with an unexpected message: ${msg}`);
  }
}
const one = <T>(db: DB, sql: string, ...args: unknown[]) => db.prepare(sql).get(...args) as T;

export function runSafety(s: Suite) {
  // ------------------------------------------------------------------------
  s.section('safety-opening-balance-edits');
  {
    const db = fresh();
    const c = createCustomer(db, { name: 'Karim', phone: '01710000001', openingBalance: 5000, userId: 'u_admin' });
    s.money('opening balance starts the khata', customerDue(db, c.id), 5000);

    refuses(
      s,
      'an opening-balance change needs a reason',
      () => updateCustomer(db, c.id, { openingBalance: 0, userId: 'u_admin' }),
      /why the opening balance/i,
    );
    s.money('refused: the due is untouched', customerDue(db, c.id), 5000);

    refuses(s, 'a NaN opening balance is refused', () =>
      updateCustomer(db, c.id, { openingBalance: Number.NaN, balanceReason: 'x', userId: 'u_admin' }),
    );
    refuses(s, 'a negative credit limit is refused', () =>
      updateCustomer(db, c.id, { creditLimit: -10, userId: 'u_admin' }),
    );

    // The form always sends the whole record: an unchanged figure is not a change.
    updateCustomer(db, c.id, { name: 'Karim Traders', openingBalance: 5000, userId: 'u_rana' });
    s.eq(
      'renaming with the same balance needs no reason and logs a plain edit',
      one<{ message: string }>(db, "SELECT message FROM activity_log WHERE entity_id = ? AND action = 'edited' ORDER BY rowid DESC LIMIT 1", c.id).message,
      'Updated customer',
    );

    updateCustomer(db, c.id, { openingBalance: 3000, balanceReason: 'old khata misread', userId: 'u_admin' });
    s.money('with a reason the balance changes', customerDue(db, c.id), 3000);
    const row = one<{ message: string; amount: number; by_user: string }>(
      db,
      "SELECT message, amount, by_user FROM activity_log WHERE entity_id = ? AND action = 'edited' ORDER BY rowid DESC LIMIT 1",
      c.id,
    );
    s.ok('the log shows old → new', /5000\.00 → 3000\.00/.test(row.message), row.message);
    s.ok('the log keeps the reason', /old khata misread/.test(row.message), row.message);
    s.money('the log carries the difference', row.amount, -2000);
    s.eq('the log names who did it', row.by_user, 'u_admin');

    const sup = createSupplier(db, { name: 'Rahman Steel', openingBalance: 12000, userId: 'u_admin' });
    refuses(s, 'a supplier opening-balance change needs a reason too', () =>
      updateSupplier(db, sup.id, { openingBalance: 0, userId: 'u_admin' }),
    );
    s.money('refused: the supplier payable is untouched', supplierDue(db, sup.id), 12000);
    db.close();
  }

  // ------------------------------------------------------------------------
  s.section('safety-balance-gate');
  {
    const cashier = new Set(['contacts.editCustomers', 'sales.create']);
    const manager = new Set(['contacts.editCustomers', MANAGER_PERMISSION]);
    const cur = { opening_balance: 5000, credit_limit: 20000 };
    s.eq(
      'a cashier cannot write down an opening balance',
      contactBalanceGateError({ current: cur, patch: { openingBalance: 0 }, permissions: cashier }),
      BALANCE_EDIT_BLOCKED,
    );
    s.eq(
      'a cashier cannot raise a credit limit',
      contactBalanceGateError({ current: cur, patch: { creditLimit: 90000 }, permissions: cashier }),
      BALANCE_EDIT_BLOCKED,
    );
    s.eq(
      'a cashier cannot remove a credit limit',
      contactBalanceGateError({ current: cur, patch: { creditLimit: undefined }, permissions: cashier }),
      BALANCE_EDIT_BLOCKED,
    );
    s.eq(
      'a cashier CAN fix a phone number (whole record sent, money unchanged)',
      contactBalanceGateError({
        current: cur,
        patch: { phone: '0171', openingBalance: 5000, creditLimit: 20000 },
        permissions: cashier,
      }),
      null,
    );
    s.eq(
      'the owner or a manager can change the balance',
      contactBalanceGateError({ current: cur, patch: { openingBalance: 0 }, permissions: manager }),
      null,
    );
    s.eq(
      'a cashier cannot create a customer with an opening balance',
      contactBalanceGateError({
        current: { opening_balance: 0, credit_limit: null },
        patch: { name: 'X', openingBalance: -5000 },
        permissions: cashier,
      }),
      BALANCE_EDIT_BLOCKED,
    );
    s.eq(
      'a cashier can create a plain customer',
      contactBalanceGateError({
        current: { opening_balance: 0, credit_limit: null },
        patch: { name: 'X', phone: '01' },
        permissions: cashier,
      }),
      null,
    );
    const stamped = stampActor('customers.update', { id: 'c1', patch: { name: 'x', userId: 'fake' } }, 'u_real') as {
      patch: { userId: string };
    };
    s.eq('a contact edit is logged under the signed-in user', stamped.patch.userId, 'u_real');
    const del = stampActor('customers.delete', { id: 'c1' }, 'u_real') as { userId: string };
    s.eq('a contact delete is logged under the signed-in user', del.userId, 'u_real');
  }

  // ------------------------------------------------------------------------
  s.section('safety-contact-delete');
  {
    const db = fresh();
    const owes = createCustomer(db, { name: 'Owes Us', openingBalance: 800, userId: 'u_admin' });
    refuses(s, 'a customer who owes money cannot be deleted', () => deleteCustomer(db, owes.id, 'u_admin'), /owe/);
    s.eq('refused: the customer is still there', one<{ c: number }>(db, 'SELECT COUNT(*) c FROM customers WHERE id = ?', owes.id).c, 1);

    const adv = createCustomer(db, { name: 'Paid Ahead', userId: 'u_admin' });
    receiveCustomerPayment(db, { partyId: adv.id, amount: 300, method: 'Cash', userId: 'u_admin' });
    refuses(s, 'a customer with money on account cannot be deleted', () => deleteCustomer(db, adv.id, 'u_admin'));

    const sup = createSupplier(db, { name: 'We Owe', openingBalance: 1500, userId: 'u_admin' });
    refuses(s, 'a supplier the shop owes cannot be deleted', () => deleteSupplier(db, sup.id, 'u_admin'), /owes/);

    const clean = createCustomer(db, { name: 'Nothing Owed', userId: 'u_admin' });
    deleteCustomer(db, clean.id, 'u_admin');
    s.eq('a clean customer is deleted', one<{ c: number }>(db, 'SELECT COUNT(*) c FROM customers WHERE id = ?', clean.id).c, 0);
    const log = one<{ by_user: string; message: string } | undefined>(
      db,
      "SELECT by_user, message FROM activity_log WHERE entity_id = ? AND action = 'deleted'",
      clean.id,
    );
    s.ok('the delete is in the activity log with who did it', log?.by_user === 'u_admin' && /Nothing Owed/.test(log.message ?? ''), JSON.stringify(log));

    // A sale against a customer still blocks the delete (unchanged rule).
    const buyer = createCustomer(db, { name: 'Buyer', userId: 'u_admin' });
    createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: buyer.id,
      lines: [{ productId: 'p1', qty: 1, spr: 520 }],
      payments: [{ method: 'Cash', amount: 520 }],
    });
    refuses(s, 'a customer with sales history still cannot be deleted', () => deleteCustomer(db, buyer.id, 'u_admin'));
    db.close();
  }

  // ------------------------------------------------------------------------
  s.section('safety-store-credit');
  {
    const db = fresh();
    const c = createCustomer(db, { name: 'Selim', userId: 'u_admin' });
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: c.id,
      lines: [{ productId: 'p1', qty: 2, spr: 500 }],
      payments: [{ method: 'Cash', amount: 1000 }],
    });
    s.money('a fully paid sale leaves nothing owed', customerDue(db, c.id), 0);
    const cashBefore = one<{ s: number }>(db, "SELECT COALESCE(SUM(CASE direction WHEN 'in' THEN amount ELSE -amount END),0) s FROM cash_movements").s;
    createSellReturn(db, {
      saleId: sale.id,
      userId: 'u_admin',
      refundMethod: 'StoreCredit',
      lines: [{ productId: 'p1', qty: 1, unitPrice: 500, refundAmount: 500 }],
    });
    s.money('store credit becomes credit on the account (khata shows ৳500 in their favour)', customerDue(db, c.id), -500);
    const cashAfter = one<{ s: number }>(db, "SELECT COALESCE(SUM(CASE direction WHEN 'in' THEN amount ELSE -amount END),0) s FROM cash_movements").s;
    s.money('store credit takes nothing out of the drawer', cashAfter, cashBefore);
    const led = customerLedger(db, c.id);
    s.ok(
      'the khata has a store-credit row',
      led.some((e) => e.type === 'return' && /store credit/.test(e.reference) && Math.abs(e.credit - 500) < 0.01),
      JSON.stringify(led.map((e) => e.reference)),
    );
    s.money('the khata closing balance equals the due', led[led.length - 1]?.balance ?? 0, -500);

    // The next credit sale uses the credit.
    createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: c.id,
      lines: [{ productId: 'p1', qty: 1, spr: 800 }],
      payments: [],
    });
    s.money('the next unpaid ৳800 sale nets against the ৳500 credit', customerDue(db, c.id), 300);
    db.close();
  }

  // ------------------------------------------------------------------------
  s.section('safety-refund-methods');
  {
    const db = fresh();
    const c = createCustomer(db, { name: 'Lower Case', userId: 'u_admin' });
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: c.id,
      lines: [{ productId: 'p1', qty: 2, spr: 500 }],
      payments: [{ method: 'Cash', amount: 1000 }],
    });
    const r = createSellReturn(db, {
      saleId: sale.id,
      userId: 'u_admin',
      refundMethod: 'cash',
      lines: [{ productId: 'p1', qty: 1, unitPrice: 500, refundAmount: 500 }],
    });
    s.eq('"cash" is stored as Cash', one<{ m: string }>(db, 'SELECT refund_method m FROM sell_returns WHERE id = ?', r.id).m, 'Cash');
    s.money(
      'and the ৳500 really leaves the drawer',
      one<{ s: number }>(db, "SELECT COALESCE(SUM(amount),0) s FROM cash_movements WHERE ref_type = 'return' AND ref_id = ? AND direction = 'out'", r.id).s,
      500,
    );
    refuses(s, 'an unknown refund method is refused', () =>
      createSellReturn(db, {
        saleId: sale.id,
        userId: 'u_admin',
        refundMethod: 'IOU',
        lines: [{ productId: 'p1', qty: 1, unitPrice: 500, refundAmount: 500 }],
      }),
    /not a refund method/);

    // R28: the credit goes to the SALE's customer, whoever the caller names.
    const other = createCustomer(db, { name: 'Someone Else', userId: 'u_admin' });
    const credit = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: c.id,
      lines: [{ productId: 'p1', qty: 1, spr: 600 }],
      payments: [],
    });
    const dueBefore = customerDue(db, c.id);
    createSellReturn(db, {
      saleId: credit.id,
      customerId: other.id,
      userId: 'u_admin',
      refundMethod: 'CreditAdjust',
      lines: [{ productId: 'p1', qty: 1, unitPrice: 600, refundAmount: 600 }],
    });
    s.money("the credit note comes off the sale's customer", customerDue(db, c.id), round2(dueBefore - 600));
    s.money('and gives nothing to the customer the caller named', customerDue(db, other.id), 0);
    db.close();
  }

  // ------------------------------------------------------------------------
  s.section('safety-shift-close');
  {
    const db = fresh();
    const shiftId = openShift(db, { branchId: 'br_mp', userId: 'u_admin', openingCash: 1000 });
    s.ok(
      'opening a drawer is in the activity log',
      !!one<{ id: string } | undefined>(db, "SELECT id FROM activity_log WHERE entity = 'shift' AND action = 'opened' AND entity_id = ?", shiftId),
    );
    refuses(s, 'a float above the count is refused', () =>
      closeShift(db, { shiftId, countedCash: 1000, carriedFloat: 5000, closedBy: 'u_admin' }),
    /cannot be more/);
    refuses(s, 'a negative float is refused', () =>
      closeShift(db, { shiftId, countedCash: 1000, carriedFloat: -1, closedBy: 'u_admin' }),
    );
    refuses(s, 'a NaN count is refused', () => closeShift(db, { shiftId, countedCash: Number.NaN, closedBy: 'u_admin' }));
    s.eq('refused: the shift is still open', one<{ st: string }>(db, 'SELECT status st FROM cash_shifts WHERE id = ?', shiftId).st, 'open');
    closeShift(db, { shiftId, countedCash: 1000, carriedFloat: 400, closedBy: 'u_admin' });
    s.money('a valid close carries the float into the next drawer', carriedForwardCash(db, 'br_mp').amount, 400);
    // An old bad row (from before the check) must not stop the next drawer opening.
    db.prepare('UPDATE cash_shifts SET carried_float = -50 WHERE id = ?').run(shiftId);
    s.money('a bad old float is read as zero', carriedForwardCash(db, 'br_mp').amount, 0);
    manualCashMove(db, { branchId: 'br_mp', direction: 'in', amount: 20, userId: 'u_admin' });
    s.ok('and cash can still be taken (the next drawer opens)', !!getOpenShift(db, 'br_mp'));
    db.close();
  }

  // ------------------------------------------------------------------------
  s.section('safety-durable-writes');
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-safety-'));
    try {
      const db = openDatabase(path.join(dir, 'pos.db'));
      s.eq('a committed sale survives a power cut (synchronous = FULL)', db.pragma('synchronous', { simple: true }), 2);
      db.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // ------------------------------------------------------------------------
  s.section('safety-backup-health');
  {
    const db = fresh();
    const now = new Date('2026-10-10T12:00:00Z');
    setBackupConfig(db, { auto: 'daily', lastBackupAt: undefined, lastError: undefined });
    s.eq('no backup yet → "never"', backupHealth(db, now).state, 'never');
    setBackupConfig(db, { lastBackupAt: '2026-10-09T12:00:00Z' });
    s.eq('backed up yesterday → ok', backupHealth(db, now).state, 'ok');
    setBackupConfig(db, { lastBackupAt: '2026-10-05T12:00:00Z' });
    const stale = backupHealth(db, now);
    s.ok('five days without a daily backup → stale, with the day count', stale.state === 'stale' && stale.daysSince === 5, JSON.stringify(stale));
    setBackupConfig(db, { lastError: 'disk full' });
    s.eq('a failed run → failed (shown to everyone)', backupHealth(db, now).state, 'failed');
    setBackupConfig(db, { lastError: undefined, auto: 'off' });
    s.eq('backups switched off → off', backupHealth(db, now).state, 'off');

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cloud-'));
    try {
      const cloudRoot = path.join(dir, 'OneDrive');
      const target = path.join(cloudRoot, 'HardwareKhataPOS', 'Backups');
      let refused = false;
      try {
        makeBackupFolder(target);
      } catch {
        refused = true;
      }
      s.ok('a missing cloud folder is reported, not rebuilt on the local disk', refused && !fs.existsSync(cloudRoot));
      fs.mkdirSync(cloudRoot);
      makeBackupFolder(target);
      s.ok("with the cloud folder present, the app's own subfolders are made", fs.existsSync(target));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    db.close();
  }

  // ------------------------------------------------------------------------
  s.section('safety-windows7-drives');
  {
    const ps2 = parseLogicalDiskLines('E:|SANDISK|15728640000|16008609792\r\nF:||0|\r\n\r\nnot a drive\r\n');
    s.eq('PowerShell 2.0 lines: both drives read', ps2.length, 2);
    s.ok('label and sizes come through', ps2[0].VolumeName === 'SANDISK' && ps2[0].FreeSpace === '15728640000', JSON.stringify(ps2[0]));
    const wmic = parseWmicCsv('\r\r\nNode,DeviceID,FreeSpace,Size,VolumeName\r\r\nSHOP-PC,E:,15728640000,16008609792,SANDISK\r\r\n');
    s.ok('wmic CSV is read by column name', wmic.length === 1 && wmic[0].DeviceID === 'E:' && wmic[0].VolumeName === 'SANDISK', JSON.stringify(wmic));
    s.eq('wmic with no removable drive reads as none', parseWmicCsv('\r\nNode,DeviceID,FreeSpace,Size,VolumeName\r\n').length, 0);
    s.ok('the Windows 7 query uses only PowerShell 2.0 commands', !/Get-CimInstance|ConvertTo-Json/.test(PS2_LOGICAL_DISK_SCRIPT));
  }

  // ------------------------------------------------------------------------
  s.section('safety-expense-trail');
  {
    const db = fresh();
    const e = createExpense(db, { branchId: 'br_mp', userId: 'u_rana', amount: 700, paymentMethod: 'Cash', categoryId: 'ec_misc' });
    updateExpense(db, e.id, { amount: 750, userId: 'u_admin' });
    s.eq(
      'an expense edit is logged under who edited it, not who entered it',
      one<{ by_user: string }>(db, "SELECT by_user FROM activity_log WHERE entity_id = ? AND action = 'edited'", e.id).by_user,
      'u_admin',
    );
    deleteExpense(db, e.id, 'u_admin', 'entered twice');
    const row = one<{ voided: number; void_reason: string } | undefined>(db, 'SELECT voided, void_reason FROM expenses WHERE id = ?', e.id);
    s.ok('"deleting" an expense keeps it, voided, with the reason', row?.voided === 1 && row.void_reason === 'entered twice', JSON.stringify(row));
    s.money(
      'and all its cash is back in the drawer (net effect zero)',
      one<{ s: number }>(db, "SELECT COALESCE(SUM(CASE direction WHEN 'in' THEN amount ELSE -amount END),0) s FROM cash_movements WHERE ref_type = 'expense' AND ref_id = ?", e.id).s,
      0,
    );
    s.ok(
      'put back under its own reason',
      one<{ c: number }>(db, "SELECT COUNT(*) c FROM cash_movements WHERE ref_id = ? AND reason = 'expense_reversal'", e.id).c > 0,
    );
    s.eq(
      'no expense reversal is filed as a customer refund',
      one<{ c: number }>(db, "SELECT COUNT(*) c FROM cash_movements WHERE ref_type = 'expense' AND reason = 'refund'").c,
      0,
    );
    refuses(s, 'a voided expense cannot be edited', () => updateExpense(db, e.id, { amount: 10, userId: 'u_admin' }), /voided/);
    db.close();
  }

  // ------------------------------------------------------------------------
  s.section('safety-users-and-roles');
  {
    const db = fresh();
    refuses(s, 'a 1-digit PIN is refused', () => createUser(db, { name: 'A', username: 'a1', pin: '1', roleId: 'role_cashier' }), /4 to 6/);
    refuses(s, 'letters in a PIN are refused', () => createUser(db, { name: 'A', username: 'a2', pin: 'abcd', roleId: 'role_cashier' }));
    refuses(s, 'a user with no PIN and no password is refused', () => createUser(db, { name: 'A', username: 'a3', roleId: 'role_cashier' }));
    const u = createUser(db, { name: 'Cashier Two', username: 'c2', pin: '2468', roleId: 'role_cashier', actorId: 'u_admin' });
    const pinBefore = one<{ h: string }>(db, 'SELECT pin_hash h FROM users WHERE id = ?', u.id).h;
    updateUser(db, u.id, { phone: '0171', pin: undefined, actorId: 'u_admin' });
    s.eq('editing a user without retyping the PIN keeps the PIN', one<{ h: string }>(db, 'SELECT pin_hash h FROM users WHERE id = ?', u.id).h, pinBefore);
    s.ok('the new user is logged with who made them', one<{ by_user: string }>(db, "SELECT by_user FROM activity_log WHERE entity = 'user' AND entity_id = ? AND action = 'created'", u.id).by_user === 'u_admin');

    refuses(s, 'the last active admin cannot be deactivated', () => updateUser(db, 'u_admin', { status: 'inactive', actorId: 'u_rana' }), /last active admin/);
    refuses(s, 'the last active admin cannot be demoted', () => updateUser(db, 'u_admin', { roleId: 'role_cashier', actorId: 'u_rana' }), /last active admin/);
    refuses(s, 'nobody can deactivate themselves', () => updateUser(db, u.id, { status: 'inactive', actorId: u.id }), /your own/);
    const second = createUser(db, { name: 'Second Admin', username: 'boss2', pin: '1357', roleId: 'role_admin', actorId: 'u_admin' });
    updateUser(db, second.id, { status: 'inactive', actorId: 'u_admin' });
    refuses(s, 'an inactive admin does not count as the admin left', () => deleteUser(db, 'u_admin'));
    refuses(s, "the Admin role's rights cannot be taken away", () => updateRole(db, 'role_admin', { permissions: [], actorId: 'u_admin' }), /every right/);
    const r = createRole(db, { name: 'Viewer', permissions: ['reports.view'], actorId: 'u_admin' });
    updateRole(db, r.id, { permissions: ['reports.view', 'sales.view'], actorId: 'u_admin' });
    const log = one<{ message: string; by_user: string }>(db, "SELECT message, by_user FROM activity_log WHERE entity = 'role' AND entity_id = ? AND action = 'edited'", r.id);
    s.ok('a role change is logged with what was added and by whom', /added sales\.view/.test(log.message) && log.by_user === 'u_admin', JSON.stringify(log));
    db.close();
  }

  // ------------------------------------------------------------------------
  s.section('safety-live-rights');
  {
    const base: GateSession = { userId: 'u1', roleId: 'role_manager', permissions: new Set(['sales.void']), locked: false };
    const perms = (id: string) => (id === 'role_cashier' ? ['sales.create'] : ['sales.void', 'sales.create']);
    s.eq('a deactivated user is signed out at their next action', refreshedSession(base, { status: 'inactive', role_id: 'role_manager' }, perms), null);
    s.eq('a deleted user is signed out at their next action', refreshedSession(base, undefined, perms), null);
    const demoted = refreshedSession(base, { status: 'active', role_id: 'role_cashier' }, perms);
    s.ok('a demoted user loses the right at once', !!demoted && !demoted.permissions.has('sales.void') && demoted.roleId === 'role_cashier');
    s.ok('the lock state is kept', refreshedSession({ ...base, locked: true }, { status: 'active', role_id: 'role_manager' }, perms)?.locked === true);
  }

  // ------------------------------------------------------------------------
  s.section('safety-return-costs');
  {
    const db = fresh();
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      lines: [{ productId: 'p1', qty: 2, spr: 500 }],
      payments: [{ method: 'Cash', amount: 1000 }],
    });
    const soldAt = one<{ c: number }>(db, 'SELECT unit_cost_at_sale c FROM sale_lines WHERE sale_id = ?', sale.id).c;
    // A later purchase at a much higher price moves the average.
    recordMovement(db, { productId: 'p1', branchId: 'br_mp', reason: 'opening_stock', qty: 100, unitCost: 900 });
    const r = createSellReturn(db, {
      saleId: sale.id,
      userId: 'u_admin',
      refundMethod: 'Cash',
      lines: [{ productId: 'p1', qty: 1, unitPrice: 500, refundAmount: 500 }],
    });
    s.money(
      'a sell return goes back on the shelf at the cost recorded on the sale',
      one<{ c: number }>(db, "SELECT unit_cost c FROM stock_movements WHERE reason = 'sale_return' AND ref_no = (SELECT ref_no FROM sell_returns WHERE id = ?)", r.id).c,
      soldAt,
    );
    db.close();
  }

  // ------------------------------------------------------------------------
  // R16: a price below the catalogue needs pos.priceOverride, a discount
  // pos.discount. p1 sells at 520 retail, 470 wholesale, 490 contractor.
  s.section('safety-price-rights');
  {
    const db = fresh();
    const none: SaleRights = { discount: false, priceOverride: false, creditOverride: false };
    const all: SaleRights = { discount: true, priceOverride: true, creditOverride: true };
    const sale = (line: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
      branchId: 'br_mp',
      userId: 'u_rana',
      lines: [{ productId: 'p1', qty: 2, spr: 520, ...line }],
      payments: [{ method: 'Cash', amount: 1 }],
      ...extra,
    });
    const check = (payload: unknown, rights: SaleRights, channel = 'sales.create') =>
      saleRulesCheck(db, channel, payload, rights);

    s.eq('the list price needs no right', check(sale({}), none).error, null);
    s.eq('the wholesale price is a catalogue price too', check(sale({ spr: 470 }), none).error, null);
    s.eq('a higher price (a markup) is not a loss', check(sale({ markupPct: 20 }), none).error, null);
    s.eq(
      'below the cheapest catalogue price is refused without the right',
      check(sale({ spr: 450 }), none).error,
      PRICE_BELOW_LIST_BLOCKED,
    );
    s.eq(
      'a negative markup that goes below the list counts as a lower price',
      check(sale({ markupPct: -10 }), none).error,
      PRICE_BELOW_LIST_BLOCKED,
    );
    const allowed = check(sale({ spr: 450 }), all);
    s.eq('with the right it goes through', allowed.error, null);
    s.ok(
      'and the lower price is noted for the audit',
      allowed.notes.some((n) => /Claw Hammer/.test(n) && /450/.test(n) && /470/.test(n)),
      allowed.notes.join(' | '),
    );
    s.eq('a line discount needs the discount right', check(sale({ discountPct: 5 }), none).error, DISCOUNT_BLOCKED);
    s.eq('a flat line discount too', check(sale({ discountFlat: 10 }), none).error, DISCOUNT_BLOCKED);
    s.eq(
      'an order discount too',
      check(sale({}, { orderDiscountFlat: 10 }), none).error,
      DISCOUNT_BLOCKED,
    );
    s.eq('with the right a discount goes through', check(sale({ discountPct: 5 }), all).error, null);
    s.eq(
      'a quotation is held to the same prices',
      check(sale({ spr: 400 }, { status: 'quotation', payments: [] }), none).error,
      PRICE_BELOW_LIST_BLOCKED,
    );

    // A correction may keep what the sale was saved with.
    const saved = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      lines: [{ productId: 'p1', qty: 2, spr: 450, discountPct: 5 }],
      payments: [{ method: 'Cash', amount: 855 }],
    });
    s.eq(
      'a correction keeping the saved price and discount needs no right',
      check({ saleId: saved.id, input: { userId: 'u_rana', reason: 'qty', lines: [{ productId: 'p1', qty: 3, spr: 450, discountPct: 5 }] } }, none, 'sales.update').error,
      null,
    );
    s.eq(
      'a correction going lower than the saved price is refused',
      check({ saleId: saved.id, input: { userId: 'u_rana', reason: 'qty', lines: [{ productId: 'p1', qty: 2, spr: 440, discountPct: 5 }] } }, none, 'sales.update').error,
      PRICE_BELOW_LIST_BLOCKED,
    );
    s.eq(
      'a bigger discount than the saved one is refused',
      check({ saleId: saved.id, input: { userId: 'u_rana', reason: 'qty', lines: [{ productId: 'p1', qty: 2, spr: 450, discountPct: 8 }] } }, none, 'sales.update').error,
      DISCOUNT_BLOCKED,
    );

    // The notes are the main process's alone, and they reach the record.
    const stamped = withRuleNotes('sales.create', { ...sale({}), ruleNotes: ['made up by the screen'] }, []) as {
      ruleNotes?: string[];
    };
    s.eq('notes the screen sends are dropped', stamped.ruleNotes, undefined);
    const noted = createSale(db, {
      ...(withRuleNotes('sales.create', sale({ spr: 450 }, { payments: [{ method: 'Cash', amount: 900 }] }), allowed.notes) as Parameters<typeof createSale>[1]),
    });
    s.ok(
      "the sale's audit keeps the note",
      /below the list price/.test(one<{ note: string | null }>(db, "SELECT note FROM sale_audit WHERE sale_id = ? AND action = 'created'", noted.id).note ?? ''),
    );
    s.ok(
      'so does the activity log',
      /below the list price/.test(one<{ message: string }>(db, "SELECT message FROM activity_log WHERE entity_id = ? AND action = 'created'", noted.id).message),
    );

    const perms = (id: string) =>
      JSON.parse(one<{ p: string }>(db, 'SELECT permissions p FROM roles WHERE id = ?', id).p) as string[];
    s.ok(
      'the seeded cashier keeps both price rights',
      perms('role_cashier').includes('pos.discount') && perms('role_cashier').includes('pos.priceOverride'),
    );
    // v12: a shop upgrading keeps bargaining at the counter.
    db.prepare("UPDATE roles SET permissions = ? WHERE id = 'role_cashier'").run(
      JSON.stringify(perms('role_cashier').filter((p) => !p.startsWith('pos.discount') && p !== 'pos.priceOverride')),
    );
    const noSell = createRole(db, { name: 'Stock only', permissions: ['stock.view'], actorId: 'u_admin' });
    db.prepare('DELETE FROM schema_migrations WHERE version = 12').run();
    migrate(db);
    s.ok(
      'v12 gives both rights to every role that can sell',
      perms('role_cashier').includes('pos.discount') && perms('role_cashier').includes('pos.priceOverride'),
    );
    s.ok('and not to a role that cannot sell', !perms(noSell.id).includes('pos.discount'));
    s.ok(
      'v12 adds purchase_lines.prev_sell_price',
      (db.prepare('PRAGMA table_info(purchase_lines)').all() as { name: string }[]).some((c) => c.name === 'prev_sell_price'),
    );
    db.close();
  }

  // ------------------------------------------------------------------------
  // R29: cu7 (Jahangir Mia) has a ৳10,000 limit and owes nothing.
  s.section('safety-credit-limit');
  {
    const db = fresh();
    const none: SaleRights = { discount: true, priceOverride: true, creditOverride: false };
    const boss: SaleRights = { discount: true, priceOverride: true, creditOverride: true };
    const credit = (qty: number, paid: number, extra: Record<string, unknown> = {}) => ({
      branchId: 'br_mp',
      userId: 'u_rana',
      customerId: 'cu7',
      lines: [{ productId: 'p1', qty, spr: 520 }],
      payments: paid > 0 ? [{ method: 'Cash', amount: paid }] : [],
      ...extra,
    });
    const check = (payload: unknown, rights: SaleRights, channel = 'sales.create') =>
      saleRulesCheck(db, channel, payload, rights);

    s.eq('a sale that stays inside the limit goes through', check(credit(19, 0), none).error, null);
    s.eq(
      'a sale that takes the due past the limit is refused',
      check(credit(20, 0), none).error,
      CREDIT_LIMIT_BLOCKED,
    );
    s.eq('taking enough now brings it back inside', check(credit(20, 1000), none).error, null);
    const over = check(credit(20, 0), boss);
    s.eq('the owner or a manager may pass it', over.error, null);
    s.ok('and that is noted for the audit', over.notes.some((n) => /credit limit/.test(n) && /10,000/.test(n)), over.notes.join(' | '));
    s.eq('a draft owes nothing yet', check(credit(40, 0, { status: 'draft' }), none).error, null);
    s.eq(
      'a customer with no limit is not held',
      check({ ...credit(40, 0), customerId: 'cu5' }, none).error,
      null,
    );

    const first = createSale(db, credit(15, 0)); // ৳7,800 owed
    s.eq(
      'a correction that lowers the due goes through',
      check({ saleId: first.id, input: { ...credit(10, 0), reason: 'fewer' } }, none, 'sales.update').error,
      null,
    );
    s.eq(
      'a correction that raises it past the limit is refused',
      check({ saleId: first.id, input: { ...credit(21, 0), reason: 'more' } }, none, 'sales.update').error,
      CREDIT_LIMIT_BLOCKED,
    );
    s.eq(
      'the next sale counts what is already owed',
      check(credit(5, 0), none).error,
      CREDIT_LIMIT_BLOCKED,
    );
    s.eq('a fully paid sale is never held, even over the limit', check(credit(5, 2600), none).error, null);
    const draft = createSale(db, { ...credit(10, 0), status: 'draft', payments: [] });
    s.eq(
      'converting a draft counts as a sale',
      check({ saleId: draft.id, input: credit(10, 0) }, none, 'sales.convert').error,
      CREDIT_LIMIT_BLOCKED,
    );
    db.close();
  }

  // ------------------------------------------------------------------------
  // R41: a bill that set a new sell price puts the old one back when it goes.
  s.section('safety-sell-price-restore');
  {
    const db = fresh();
    const price = () => one<{ p: number }>(db, "SELECT price p FROM products WHERE id = 'p1'").p;
    const bill = (sell?: number) =>
      createPurchase(db, {
        userId: 'u_admin',
        supplierId: 'sp2',
        lines: [{ productId: 'p1', qty: 5, unitCostBeforeDisc: 400, newSellPrice: sell }],
        payments: [],
      });
    const a = bill(600);
    s.money('the bill sets the new sell price', price(), 600);
    s.money(
      'and remembers the one it replaced',
      one<{ v: number }>(db, 'SELECT prev_sell_price v FROM purchase_lines WHERE purchase_id = ?', a.id).v,
      520,
    );
    cancelPurchase(db, a.id, 'u_admin', 'wrong bill');
    s.money('cancelling the bill puts the old price back', price(), 520);
    s.ok(
      'and says so in the log',
      !!db.prepare("SELECT 1 FROM activity_log WHERE entity_id = 'p1' AND message LIKE '%back to 520.00%'").get(),
    );

    const b = bill(600);
    db.prepare("UPDATE products SET price = 610 WHERE id = 'p1'").run();
    cancelPurchase(db, b.id, 'u_admin', 'wrong bill');
    s.money('a price changed by hand since then is kept', price(), 610);
    db.prepare("UPDATE products SET price = 520 WHERE id = 'p1'").run();

    const c = bill(600);
    const edit = (sell?: number) =>
      updatePurchase(db, c.id, {
        userId: 'u_admin',
        supplierId: 'sp2',
        reason: 'typo',
        lines: [{ productId: 'p1', qty: 5, unitCostBeforeDisc: 400, newSellPrice: sell }],
      });
    edit(650);
    s.money('a correction can set a different new price', price(), 650);
    cancelPurchase(db, c.id, 'u_admin', 'wrong bill');
    s.money('cancelling after that goes back to the ORIGINAL price', price(), 520);

    const d = bill(600);
    updatePurchase(db, d.id, {
      userId: 'u_admin',
      supplierId: 'sp2',
      reason: 'no new price',
      lines: [{ productId: 'p1', qty: 5, unitCostBeforeDisc: 400 }],
    });
    s.money('a correction that drops the new price puts the old one back', price(), 520);
    db.close();
  }

  // ------------------------------------------------------------------------
  // R51: an ordered bill is not owed until its goods arrive.
  s.section('safety-ordered-bills');
  {
    const db = fresh();
    const before = supplierDue(db, 'sp2');
    const order = createPurchase(db, {
      userId: 'u_admin',
      supplierId: 'sp2',
      status: 'ordered',
      lines: [{ productId: 'p1', qty: 5, unitCostBeforeDisc: 400 }],
      payments: [],
    });
    s.money('an ordered bill is not payable yet', supplierDue(db, 'sp2'), before);
    const paid = payToSupplier(db, { partyId: 'sp2', amount: 500, method: 'Bank', userId: 'u_admin' });
    s.eq('"Pay supplier" puts nothing on the ordered bill', paid.toDocuments.length, 0);
    s.money('the money stays on the account as an advance', paid.advance, 500);
    s.money('so the supplier is paid ahead', supplierDue(db, 'sp2'), round2(before - 500));
    addPurchasePayment(db, order.id, { method: 'Bank', amount: 300 }, 'u_admin');
    s.money('an advance paid on the order itself counts too', supplierDue(db, 'sp2'), round2(before - 800));
    receivePurchase(db, order.id, 'u_admin');
    s.money('once received, the bill is owed', supplierDue(db, 'sp2'), round2(before - 800 + 2000));
    const khata = supplierLedger(db, 'sp2');
    s.money("the supplier's khata ends at the same figure", khata[khata.length - 1]?.balance ?? 0, supplierDue(db, 'sp2'));
    db.close();
  }

  // ------------------------------------------------------------------------
  // R72–R74: the main process cannot be run here, so its wiring is read from
  // the source — enough to catch a handler or a setting being dropped.
  s.section('safety-reliability');
  {
    const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
    const src = (f: string) => fs.readFileSync(path.join(repo, f), 'utf8');
    const main = src('electron/main.ts');
    const updater = src('electron/updater.ts');
    s.ok('the log file opens before anything else', main.indexOf('initLog();') > 0 && main.indexOf('initLog();') < main.indexOf('applyPerfFlagsBeforeReady();'));
    s.ok('an uncaught main-process error is logged', /process\.on\('uncaughtException'/.test(main));
    s.ok('an unhandled rejection is logged', /process\.on\('unhandledRejection'/.test(main));
    s.ok('a crashed screen is reloaded', /render-process-gone[\s\S]{0,900}reload\(\)/.test(main));
    s.ok('a failed start is reported, not silent', /whenReady\(\)\.then\([\s\S]*\}\)\.catch\(/.test(main));
    s.ok('a downloaded update never installs on quit', /autoInstallOnAppQuit = false/.test(updater) && !/autoInstallOnAppQuit = true/.test(updater));
    s.ok(
      'the deferred installer call catches its own failure',
      /setImmediate\(\(\) => \{\s*try \{\s*autoUpdater\.quitAndInstall/.test(updater),
    );
    s.ok('the update check repeats while the app stays open', /setInterval\([\s\S]{0,300}checkForUpdates/.test(updater));
    s.ok('the renderer reports screen errors to the log', /installScreenErrorLog\(\)/.test(src('src/main.tsx')));
  }
}

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').endsWith('verify/safety.ts');
if (isMain) {
  const s = new Suite();
  runSafety(s);
  const rep = s.report();
  console.log(`SAFETY: ${rep.passed}/${rep.total} checks`);
  if (rep.failed > 0) {
    for (const f of rep.failures) console.log(`   - ${f.name}: ${f.detail ?? ''}`);
    process.exit(1);
  }
  console.log('ALL SAFETY CHECKS PASSED');
}
