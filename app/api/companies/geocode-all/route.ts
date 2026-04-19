import { getAuth } from "@/lib/get-auth";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";
import { geocodeAddress } from "@/lib/geocode";

export const maxDuration = 300; // seconds — Vercel Pro/Fluid max

function buildQuery(c: {
  address: string | null;
  postal_code: string | null;
  city: string | null;
}): string | null {
  if (c.address) return c.address;
  const parts = [c.postal_code, c.city].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/** GET — returns geocoding stats (total / geocoded / missing). */
export async function GET() {
  const { userId } = await getAuth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { count: total } = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true });
  const { count: geocoded } = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true })
    .not("latitude", "is", null);

  const t = total ?? 0;
  const g = geocoded ?? 0;
  return NextResponse.json({ total: t, geocoded: g, missing: t - g });
}

/**
 * POST — geocodes a batch of records.
 *
 * Body params:
 *   limit    — how many records to process (default 50, 0 = all — use carefully)
 *   offset   — row offset for paging (default 0)
 *   forceAll — if true, re-geocode already-geocoded records too
 *
 * Returns:
 *   { success, failed, skipped, total, nextOffset, done }
 */
export async function POST(req: Request) {
  const { userId } = await getAuth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const forceAll: boolean = body?.forceAll === true;
  const limit: number = typeof body?.limit === "number" ? body.limit : 50;
  const offset: number = typeof body?.offset === "number" ? body.offset : 0;

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("companies")
    .select("id, name, address, postal_code, city, country_code")
    .order("created_at", { ascending: true })
    .range(offset, limit > 0 ? offset + limit - 1 : offset + 999);

  if (!forceAll) query = query.is("latitude", null);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const companies = data ?? [];
  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const c of companies) {
    const q = buildQuery(c);
    if (!q) {
      skipped++;
      continue;
    }

    try {
      const result = await geocodeAddress(q, {
        countryCode: (c.country_code ?? "gb").toLowerCase(),
      });

      if (!result) {
        failed++;
      } else {
        const { error: updateError } = await supabase
          .from("companies")
          .update({
            latitude: result.latitude,
            longitude: result.longitude,
            geocoded_at: new Date().toISOString(),
          })
          .eq("id", c.id);

        if (updateError) {
          failed++;
        } else {
          success++;
        }
      }
    } catch {
      failed++;
    }

    // Nominatim policy: max 1 request per second
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }

  const nextOffset = offset + companies.length;
  const done = limit === 0 || companies.length < limit;

  return NextResponse.json({ success, failed, skipped, total: companies.length, nextOffset, done });
}
