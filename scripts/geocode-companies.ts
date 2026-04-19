/**
 * Backfills latitude/longitude for companies using Nominatim (OpenStreetMap).
 * Free, no API key required. Rate limited to 1 req/sec per Nominatim policy.
 *
 * Usage:
 *   npx tsx scripts/geocode-companies.ts           # geocode only rows missing lat/lng
 *   npx tsx scripts/geocode-companies.ts --all     # re-geocode everything
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { geocodeAddress } from "../lib/geocode";

const SUPABASE_URL = "https://bddlrsqatgqoznyegpeq.supabase.co";

const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const serviceRoleKey = envContent
  .split("\n")
  .find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY="))
  ?.split("=")[1]
  ?.trim();

if (!serviceRoleKey) {
  console.error("ERROR: Set SUPABASE_SERVICE_ROLE_KEY in .env.local first");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, serviceRoleKey);
const forceAll = process.argv.includes("--all");

function buildQuery(c: {
  name: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
}): string | null {
  // Addresses from Outscraper already include postal code + city
  // (e.g. "147 Stroud Green Rd, Finsbury Park, London N4 3PZ").
  // Duplicating them confuses Nominatim and returns no match.
  if (c.address) return c.address;
  const parts = [c.postal_code, c.city].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

async function main() {
  console.log("Fetching companies...");

  const companies: {
    id: string;
    name: string | null;
    address: string | null;
    postal_code: string | null;
    city: string | null;
    country_code: string | null;
    latitude: number | null;
  }[] = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    let query = supabase
      .from("companies")
      .select("id, name, address, postal_code, city, country_code, latitude")
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (!forceAll) query = query.is("latitude", null);
    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch companies:", error.message);
      process.exit(1);
    }

    companies.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    offset += pageSize;
  }

  console.log(`Found ${companies.length} companies to geocode`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < companies.length; i++) {
    const c = companies[i];
    const q = buildQuery(c);
    if (!q) {
      skipped++;
      continue;
    }

    try {
      const result = await geocodeAddress(q, {
        countryCode: (c.country_code ?? "gb").toLowerCase(),
        postalCode: c.postal_code,
        city: c.city,
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
          console.error(`  Failed to update ${c.name}:`, updateError.message);
          failed++;
        } else {
          success++;
        }
      }
    } catch (err) {
      console.error(
        `  Error geocoding ${c.name}:`,
        err instanceof Error ? err.message : String(err)
      );
      failed++;
    }

    process.stdout.write(
      `  Progress: ${i + 1}/${companies.length} — ok=${success} fail=${failed} skip=${skipped}\r`
    );

    // Nominatim policy: max 1 request per second
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }

  console.log(
    `\nDone: ${success} geocoded, ${failed} failed, ${skipped} skipped`
  );
}

main().catch(console.error);
