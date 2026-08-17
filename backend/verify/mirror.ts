/**
 * ============================================================================
 *  THE RENDERER'S MONEY MIRROR MUST AGREE WITH THE MONEY CORE
 * ============================================================================
 *
 * `backend/core/calc.ts` is the authority on every money figure. The renderer
 * cannot call it (it lives in the main process), so `src/lib/money.ts` mirrors it
 * — and a mirror that is only checked by eye drifts. Three bugs came from exactly
 * that drift, and all three were invisible to every other suite in this harness,
 * because the backend was always right; it was the SCREEN that was wrong:
 *
 *   1. a line subtotal recomputed without its `max(0, …)` clamp printed a
 *      negative figure on a receipt while the total counted zero;
 *   2. the sale form pooled line discounts and clamped the POOL instead of each
 *      line, so a mistyped 150% discount on one line quietly ate ৳50 off another
 *      and the invoice stored a total ৳50 higher than the operator collected;
 *   3. nothing in the renderer rounded, while the core rounds the unit price
 *      BEFORE multiplying by quantity — leaving a ৳0.50 due on a sale that had
 *      been paid in full, which no payment screen could ever clear.
 *
 * This suite is the reason none of those can come back. It drives BOTH
 * implementations with the same randomised inputs — including the nasty ones
 * (over-100% discounts, flat discounts bigger than the line, prices that land on
 * a half-paisa, thousand-unit quantities) — and asserts they agree to the paisa.
 *
 * `src/lib/money.ts` deliberately has NO imports, which is what lets this run
 * under plain Node with no React, no DOM and no bundler.
 *
 * IF THIS SUITE FAILS: the renderer and the invoice disagree about money. Fix the
 * mirror to match the core, never the other way round.
 */
import {
  computeSaleLine,
  computeSaleTotals,
  computePurchaseLine,
  computePurchaseTotals,
  computeDue,
  marginPct,
} from '../core/calc.ts';
import { round2, sum2 } from '../core/money.ts';
import {
  saleUnitPrice,
  saleLineSubtotal,
  saleTotals,
  purchaseLine as mirrorPurchaseLine,
  purchaseTotals as mirrorPurchaseTotals,
  computeDue as mirrorComputeDue,
  markupOnCostPct,
  round2 as mirrorRound2,
  sum2 as mirrorSum2,
} from '../../src/lib/money.ts';
import { Suite } from './assert.ts';

