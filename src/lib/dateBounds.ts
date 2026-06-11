/**
 * Sensible bounds for native <input type="date"> fields.
 *
 * Without min/max, the browser's native date input lets the year segment spin
 * up from 0000, which is why dates felt like they "start at 0." These helpers
 * clamp each field to a realistic range.
 *
 * Usage:  <input type="date" {...pastDateBounds()} />
 */

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

/** Earliest reasonable operational date (credit pulls, logged events, etc.). */
export const PAST_DATE_MIN = '2000-01-01';

/** For dates that must be today or earlier (report dates, logged event dates). */
export const pastDateBounds = (): { min: string; max: string } => ({
  min: PAST_DATE_MIN,
  max: todayISO(),
});

/** For dates that must be today or later (reminders, payment due dates). */
export const futureDateBounds = (): { min: string } => ({
  min: todayISO(),
});

/**
 * For date-of-birth fields: at most today, at least 120 years ago.
 * (Use this when/if a DOB input is added back to the client identity form.)
 */
export const dobBounds = (): { min: string; max: string } => {
  const now = new Date();
  const max = now.toISOString().slice(0, 10);
  const min = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate())
    .toISOString()
    .slice(0, 10);
  return { min, max };
};
