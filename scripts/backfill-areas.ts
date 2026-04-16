/**
 * Backfills the `area` column for companies that have a postal_code but no area.
 * Uses postcodes.io bulk lookup (free, no API key required, max 100 per request).
 *
 * Usage:
 *   npx tsx scripts/backfill-areas.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

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

interface PostcodeResult {
  area: string | null;
  neighborhood: string | null;
}

async function lookupAreas(postcodes: string[]): Promise<Map<string, PostcodeResult>> {
  const res = await fetch("https://api.postcodes.io/postcodes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postcodes }),
  });

  if (!res.ok) throw new Error(`postcodes.io error: ${res.status}`);

  const data = await res.json();
  const map = new Map<string, PostcodeResult>();

  for (const item of data.result ?? []) {
    if (!item?.result) continue;
    map.set(item.query.toUpperCase(), {
      area: item.result.admin_district ?? item.result.admin_county ?? null,
      neighborhood: item.result.admin_ward ?? null,
    });
  }

  return map;
}

async function main() {
  console.log("Fetching companies with postal_code but no area...");

  const companies: { id: string; postal_code: string }[] = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("companies")
      .select("id, postal_code")
      .not("postal_code", "is", null)
      .is("neighborhood", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("Failed to fetch companies:", error.message);
      process.exit(1);
    }

    companies.push(...(data as { id: string; postal_code: string }[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  console.log(`Found ${companies.length} companies to backfill`);

  let updated = 0;
  let failed = 0;
  const batchSize = 100;

  for (let i = 0; i < companies.length; i += batchSize) {
    const batch = companies.slice(i, i + batchSize);
    const postcodes = batch
      .map((c) => c.postal_code!)
      .filter((p) => p.trim().length > 0);

    let areaMap = new Map<string, PostcodeResult>();
    try {
      areaMap = await lookupAreas(postcodes);
    } catch (err) {
      console.error(`  Lookup failed for batch at offset ${i}:`, err);
      failed += batch.length;
      continue;
    }

    for (const company of batch) {
      const result = areaMap.get(company.postal_code!.toUpperCase());
      if (!result) continue;

      const { error: updateError } = await supabase
        .from("companies")
        .update({ area: result.area, neighborhood: result.neighborhood })
        .eq("id", company.id);

      if (updateError) {
        console.error(`  Failed to update ${company.id}:`, updateError.message);
        failed++;
      } else {
        updated++;
      }
    }

    process.stdout.write(
      `  Progress: ${Math.min(i + batchSize, companies.length)}/${companies.length} (${updated} updated)\r`
    );

    // Respect postcodes.io rate limit (1 req/sec is safe)
    if (i + batchSize < companies.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`\nDone: ${updated} updated, ${failed} failed`);
}

main().catch(console.error);
