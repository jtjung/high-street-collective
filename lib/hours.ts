/**
 * Utilities for parsing Outscraper/Google Maps working_hours JSON and
 * checking whether a business is open at a given day + time.
 *
 * Expected format (from Outscraper):
 *   { "Monday": "9:00 AM – 5:00 PM", "Tuesday": "Closed", ... }
 *
 * Time strings may use an en dash (–) or regular dash (-) as the separator.
 * Special values: "Open 24 hours", "Closed"
 */

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Parse "9:00 AM", "9 AM", "12:30 PM" → minutes from midnight (0–1439). */
function parseTime(str: string): number | null {
  const m = str.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!m) return null;
  let hours = parseInt(m[1], 10);
  const minutes = m[2] ? parseInt(m[2], 10) : 0;
  const period = m[3].toUpperCase();
  if (period === "AM") {
    if (hours === 12) hours = 0; // 12 AM = midnight
  } else {
    if (hours !== 12) hours += 12; // 12 PM = noon (no change)
  }
  return hours * 60 + minutes;
}

type ParsedRange =
  | { kind: "range"; openMinutes: number; closeMinutes: number }
  | { kind: "open24" }
  | { kind: "closed" };

function parseHoursString(value: string): ParsedRange | null {
  const v = value.trim();
  if (/^open 24 hours$/i.test(v)) return { kind: "open24" };
  if (/^closed$/i.test(v)) return { kind: "closed" };

  // Split on en dash (–) or hyphen (-), allowing optional surrounding spaces
  const parts = v.split(/\s*[–\-]\s*/);
  if (parts.length !== 2) return null;

  const openMinutes = parseTime(parts[0]);
  const closeMinutes = parseTime(parts[1]);
  if (openMinutes === null || closeMinutes === null) return null;

  return { kind: "range", openMinutes, closeMinutes };
}

/**
 * Returns true if the business represented by `working_hours` is open at
 * `day` (0 = Sunday … 6 = Saturday) and `minutesFromMidnight` (0–1439).
 *
 * Returns false if hours data is missing, unparseable, or the business is
 * closed at that time.
 */
export function isOpenAt(
  working_hours: unknown,
  day: number,
  minutesFromMidnight: number
): boolean {
  if (
    !working_hours ||
    typeof working_hours !== "object" ||
    Array.isArray(working_hours)
  )
    return false;

  const hours = working_hours as Record<string, unknown>;
  const dayName = DAY_NAMES[day];
  const raw = hours[dayName];

  if (!raw || typeof raw !== "string") return false;

  const parsed = parseHoursString(raw);
  if (!parsed) return false;
  if (parsed.kind === "closed") return false;
  if (parsed.kind === "open24") return true;

  const { openMinutes, closeMinutes } = parsed;

  // Handle spans crossing midnight (e.g., "10:00 PM – 2:00 AM")
  if (closeMinutes <= openMinutes) {
    return (
      minutesFromMidnight >= openMinutes || minutesFromMidnight < closeMinutes
    );
  }
  return (
    minutesFromMidnight >= openMinutes && minutesFromMidnight < closeMinutes
  );
}

/** Convenience: check if open right now. */
export function isOpenNow(working_hours: unknown): boolean {
  const now = new Date();
  return isOpenAt(working_hours, now.getDay(), now.getHours() * 60 + now.getMinutes());
}

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
// Display order: Monday-first (UK convention)
const DISPLAY_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * Returns a human-readable open-status label, e.g.
 *   { open: true,  label: "Open · closes 5 PM" }
 *   { open: false, label: "Closed · opens 9 AM Mon" }
 * Returns null if no hours data is available for today.
 */
export function openStatusLabel(
  working_hours: unknown
): { open: boolean; label: string } | null {
  if (
    !working_hours ||
    typeof working_hours !== "object" ||
    Array.isArray(working_hours)
  )
    return null;

  const hours = working_hours as Record<string, unknown>;
  const now = new Date();
  const todayRaw = hours[DAY_NAMES[now.getDay()]];
  if (!todayRaw || typeof todayRaw !== "string") return null;

  const parsed = parseHoursString(todayRaw.trim());
  if (!parsed) return null;

  const open = isOpenNow(working_hours);

  if (open) {
    if (parsed.kind === "open24") return { open: true, label: "Open 24h" };
    if (parsed.kind === "range")
      return { open: true, label: `Open · closes ${formatMinutes(parsed.closeMinutes)}` };
  } else {
    if (
      parsed.kind === "range" &&
      now.getHours() * 60 + now.getMinutes() < parsed.openMinutes
    ) {
      return { open: false, label: `Closed · opens ${formatMinutes(parsed.openMinutes)}` };
    }
    for (let delta = 1; delta <= 7; delta++) {
      const nextDay = (now.getDay() + delta) % 7;
      const nextRaw = hours[DAY_NAMES[nextDay]];
      if (!nextRaw || typeof nextRaw !== "string") continue;
      const nextParsed = parseHoursString(nextRaw.trim());
      if (!nextParsed || nextParsed.kind === "closed") continue;
      const dayLabel = delta === 1 ? "tomorrow" : DAY_NAMES_SHORT[nextDay];
      if (nextParsed.kind === "open24")
        return { open: false, label: `Closed · opens ${dayLabel}` };
      if (nextParsed.kind === "range")
        return {
          open: false,
          label: `Closed · opens ${formatMinutes(nextParsed.openMinutes)} ${dayLabel}`,
        };
    }
    return { open: false, label: "Closed" };
  }
  return null;
}

/**
 * Returns all 7 days formatted for display (Monday-first).
 * Returns null if no hours data exists.
 */
export function allHoursFormatted(
  working_hours: unknown
): Array<{ day: string; hours: string }> | null {
  if (
    !working_hours ||
    typeof working_hours !== "object" ||
    Array.isArray(working_hours)
  )
    return null;

  const h = working_hours as Record<string, unknown>;
  const result = DISPLAY_DAY_ORDER.map((i) => ({
    day: DAY_NAMES_SHORT[i],
    hours: typeof h[DAY_NAMES[i]] === "string" ? (h[DAY_NAMES[i]] as string).trim() : "—",
  }));
  return result.some((r) => r.hours !== "—") ? result : null;
}
