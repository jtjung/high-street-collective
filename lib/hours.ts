/**
 * Utilities for parsing Outscraper/Google Maps working_hours JSON and
 * checking whether a business is open at a given day + time.
 *
 * Real Outscraper format (arrays of compact lowercase strings):
 *   { "Monday": ["Closed"],
 *     "Tuesday": ["5-11:30pm"],
 *     "Friday": ["12-11:30pm", "..."],   // occasionally split ranges
 *     "Saturday": ["8am-10:30pm"],
 *     "Sunday": ["12pm-12am"] }
 *
 * Also tolerates the older docs format:
 *   { "Monday": "9:00 AM – 5:00 PM", ... }
 *
 * Special values: "Open 24 hours" / "24 hours" / "Closed".
 *
 * Notes on the compact format:
 * - Hyphen/en-dash separates open and close; spaces around it are optional.
 * - AM/PM may be lowercase ("am", "pm") or uppercase; period (.) optional.
 * - Open-time period is often omitted when it matches the close period,
 *   e.g. "12-11:30pm" means 12 PM – 11:30 PM. When missing we inherit
 *   from the close time.
 * - "12pm-12am" is a valid "open until midnight" range.
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

type Period = "AM" | "PM";

/** Parse a single time token. Period may be undefined (caller resolves). */
function parseTimeToken(
  str: string
): { hours: number; minutes: number; period: Period | null } | null {
  const m = str
    .trim()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/i);
  if (!m) return null;
  const hours = parseInt(m[1], 10);
  const minutes = m[2] ? parseInt(m[2], 10) : 0;
  if (hours < 0 || hours > 24) return null;
  if (minutes < 0 || minutes > 59) return null;
  let period: Period | null = null;
  if (m[3]) {
    period = /^p/i.test(m[3]) ? "PM" : "AM";
  }
  return { hours, minutes, period };
}

function tokenToMinutes(hours: number, minutes: number, period: Period): number {
  let h = hours;
  if (period === "AM") {
    if (h === 12) h = 0; // 12 AM = midnight
  } else {
    if (h !== 12) h += 12; // 12 PM = noon (unchanged), others add 12
  }
  return h * 60 + minutes;
}

type ParsedRange =
  | { kind: "range"; openMinutes: number; closeMinutes: number }
  | { kind: "open24" }
  | { kind: "closed" };

function parseHoursString(value: string): ParsedRange | null {
  const v = value.trim();
  if (!v) return null;
  if (/^closed$/i.test(v)) return { kind: "closed" };
  if (/^(open\s+)?24\s*hours?$/i.test(v)) return { kind: "open24" };

  // Split on en dash (–), em dash (—), or hyphen (-), optional surrounding spaces.
  const parts = v.split(/\s*[\u2013\u2014\-]\s*/);
  if (parts.length !== 2) return null;

  const openTok = parseTimeToken(parts[0]);
  const closeTok = parseTimeToken(parts[1]);
  if (!openTok || !closeTok) return null;

  // Close MUST have a period in compact data. If missing (old spaced format
  // might omit both — extremely rare), default to PM which is the common case.
  const closePeriod: Period = closeTok.period ?? "PM";
  // Open period inherits from close when omitted. Special case: "12pm-12am"
  // has both explicit, so inheritance only triggers when open period is null.
  const openPeriod: Period = openTok.period ?? closePeriod;

  const openMinutes = tokenToMinutes(openTok.hours, openTok.minutes, openPeriod);
  let closeMinutes = tokenToMinutes(closeTok.hours, closeTok.minutes, closePeriod);

  // "12am" at end = midnight = 0 min, which would always look like a crossing.
  // Treat 0-minute close as "24*60" (end of day) so ranges like "12pm-12am"
  // map to noon→midnight cleanly. Only apply when open > 0.
  if (closeMinutes === 0 && openMinutes > 0) {
    closeMinutes = 24 * 60;
  }

  return { kind: "range", openMinutes, closeMinutes };
}

