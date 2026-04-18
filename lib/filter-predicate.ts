import type { ColumnFiltersState } from "@tanstack/react-table";
import type { Company } from "@/lib/use-companies";
import { outcomeLabel } from "@/lib/outcomes";
import { isOpenAt } from "@/lib/hours";

function matchesSearch(c: Company, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [c.name, c.phone, c.email, c.address, c.postal_code, c.website]
    .filter(Boolean)
    .some((s) => String(s).toLowerCase().includes(needle));
}

function matchesPresence(v: unknown, filter: string): boolean {
  if (filter === "__empty__") return !v;
  if (filter === "__nonempty__") return !!v;
  if (typeof v === "string")
    return v.toLowerCase().includes(filter.toLowerCase());
  return false;
}

/** Coerce a filter value to a non-empty string array, or null (= no filter). */
function toStringArray(raw: unknown): string[] | null {
  if (Array.isArray(raw)) {
    const arr = raw.filter((x) => typeof x === "string" && x !== "") as string[];
    return arr.length ? arr : null;
  }
  if (typeof raw === "string" && raw !== "" && raw !== "__all__") return [raw];
  return null;
}

function matchesOutcomes(outs: string[], raw: unknown): boolean {
  const values = toStringArray(raw);
  if (!values) return true;
  if (values.includes("__uncalled__")) return outs.length === 0;
  if (values.includes("__any__")) return outs.length > 0;
  return values.some((v) =>
    outs.some((o) => outcomeLabel(o).toLowerCase().includes(v.toLowerCase()))
  );
}

const NUMERIC_OP_RE = /^([<>=])(-?\d+(?:\.\d+)?)$/;

/** Apply a numeric comparison filter like "<5", ">10", "=3". */
function matchesNumericOp(
  v: number | null | undefined,
  filter: string
): boolean {
  const m = filter.match(NUMERIC_OP_RE);
  if (!m) return true; // unrecognized → don't filter
  const n = Number(m[2]);
  if (!Number.isFinite(n)) return true;
  const value = (v as number) ?? 0;
  if (m[1] === "<") return value < n;
  if (m[1] === ">") return value > n;
  return value === n;
}

function outwardCode(pc: string | null | undefined): string | null {
  if (!pc) return null;
  const trimmed = pc.trim().toUpperCase();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0] ?? null;
}

/**
 * Shared filter predicate — the single source of truth for what rows a given
 * `columnFilters` + `globalFilter` combination selects. Used by both the
 * companies table and the map view so the two can never drift.
 *
 * The optional `openAt` parameter overrides the `open_at` column filter and
 * is not persisted to localStorage (see DashboardClient).
 */
export function applyFilters(
  companies: Company[],
  columnFilters: ColumnFiltersState,
  globalFilter: string,
  openAt?: { day: number; minutes: number } | null
): Company[] {
  if (!companies.length) return companies;
  return companies.filter((c) => {
    if (!matchesSearch(c, globalFilter)) return false;

    for (const f of columnFilters) {
      const raw = f.value;
      const v = String(raw ?? "");
      switch (f.id) {
        case "website":
          if (!matchesPresence(c.website, v)) return false;
          break;
        case "email":
          if (!matchesPresence(c.email, v)) return false;
          break;
        case "outcomes":
          if (!matchesOutcomes(c.outcomes ?? [], raw)) return false;
          break;
        case "subtypes": {
          const values = toStringArray(raw);
          if (values) {
            const subs = c.subtypes ?? [];
            if (
              !values.some((val) => {
                const needle = val.toLowerCase();
                return subs.some(
                  (s) =>
                    s.toLowerCase() === needle ||
                    s.toLowerCase().includes(needle)
                );
              })
            )
              return false;
          }
          break;
        }
        case "area": {
          const values = toStringArray(raw);
          if (values) {
            const area = (c.area ?? "").toLowerCase();
            if (!values.some((val) => area === val.toLowerCase()))
              return false;
          }
          break;
        }
        case "neighborhood": {
          const values = toStringArray(raw);
          if (values) {
            const n = (c.neighborhood ?? "").toLowerCase();
            if (!values.some((val) => n === val.toLowerCase()))
              return false;
          }
          break;
        }
        case "postal_code": {
          const values = toStringArray(raw);
          if (values) {
            const pc = (c.postal_code ?? "").toUpperCase();
            const outward = outwardCode(pc);
            if (
              !values.some(
                (val) =>
                  outward === val.toUpperCase() ||
                  pc.startsWith(val.toUpperCase())
              )
            )
              return false;
          }
          break;
        }
        case "phone":
          if (!matchesPresence(c.phone, v)) return false;
          break;
        case "verified":
          if (v === "true" && !c.verified) return false;
          if (v === "false" && c.verified) return false;
          break;
        case "rating":
          if (!matchesNumericOp(c.rating as number | null, v)) return false;
          break;
        case "reviews":
          if (!matchesNumericOp(c.reviews as number | null, v)) return false;
          break;
        case "name":
          if (!matchesPresence(c.name, v)) return false;
          break;
        case "address":
          if (!matchesPresence(c.address, v)) return false;
          break;
        case "contact_name":
          if (!matchesPresence(c.contact?.name, v)) return false;
          break;
        case "latest_note_content":
          if (!matchesPresence(c.latest_note_content, v)) return false;
          break;
        default:
          break;
      }
    }

    // Open-at filter (not persisted — passed separately to avoid stale day-of-week)
    if (openAt) {
      if (!isOpenAt(c.working_hours, openAt.day, openAt.minutes)) return false;
    }

    return true;
  });
}