/** Deterministic PRNG so a failure is always reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function runMirror(): { passed: number; failed: number; total: number } {
  const s = new Suite();

  // ------------------------------------------------- the primitives agree
  s.section('mirror-primitives');
  const trickyNumbers = [
    0, 1, 1.005, 2.675, 0.005, 0.015, 99.99, 104.9895, 87.49125, 1 / 3,
    1e-9, 12345.678, -0.004, 0.1 + 0.2,
  ];
  let roundMismatch = 0;
  for (const n of trickyNumbers) {
    if (round2(n) !== mirrorRound2(n)) roundMismatch++;
  }
  s.eq('round2 is identical on half-paisa and float-noise values', roundMismatch, 0);
  s.eq(
    'sum2 is identical',
    mirrorSum2([0.1, 0.2, 0.005, 99.99]),
    sum2([0.1, 0.2, 0.005, 99.99]),
  );

  // ------------------------------------------------------- known regressions
  // The exact cases that shipped wrong, pinned by value rather than by property.
  s.section('mirror-known-regressions');

  // (1) a flat discount larger than the line must clamp to zero, not go negative
  s.money(
    'a flat discount bigger than the line clamps to zero (core)',
    computeSaleLine({ qty: 1, spr: 100, markupPct: 0, discountPct: 0, discountFlat: 500 })
      .lineSubtotal,
    0,
  );
  s.money(
    'and the mirror agrees',
    saleLineSubtotal({ qty: 1, unitPrice: 100, discountPct: 0, discountFlat: 500 }),
    0,
  );

  // (2) an over-discounted line must not eat into another line
  {
    const lines = [
      { qty: 1, spr: 100, markupPct: 0, discountPct: 150, discountFlat: 0 },
      { qty: 1, spr: 1000, markupPct: 0, discountPct: 0, discountFlat: 0 },
    ];
    const computed = lines.map(computeSaleLine);
    const core = computeSaleTotals({
      lineSubtotals: computed.map((c) => c.lineSubtotal),
      lineGrosses: computed.map((c, i) => round2(c.unitPrice * lines[i].qty)),
      orderDiscountPct: 0,
      orderDiscountFlat: 0,
      taxPct: 0,
      shipping: 0,
      other: 0,
    });
    const mirror = saleTotals({
      lines: lines.map((l) => ({
        qty: l.qty,
        unitPrice: saleUnitPrice(l.spr, l.markupPct),
        discountPct: l.discountPct,
        discountFlat: l.discountFlat,
      })),
      orderDiscountPct: 0,
      orderDiscountFlat: 0,
      taxPct: 0,
      shipping: 0,
      other: 0,
    });
    s.money('an over-discounted line cannot reduce another line (core)', core.total, 1000);
    s.money('the mirror agrees — this used to read 950', mirror.total, 1000);
  }

  // (3) the unit price is rounded BEFORE multiplying by quantity
  {
    const core = computeSaleLine({
      qty: 1000,
      spr: 99.99,
      markupPct: 5,
      discountPct: 0,
      discountFlat: 0,
    });
    s.money('the core rounds the unit price first', core.unitPrice, 104.99);
    s.money('so a thousand units is 104,990.00', core.lineSubtotal, 104990);
    s.money(
      'the mirror agrees — this used to read 104,989.50',
      saleLineSubtotal({
        qty: 1000,
        unitPrice: saleUnitPrice(99.99, 5),
        discountPct: 0,
        discountFlat: 0,
      }),
      104990,
    );
  }

  // (4) a purchase line's net cost and line total must agree with each other
  {
    const core = computePurchaseLine({
      qty: 100,
      unitCostBeforeDisc: 99.99,
      discountPct: 12.5,
      discountFlat: 0,
      taxPct: 0,
    });
    const mirror = mirrorPurchaseLine({
      qty: 100,
      unitCostBeforeDisc: 99.99,
      discountPct: 12.5,
      discountFlat: 0,
      taxPct: 0,
    });
    s.money('net unit cost is rounded', core.unitCostBeforeTax, 87.49);
    s.money('so the line total is 8,749.00', core.lineTotal, 8749);
    s.money('the mirror agrees on the unit cost', mirror.unitCostBeforeTax, 87.49);
    s.money('and on the line total — this used to read 8,749.13', mirror.lineTotal, 8749);
  }

  // -------------------------------------------- randomised agreement, sales
  // Property: for ANY basket the core and the mirror produce the same invoice.
  s.section('mirror-sales-randomised');
  {
    const rand = rng(20260817);
    let lineMismatch = 0;
    let totalMismatch = 0;
    let dueMismatch = 0;
    let worstTotalDelta = 0;
    const CASES = 400;
    for (let c = 0; c < CASES; c++) {
      const nLines = 1 + Math.floor(rand() * 6);
      const raw: {
        qty: number;
        spr: number;
        markupPct: number;
        discountPct: number;
        discountFlat: number;
      }[] = [];
      for (let i = 0; i < nLines; i++) {
        raw.push({
          // Quantities that hit the rounding boundary, and one big one.
          qty: rand() < 0.2 ? 1000 : round2(1 + rand() * 40),
          spr: round2(rand() * 5000 + 0.005),
          markupPct: rand() < 0.4 ? round2(rand() * 20) : 0,
          // 20% of lines carry an ABSURD discount, which is the case that broke.
          discountPct: rand() < 0.2 ? round2(100 + rand() * 100) : round2(rand() * 30),
          discountFlat: rand() < 0.25 ? round2(rand() * 3000) : 0,
        });
      }
      const orderDiscountPct = rand() < 0.3 ? round2(rand() * 15) : 0;
      const orderDiscountFlat = rand() < 0.3 ? round2(rand() * 500) : 0;
      const taxPct = rand() < 0.5 ? [0, 5, 7.5, 15][Math.floor(rand() * 4)] : 0;
      const shipping = rand() < 0.3 ? round2(rand() * 400) : 0;
      const other = rand() < 0.2 ? round2(rand() * 200) : 0;

      const computed = raw.map(computeSaleLine);
      const core = computeSaleTotals({
        lineSubtotals: computed.map((x) => x.lineSubtotal),
        lineGrosses: computed.map((x, i) => round2(x.unitPrice * raw[i].qty)),
        orderDiscountPct,
        orderDiscountFlat,
        taxPct,
        shipping,
        other,
      });

      const mirrorLines = raw.map((l) => ({
        qty: l.qty,
        unitPrice: saleUnitPrice(l.spr, l.markupPct),
        discountPct: l.discountPct,
        discountFlat: l.discountFlat,
      }));
      const mirror = saleTotals({
        lines: mirrorLines,
        orderDiscountPct,
        orderDiscountFlat,
        taxPct,
        shipping,
        other,
      });

      for (let i = 0; i < raw.length; i++) {
        if (Math.abs(computed[i].lineSubtotal - saleLineSubtotal(mirrorLines[i])) > 0.0001) {
          lineMismatch++;
        }
      }
      const delta = Math.abs(core.total - mirror.total);
      if (delta > 0.0001) {
        totalMismatch++;
        worstTotalDelta = Math.max(worstTotalDelta, delta);
      }
      if (Math.abs(core.subtotal - mirror.subtotal) > 0.0001) totalMismatch++;
      if (Math.abs(core.tax - mirror.tax) > 0.0001) totalMismatch++;
      if (Math.abs(core.orderDiscount - mirror.orderDiscount) > 0.0001) totalMismatch++;
      if (Math.abs(core.totalLineDiscount - mirror.totalLineDiscount) > 0.0001) totalMismatch++;

      // And the due the screen would show must match the due the backend stores.
      const part = round2(core.total * (rand() * 1.2));
      if (Math.abs(computeDue(core.total, [part]) - mirrorComputeDue(mirror.total, [part])) > 0.0001) {
        dueMismatch++;
      }
    }
    s.eq(`every line subtotal agrees across ${CASES} random baskets`, lineMismatch, 0);
    s.eq('every order-level figure agrees', totalMismatch, 0);
    s.eq('the due agrees, so a paid-in-full sale cannot keep a phantom balance', dueMismatch, 0);
    s.money('worst total divergence is zero', worstTotalDelta, 0);
  }

  // ----------------------------------------- randomised agreement, purchases
  s.section('mirror-purchases-randomised');
  {
    const rand = rng(987654321);
    let mismatch = 0;
    let worst = 0;
    const CASES = 400;
    for (let c = 0; c < CASES; c++) {
      const nLines = 1 + Math.floor(rand() * 6);
      const lines = [];
      for (let i = 0; i < nLines; i++) {
        lines.push({
          qty: rand() < 0.2 ? 100 : round2(1 + rand() * 50),
          unitCostBeforeDisc: round2(rand() * 4000 + 0.005),
          discountPct: rand() < 0.2 ? round2(100 + rand() * 50) : round2(rand() * 25),
          discountFlat: rand() < 0.25 ? round2(rand() * 2000) : 0,
          taxPct: rand() < 0.4 ? [0, 5, 15][Math.floor(rand() * 3)] : 0,
        });
      }
      const orderDiscountType = rand() < 0.5 ? ('percent' as const) : ('flat' as const);
      const orderDiscountValue =
        orderDiscountType === 'percent' ? round2(rand() * 12) : round2(rand() * 800);
      const taxPct = rand() < 0.4 ? [0, 5, 15][Math.floor(rand() * 3)] : 0;
      const shipping = rand() < 0.3 ? round2(rand() * 500) : 0;
      const other = rand() < 0.2 ? round2(rand() * 300) : 0;

      for (const l of lines) {
        const a = computePurchaseLine(l);
        const b = mirrorPurchaseLine(l);
        if (Math.abs(a.unitCostBeforeTax - b.unitCostBeforeTax) > 0.0001) mismatch++;
        if (Math.abs(a.lineTotal - b.lineTotal) > 0.0001) mismatch++;
      }
      const core = computePurchaseTotals({
        lines,
        orderDiscountType,
        orderDiscountValue,
        taxPct,
        shipping,
        other,
      });
      const mirror = mirrorPurchaseTotals({
        lines,
        orderDiscountType,
        orderDiscountValue,
        taxPct,
        shipping,
        other,
      });
      for (const k of [
        'subtotal',
        'totalLineDiscount',
        'orderDiscount',
        'taxableBase',
        'tax',
        'total',
      ] as const) {
        const d = Math.abs(core[k] - mirror[k]);
        if (d > 0.0001) {
          mismatch++;
          worst = Math.max(worst, d);
        }
      }
    }
    s.eq(`every purchase figure agrees across ${CASES} random bills`, mismatch, 0);
    s.money('worst purchase divergence is zero', worst, 0);
  }

  // -------------------------------------------------------------- margin
  s.section('mirror-markup');
  {
    const rand = rng(555);
    let mismatch = 0;
    for (let i = 0; i < 200; i++) {
      const cost = rand() < 0.1 ? 0 : round2(rand() * 1000);
      const sell = round2(rand() * 2000);
      if (Math.abs(marginPct(sell, cost) - markupOnCostPct(sell, cost)) > 0.0001) mismatch++;
    }
    s.eq('markup-on-cost agrees with the core, including cost = 0', mismatch, 0);
  }

  const rep = s.report();
  const label = 'MIRROR (renderer money core)';
  if (rep.failed > 0) {
    console.log(`${label}: ${rep.passed}/${rep.total} checks`);
    console.log(`\n${rep.failed} FAILURES — THE SCREEN AND THE INVOICE DISAGREE:`);
    for (const f of rep.failures) console.log(`   - ${f.name}: ${f.detail ?? ''}`);
  } else {
    console.log(`${label}: ${rep.total}/${rep.total} checks`);
    console.log('ALL MIRROR CHECKS PASSED');
  }
  return rep;
}

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').endsWith('verify/mirror.ts');
if (isMain) {
  const r = runMirror();
  process.exit(r.failed > 0 ? 1 : 0);
}