/** Extract one or more hour strings for a given day (tolerate string or array). */
function dayRaw(hours: Record<string, unknown>, dayName: string): string[] {
  const raw = hours[dayName];
  if (!raw) return [];
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string");
  }
  return [];
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
  const rawList = dayRaw(hours, dayName);
  if (rawList.length === 0) return false;

  // A day is "open" if any of its ranges contain the time.
  for (const raw of rawList) {
    const parsed = parseHoursString(raw);
    if (!parsed) continue;
    if (parsed.kind === "closed") continue;
    if (parsed.kind === "open24") return true;
    const { openMinutes, closeMinutes } = parsed;
    if (closeMinutes <= openMinutes) {
      if (
        minutesFromMidnight >= openMinutes ||
        minutesFromMidnight < closeMinutes
      )
        return true;
    } else if (
      minutesFromMidnight >= openMinutes &&
      minutesFromMidnight < closeMinutes
    ) {
      return true;
    }
  }
  return false;
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
  const total = minutes % (24 * 60); // normalize 24*60 → 0 for display
  const h = Math.floor(total / 60);
  const m = total % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Format a parsed range for display, e.g. "12 PM – 11:30 PM". */
function formatRange(parsed: ParsedRange): string {
  if (parsed.kind === "closed") return "Closed";
  if (parsed.kind === "open24") return "Open 24h";
  return `${formatMinutes(parsed.openMinutes)} – ${formatMinutes(parsed.closeMinutes)}`;
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
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayRaw = dayRaw(hours, DAY_NAMES[now.getDay()]);
  if (todayRaw.length === 0) return null;

  // Parse all ranges for today
  const todayRanges = todayRaw
    .map((s) => parseHoursString(s))
    .filter((p): p is ParsedRange => p !== null);
  if (todayRanges.length === 0) return null;

  const open = isOpenNow(working_hours);

  if (open) {
    // Find the range that contains "now" and report its close.
    for (const p of todayRanges) {
      if (p.kind === "open24") return { open: true, label: "Open 24h" };
      if (p.kind !== "range") continue;
      const { openMinutes, closeMinutes } = p;
      const inside =
        closeMinutes <= openMinutes
          ? nowMinutes >= openMinutes || nowMinutes < closeMinutes
          : nowMinutes >= openMinutes && nowMinutes < closeMinutes;
      if (inside)
        return { open: true, label: `Open · closes ${formatMinutes(closeMinutes)}` };
    }
    return { open: true, label: "Open" };
  }

  // Not open: see if there's a later slot today
  for (const p of todayRanges) {
    if (p.kind === "range" && nowMinutes < p.openMinutes) {
      return { open: false, label: `Closed · opens ${formatMinutes(p.openMinutes)}` };
    }
  }

  // Look ahead up to 7 days
  for (let delta = 1; delta <= 7; delta++) {
    const nextDay = (now.getDay() + delta) % 7;
    const nextList = dayRaw(hours, DAY_NAMES[nextDay]);
    for (const r of nextList) {
      const parsed = parseHoursString(r);
      if (!parsed || parsed.kind === "closed") continue;
      const dayLabel = delta === 1 ? "tomorrow" : DAY_NAMES_SHORT[nextDay];
      if (parsed.kind === "open24")
        return { open: false, label: `Closed · opens ${dayLabel}` };
      return {
        open: false,
        label: `Closed · opens ${formatMinutes(parsed.openMinutes)} ${dayLabel}`,
      };
    }
  }
  return { open: false, label: "Closed" };
}

/**
 * Returns all 7 days formatted for display (Monday-first).
 * Returns null if no hours data exists.
 */
export function allHoursFormatted(
  working_hours: unknown
): Array<{ day: string; hours: string; isToday: boolean }> | null {
  if (
    !working_hours ||
    typeof working_hours !== "object" ||
    Array.isArray(working_hours)
  )
    return null;

  const h = working_hours as Record<string, unknown>;
  const today = new Date().getDay();
  const result = DISPLAY_DAY_ORDER.map((i) => {
    const list = dayRaw(h, DAY_NAMES[i]);
    if (list.length === 0) {
      return { day: DAY_NAMES_SHORT[i], hours: "—", isToday: i === today };
    }
    const parts = list
      .map((s) => {
        const parsed = parseHoursString(s);
        return parsed ? formatRange(parsed) : s.trim();
      })
      .filter(Boolean);
    return {
      day: DAY_NAMES_SHORT[i],
      hours: parts.join(", ") || "—",
      isToday: i === today,
    };
  });
  return result.some((r) => r.hours !== "—") ? result : null;
}
