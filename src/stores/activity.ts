import { create } from 'zustand';

/**
 * Activity types + a small client-side event buffer.
 *
 * The AUTHORITATIVE activity history is the backend `activity_log` table, read
 * through the `dashboard.activityFeed` channel (see ActivityLogPage and the
 * dashboard Activity widget). This store previously shipped 19 invented events
 * (fake invoices, staff names and amounts) as its initial state — that is gone;
 * it now starts EMPTY and only holds events logged during the current session.
 */

export type ActivityAction =
  | 'created'
  | 'edited'
  | 'voided'
  | 'paid'
  | 'returned'
  | 'shipped'
  | 'opened'
  | 'closed'
  | 'transferred'
  | 'adjusted'
  | 'login'
  | 'logout'
  | 'deleted'
  | 'imported';

export type ActivityEntity =
  | 'sale'
  | 'purchase'
  | 'return'
  | 'shipment'
  | 'product'
  | 'customer'
  | 'supplier'
  | 'expense'
  | 'shift'
  | 'transfer'
  | 'adjustment'
  | 'user'
  | 'settings';

export interface ActivityEvent {
  id: string;
  at: string;
  by: string; // user name
  action: ActivityAction;
  entity: ActivityEntity;
  entityId?: string;
  entityRef?: string; // human-readable like "INV-2026-0451"
  message: string;
  amount?: number;
  branch?: string;
}

interface State {
  events: ActivityEvent[];
  log: (e: Omit<ActivityEvent, 'id' | 'at'>) => void;
}

export const useActivity = create<State>((set) => ({
  events: [],
  log: (e) =>
    set((s) => ({
      events: [{ id: 'a_' + Date.now(), at: new Date().toISOString(), ...e }, ...s.events],
    })),
}));
