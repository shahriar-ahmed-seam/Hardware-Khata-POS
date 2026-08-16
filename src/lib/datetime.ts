/**
 * LOCAL WALL-CLOCK TIME vs THE STORED INSTANT.
 *
 * THE BUG THESE HELPERS EXIST TO KILL
 * Every form in the app filled its date box like this:
 *
 *     useState(new Date().toISOString().slice(0, 16))
 *
 * `toISOString()` is **UTC**. In Bangladesh (UTC+6) that means at 10:02 in the
 * morning the box read `04:02`, and it looked like a plain bug in the clock. It
 * was worse than cosmetic:
 *
 *   - If the user LEFT the default alone, the wrong-looking time was written, but
 *     it happened to be the correct instant (UTC, just truncated), so reports
 *     still added up. Confusing, not incorrect.
 *   - If the user CORRECTED it to 10:02 — the obvious thing to do — the string
 *     `"2026-08-15T10:02"` went to the database, where every other timestamp is
 *     UTC. That instant is six hours in the future, so the sale could land in
 *     tomorrow's takings and the wrong cash shift.
 *
 * So the display bug actively lured the user into entering bad data.
 *
 * THE RULE, now in one place:
 *   - `<input type="datetime-local">` speaks LOCAL wall-clock time and has no
 *     timezone. Fill it with `toLocalInput()`.
 *   - The database stores a full ISO-8601 **UTC instant**, exactly like the POS
 *     (`new Date().toISOString()`). Convert on save with `fromLocalInput()`.
 *
 * Do not shorten either of these to a `slice()`. That is what caused this.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A stored instant → the `YYYY-MM-DDTHH:mm` LOCAL string a datetime-local input
 * expects. Falls back to now when there is nothing to show.
 *
 * Built from the local getters rather than `toISOString()`, which is the whole
 * point: `getHours()` is the hour the shopkeeper's clock shows.
 */
export function toLocalInput(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  return (
    `${safe.getFullYear()}-${pad(safe.getMonth() + 1)}-${pad(safe.getDate())}` +
    `T${pad(safe.getHours())}:${pad(safe.getMinutes())}`
  );
}

/** Right now, as a datetime-local value. The default for any "when" field. */
export function nowLocalInput(): string {
  return toLocalInput();
}

/**
 * A `YYYY-MM-DDTHH:mm` LOCAL string → the full ISO UTC instant to store.
 *
 * `new Date('2026-08-15T10:02')` — no trailing Z — is parsed by JavaScript as
 * LOCAL time, which is precisely what the input meant, so the conversion is just
 * back through `toISOString()`. An unparseable or empty value falls back to now
 * rather than writing `Invalid Date` into the shop's books.
 */
export function fromLocalInput(value?: string | null): string {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

/**
 * A stored instant → the `YYYY-MM-DD` LOCAL string a date input expects.
 *
 * Same trap in miniature: `toISOString().slice(0, 10)` returns the UTC calendar
 * day, so late in the evening in UTC+6 it names YESTERDAY.
 */
export function toLocalDateInput(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  return `${safe.getFullYear()}-${pad(safe.getMonth() + 1)}-${pad(safe.getDate())}`;
}

/** Today, as a date-input value, on the shop's clock. */
export function todayLocalDateInput(): string {
  return toLocalDateInput();
}

/** Today plus `days`, as a date-input value. Used for "valid until" defaults. */
export function localDateInputPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toLocalDateInput(d.toISOString());
}

// ---------------------------------------------------------------------------
// DATE RANGES — ONE DEFINITION, MIRRORING THE BACKEND
// ---------------------------------------------------------------------------
/**
 * `backend/core/dates.ts` `resolveRange()` is the authority on what a preset
 * means, because it is what every report, dashboard figure and paged list query
 * is actually computed against. These helpers exist so the renderer stops
 * re-deriving the same thing slightly differently.
 *
 * THE BUG THIS CLOSES
 * "This week" meant two different things depending on which screen you were on.
 * The backend starts the week on SATURDAY (the Bangladeshi working week, and what
 * the Reports toolbar used), but the Sales and Purchases list presets computed a
 * MONDAY start client-side:
 *
 *     const dow = (start.getDay() + 6) % 7;   // days since Monday
 *
 * So on a Saturday, Reports showed the week's takings and the Sales list showed
 * nothing at all — and on a Sunday the two disagreed by two days, with no
 * indication that they were answering different questions.
 */

/** Local midnight at the start of `d`'s calendar day. */
export function startOfLocalDay(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/** Local 23:59:59.999 on `d`'s calendar day — an INCLUSIVE upper bound. */
export function endOfLocalDay(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/**
 * Local midnight on the SATURDAY that starts the week containing `d`.
 *
 * Saturday is the first working day in Bangladesh, which is why the backend uses
 * it. `getDay()` is 0=Sunday..6=Saturday, so `(day + 1) % 7` is the number of
 * days since the most recent Saturday — the identical expression to the one in
 * `backend/core/dates.ts`, deliberately.
 */
export function startOfBusinessWeek(d: Date = new Date()): Date {
  const daysSinceSaturday = (d.getDay() + 1) % 7;
  const from = new Date(d);
  from.setDate(d.getDate() - daysSinceSaturday);
  return startOfLocalDay(from);
}

/** A bare calendar day, as produced by an `<input type="date">`. */
const BARE_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse one end of a user-picked range, on the SHOP'S clock.
 *
 * `new Date('2026-01-10')` is parsed as UTC midnight, not local midnight — the
 * same trap as `toISOString().slice(0, 10)` above. Left alone it drops the whole
 * of the last day (every event on the 10th is after `2026-01-10T00:00:00Z`) and
 * puts the bounds six hours away from every preset. The backend fixed this in
 * `parseBound`; this is the renderer's half of the same fix.
 *
 * A value that already carries a time is passed through untouched — a caller that
 * specified one meant it.
 */
export function parseRangeBound(value: string, which: 'from' | 'to'): Date {
  if (BARE_DAY.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return which === 'from'
      ? new Date(y, m - 1, d, 0, 0, 0, 0)
      : new Date(y, m - 1, d, 23, 59, 59, 999);
  }
  return new Date(value);
}
