/** Tiny assertion + reporting harness for the backend verification suite. */
import { EPSILON } from '../core/money.ts';

export interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

export class Suite {
  private results: CheckResult[] = [];
  private group = '';

  section(name: string) {
    this.group = name;
  }

  private push(name: string, ok: boolean, detail?: string) {
    this.results.push({ name: this.group ? `[${this.group}] ${name}` : name, ok, detail });
  }

  ok(name: string, cond: boolean, detail?: string) {
    this.push(name, cond, cond ? undefined : detail);
  }

  eq<T>(name: string, actual: T, expected: T) {
    const ok = actual === expected;
    this.push(name, ok, ok ? undefined : `expected ${String(expected)}, got ${String(actual)}`);
  }

  /** money equality within EPSILON */
  money(name: string, actual: number, expected: number) {
    const ok = Math.abs(actual - expected) <= EPSILON;
    this.push(name, ok, ok ? undefined : `expected ${expected.toFixed(4)}, got ${actual.toFixed(4)} (Δ ${(actual - expected).toFixed(4)})`);
  }

  gt(name: string, actual: number, min: number) {
    const ok = actual > min;
    this.push(name, ok, ok ? undefined : `expected > ${min}, got ${actual}`);
  }

  gte(name: string, actual: number, min: number) {
    const ok = actual >= min;
    this.push(name, ok, ok ? undefined : `expected >= ${min}, got ${actual}`);
  }

  report(): { passed: number; failed: number; total: number; failures: CheckResult[] } {
    const failures = this.results.filter((r) => !r.ok);
    return {
      passed: this.results.length - failures.length,
      failed: failures.length,
      total: this.results.length,
      failures,
    };
  }

  all(): CheckResult[] {
    return this.results;
  }
}
