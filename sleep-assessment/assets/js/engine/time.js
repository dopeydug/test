/**
 * Time arithmetic for the Sleep Assessment.
 *
 * All times are handled as "minutes since midnight" (0–1439). Every helper is
 * wrap-around safe so a 12:30am bedtime and a 6:30am wake time behave exactly
 * like a 10:30pm bedtime — nothing here assumes a bedtime is "before" midnight.
 */

export const MINUTES_PER_DAY = 24 * 60;

/** Wrap any minute value into the 0–1439 range (handles negatives). */
export function normalizeMinutes(minutes) {
  return ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** Parse "HH:MM" (24h) into minutes since midnight. Returns null when invalid. */
export function parseTime(hhmm) {
  if (typeof hhmm !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/** Minutes since midnight → "HH:MM" (24h), e.g. 1350 → "22:30". */
export function toHHMM(minutes) {
  const n = normalizeMinutes(minutes);
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Add (or subtract) minutes with wrap-around. */
export function addMinutes(minutes, delta) {
  return normalizeMinutes(minutes + delta);
}

/** Forward distance in minutes from `from` to `to`, wrapping past midnight. */
export function minutesBetween(from, to) {
  return normalizeMinutes(to - from);
}

/**
 * Sleep opportunity: the window between usual bedtime and usual wake time.
 * This is NOT actual sleep duration — the UI and copy must say "in bed", not "asleep".
 * Returns minutes (1–1439). A zero-length window is treated as invalid (null).
 */
export function sleepWindowMinutes(bedtimeMinutes, wakeMinutes) {
  if (bedtimeMinutes == null || wakeMinutes == null) return null;
  const window = minutesBetween(bedtimeMinutes, wakeMinutes);
  return window === 0 ? null : window;
}

/** Round to the nearest `step` minutes; mode: 'nearest' | 'down' | 'up'. */
export function roundToStep(minutes, step = 5, mode = 'nearest') {
  const fn = mode === 'down' ? Math.floor : mode === 'up' ? Math.ceil : Math.round;
  return normalizeMinutes(fn(minutes / step) * step);
}

/**
 * Format minutes since midnight as a friendly 12-hour time: "10:30pm", "6am", "12:05am".
 * Pass { padMinutes: true } to always show minutes ("6:00am").
 */
export function formatTime(minutes, { padMinutes = false } = {}) {
  const n = normalizeMinutes(minutes);
  const h24 = Math.floor(n / 60);
  const m = n % 60;
  const period = h24 >= 12 ? 'pm' : 'am';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  if (m === 0 && !padMinutes) return `${h12}${period}`;
  return `${h12}:${String(m).padStart(2, '0')}${period}`;
}

/** "7h 30m" style duration; whole hours render as "8h". */
export function formatDuration(minutes) {
  if (minutes == null) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/** "7.5 hours" / "8 hours" style duration for prose. */
export function formatDurationProse(minutes) {
  if (minutes == null) return '';
  const hours = Math.round((minutes / 60) * 2) / 2; // nearest half hour
  const label = hours === 1 ? 'hour' : 'hours';
  return `${hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)} ${label}`;
}
