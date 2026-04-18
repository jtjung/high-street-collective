import { getAuth } from "@/lib/get-auth";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";
import { geocodeAddress } from "@/lib/geocode";

function buildQuery(c: {
  address: string | null;
  postal_code: string | null;
  city: string | null;
}): string | null {
  if (c.address) return c.address;
  const parts = [c.postal_code, c.city].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export async function POST(req: Request) {
  const { userId } = await getAuth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const forceAll = body?.forceAll === true;

  const supabase = getSupabaseAdmin();

  const companies: {
    id: string;
    name: string | null;
    address: string | null;
    postal_code: string | null;
    city: string | null;
    country_code: string | null;
  }[] = [];

  const pageSize = 1000;
  let offset = 0;
  while (true) {
    let query = supabase
      .from("companies")
      .select("id, name, address, postal_code, city, country_code")
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (!forceAll) query = query.is("latitude", null);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    companies.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    offset += pageSize;
  }

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

  return NextResponse.json({ success, failed, skipped, total: companies.length });
}
