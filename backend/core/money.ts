/**
 * Money helpers. We store money as REAL (float) in SQLite but round to 2 dp at
 * every boundary so accumulated float error never leaks into totals or
 * accounting identities. All comparisons in the verification harness use a
 * tiny epsilon to tolerate the last-bit float noise.
 */

export const EPSILON = 0.01; // 1 paisa tolerance

/** Round to 2 decimal places (banker-free, standard half-up). */
export function round2(n: number): number {
  // +Number.EPSILON guards against 1.005 -> 1.00 type errors
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Sum an array of numbers with rounding applied to the result. */
export function sum2(nums: number[]): number {
  return round2(nums.reduce((a, b) => a + b, 0));
}

/** True when two money values are equal within EPSILON. */
export function moneyEq(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPSILON;
}

/** Clamp negative money noise to zero (e.g. due should never be -0.001). */
export function clampZero(n: number): number {
  return Math.abs(n) < EPSILON ? 0 : n;
}
