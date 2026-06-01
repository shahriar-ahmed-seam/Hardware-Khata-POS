import type { DB } from '../db/connection.ts';
import { newId } from '../core/ids.ts';

export interface ActivityInput {
  by?: string;
  branchId?: string;
  action: string;
  entity: string;
  entityId?: string;
  entityRef?: string;
  message?: string;
  amount?: number;
  at?: string;
}

export function logActivity(db: DB, a: ActivityInput): string {
  const id = newId('act');
  db.prepare(
    `INSERT INTO activity_log (id, at, by_user, branch_id, action, entity, entity_id, entity_ref, message, amount)
     VALUES (@id, @at, @by, @branchId, @action, @entity, @entityId, @entityRef, @message, @amount)`,
  ).run({
    id,
    at: a.at ?? new Date().toISOString(),
    by: a.by ?? null,
    branchId: a.branchId ?? null,
    action: a.action,
    entity: a.entity,
    entityId: a.entityId ?? null,
    entityRef: a.entityRef ?? null,
    message: a.message ?? null,
    amount: a.amount ?? null,
  });
  return id;
}
