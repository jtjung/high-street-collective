import { getAuth } from "@/lib/get-auth";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";
import { geocodeAddress } from "@/lib/geocode";

type Body = { companyId: string };

export async function POST(req: Request) {
  const { userId } = await getAuth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId } = (await req.json()) as Body;
  if (!companyId) {
    return NextResponse.json({ error: "Missing companyId" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: company, error } = await supabase
    .from("companies")
    .select("id, address, postal_code, city, country_code")
    .eq("id", companyId)
    .single();

  if (error || !company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const query =
    company.address ||
    [company.postal_code, company.city].filter(Boolean).join(", ");
  if (!query) {
    return NextResponse.json(
      { error: "Company has no address data" },
      { status: 400 }
    );
  }

  const result = await geocodeAddress(query, {
    countryCode: (company.country_code ?? "gb").toLowerCase(),
  });

  if (!result) {
    return NextResponse.json(
      { error: "Geocoding returned no result" },
      { status: 404 }
    );
  }

  const { error: updateError } = await supabase
    .from("companies")
    .update({
      latitude: result.latitude,
      longitude: result.longitude,
      geocoded_at: new Date().toISOString(),
    })
    .eq("id", companyId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    latitude: result.latitude,
    longitude: result.longitude,
  });
}
