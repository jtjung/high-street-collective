import type { ColumnFiltersState } from "@tanstack/react-table";
import type { Company } from "@/lib/use-companies";
import { outcomeLabel, painPointLabel, userGoalLabel } from "@/lib/outcomes";
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

function matchesOutcomes(outs: string[], filter: string): boolean {
  if (filter === "__uncalled__") return outs.length === 0;
  if (filter === "__any__") return outs.length > 0;
  const needle = String(filter).toLowerCase();
  return outs.some((o) => outcomeLabel(o).toLowerCase().includes(needle));
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
      const v = String(f.value ?? "");
      switch (f.id) {
        case "website":
          if (!matchesPresence(c.website, v)) return false;
          break;
        case "email":
          if (!matchesPresence(c.email, v)) return false;
          break;
        case "outcomes":
          if (!matchesOutcomes(c.outcomes ?? [], v)) return false;
          break;
        case "subtypes": {
          const subs = c.subtypes ?? [];
          if (!subs.some((s) => s.toLowerCase().includes(v.toLowerCase())))
            return false;
          break;
        }
        case "area":
          if ((c.area ?? "").toLowerCase() !== v.toLowerCase()) return false;
          break;
        case "neighborhood":
          if ((c.neighborhood ?? "").toLowerCase() !== v.toLowerCase())
            return false;
          break;
        case "postal_code": {
          const pc = (c.postal_code ?? "").toUpperCase();
          if (!pc.startsWith(v.toUpperCase())) return false;
          break;
        }
        case "phone":
          if (!matchesPresence(c.phone, v)) return false;
          break;
        case "verified":
          if (v === "true" && !c.verified) return false;
          if (v === "false" && c.verified) return false;
          break;
        case "call_count": {
          const count = (c.call_count as number) ?? 0;
          if (v === "__any__" && count === 0) return false;
          if (v === "__zero__" && count > 0) return false;
          break;
        }
        case "rating":
          if (!matchesPresence(c.rating, v)) return false;
          break;
        case "reviews":
          if (!matchesPresence(c.reviews, v)) return false;
          break;
        case "last_reached_out":
          if (!matchesPresence(c.last_reached_out, v)) return false;
          break;
        case "callback_at":
          if (!matchesPresence(c.callback_at, v)) return false;
          break;
        case "name":
          if (!matchesPresence(c.name, v)) return false;
          break;
        case "address":
          if (!matchesPresence(c.address, v)) return false;
          break;
        case "manager_name":
          if (!matchesPresence(c.manager_name, v)) return false;
          break;
        case "owner_name":
          if (!matchesPresence(c.owner_name, v)) return false;
          break;
        case "pain_points": {
          const pts = (c.pain_points as string[]) ?? [];
          if (!pts.some((p) => painPointLabel(p).toLowerCase().includes(v.toLowerCase()))) return false;
          break;
        }
        case "latest_note_content":
          if (!matchesPresence(c.latest_note_content, v)) return false;
          break;
        case "user_goals": {
          const goals = (c.user_goals as string[]) ?? [];
          if (!goals.some((g) => userGoalLabel(g).toLowerCase().includes(v.toLowerCase()))) return false;
          break;
        }
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
