import type { ColumnFiltersState } from "@tanstack/react-table";
import type { Company } from "@/lib/use-companies";
import { outcomeLabel } from "@/lib/outcomes";

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
 */
export function applyFilters(
  companies: Company[],
  columnFilters: ColumnFiltersState,
  globalFilter: string
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
        default:
          break;
      }
    }
    return true;
  });
}
