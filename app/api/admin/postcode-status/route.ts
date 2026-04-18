import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";
import { listTasks, type OutscraperTask } from "@/lib/outscraper/client";
import {
  LONDON_POSTCODE_DISTRICTS,
  mentionsDistrict,
  outwardCode,
} from "@/lib/london-postcodes";

// Live admin endpoint — hits Outscraper every request so we always
// surface the freshest scrape status. Cache-Control disabled.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface DistrictStatus {
  district: string;
  area: string;
  name: string;
  companiesCount: number;
  taskCount: number;
  lastTaskDate: string | null;
  lastTaskId: string | null;
  lastSyncDate: string | null;
  lastSyncStatus: string | null;
  recordsImported: number | null;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    const status = admin.reason === "unauthorized" ? 401 : 403;
    return NextResponse.json({ error: admin.reason }, { status });
  }

  const supabase = getSupabaseAdmin();

  // --- Companies count per outward code (single trip) ---
  const { data: postcodes, error: pcError } = await supabase
    .from("companies")
    .select("postal_code")
    .not("postal_code", "is", null);
  if (pcError) {
    return NextResponse.json({ error: pcError.message }, { status: 500 });
  }
  const companiesByDistrict = new Map<string, number>();
  for (const { postal_code } of postcodes ?? []) {
    const d = outwardCode(postal_code);
    if (!d) continue;
    companiesByDistrict.set(d, (companiesByDistrict.get(d) ?? 0) + 1);
  }

  // --- Outscraper tasks (live API) ---
  let tasks: OutscraperTask[] = [];
  let outscraperError: string | null = null;
  try {
    const { tasks: all } = await listTasks();
    tasks = all.filter((t) => t.status === "SUCCESS");
  } catch (err) {
    outscraperError = err instanceof Error ? err.message : "Outscraper failed";
  }

  // Build a haystack per task from the fields most likely to carry the
  // district hint (tags, locations, queries), so we can match once per
  // (task, district) pair.
  type TaskMeta = {
    id: string;
    created: string;
    updated: string;
    haystack: string;
    recordCount: number;
  };
  const taskMetas: TaskMeta[] = tasks.map((t) => {
    const parts: string[] = [];
    if (t.metadata.tags) parts.push(String(t.metadata.tags));
    if (Array.isArray(t.metadata.locations))
      parts.push(t.metadata.locations.join(" | "));
    if (Array.isArray(t.metadata.categories))
      parts.push(t.metadata.categories.join(" | "));
    // Also include any other string values from metadata — catches
    // "queries", "query", custom free-form fields etc.
    for (const [k, v] of Object.entries(t.metadata)) {
      if (k === "tags" || k === "locations" || k === "categories") continue;
      if (typeof v === "string") parts.push(v);
      else if (Array.isArray(v))
        parts.push(v.filter((x) => typeof x === "string").join(" | "));
    }
    const gm = t.results.find((r) => r.product_name === "Google Maps Data");
    return {
      id: t.id,
      created: t.created,
      updated: t.updated,
      haystack: parts.join(" | "),
      recordCount: gm?.quantity ?? 0,
    };
  });

  // --- Sync log: latest by task ---
  const { data: syncRows, error: syncError } = await supabase
    .from("outscraper_sync_log")
    .select(
      "task_id, status, completed_at, started_at, records_imported"
    )
    .order("started_at", { ascending: false });
  if (syncError) {
    return NextResponse.json({ error: syncError.message }, { status: 500 });
  }
  // Map: task_id -> latest sync row (syncRows is already ordered desc)
  const syncByTask = new Map<string, (typeof syncRows)[number]>();
  for (const row of syncRows ?? []) {
    if (!syncByTask.has(row.task_id)) syncByTask.set(row.task_id, row);
  }

  // --- Build response rows ---
  // Sort districts — longer codes first so "N1C" is checked before "N1"
  // to prefer the more specific match. We iterate tasks once per
  // district, which is O(districts × tasks) — fine at <200 × <200.
  const sortedDistrictDefs = [...LONDON_POSTCODE_DISTRICTS].sort(
    (a, b) => b.district.length - a.district.length
  );

  const rows: DistrictStatus[] = sortedDistrictDefs.map((def) => {
    const matching = taskMetas.filter((t) =>
      mentionsDistrict(t.haystack, def.district)
    );
    // Sort matches newest first
    matching.sort(
      (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
    );
    const latest = matching[0] ?? null;
    const latestSync = latest ? syncByTask.get(latest.id) ?? null : null;
    return {
      district: def.district,
      area: def.area,
      name: def.name,
      companiesCount: companiesByDistrict.get(def.district) ?? 0,
      taskCount: matching.length,
      lastTaskDate: latest?.created ?? null,
      lastTaskId: latest?.id ?? null,
      lastSyncDate: latestSync?.completed_at ?? latestSync?.started_at ?? null,
      lastSyncStatus: latestSync?.status ?? null,
      recordsImported: latestSync?.records_imported ?? null,
    };
  });

  // Sort output by area, then district natural order
  rows.sort((a, b) => {
    if (a.area !== b.area) return a.area.localeCompare(b.area);
    return a.district.localeCompare(b.district, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  // Orphan coverage: how many companies have postcodes whose outward
  // code isn't in our London list? Useful sanity-check in the UI.
  const knownDistricts = new Set(
    LONDON_POSTCODE_DISTRICTS.map((d) => d.district)
  );
  let otherCompanies = 0;
  for (const [district, count] of companiesByDistrict) {
    if (!knownDistricts.has(district)) otherCompanies += count;
  }

  return NextResponse.json({
    rows,
    totals: {
      districts: rows.length,
      districtsWithTasks: rows.filter((r) => r.taskCount > 0).length,
      districtsWithCompanies: rows.filter((r) => r.companiesCount > 0).length,
      companiesInLondonDistricts: rows.reduce(
        (acc, r) => acc + r.companiesCount,
        0
      ),
      otherCompanies,
      totalTasks: taskMetas.length,
    },
    outscraperError,
    fetchedAt: new Date().toISOString(),
  });
}
