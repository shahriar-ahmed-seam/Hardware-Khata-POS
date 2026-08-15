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
