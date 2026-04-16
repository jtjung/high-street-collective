/**
 * One-time script to import Outscraper XLSX data into Supabase.
 *
 * Usage:
 *   npx tsx scripts/import-outscraper.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import type { Json } from "../lib/supabase/types";

const OUTSCRAPER_API_KEY = "NGRkMzVmOTE5Njg1NDQ3Zjk1MzJmOWIwZGNlYTczNWR8ODBhNTc1MGMxOA";
const SUPABASE_URL = "https://bddlrsqatgqoznyegpeq.supabase.co";

// Read service role key from .env.local
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

function cleanString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value).trim();
  return str === "None" || str === "none" || str === "null" ? null : str;
}

function parseBool(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  const str = String(value).toLowerCase();
  return str === "true" || str === "1" || str === "yes";
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function parseWorkingHours(value: unknown): Json | null {
  if (!value) return null;
  if (typeof value === "object") return value as Json;
  try {
    return JSON.parse(String(value)) as Json;
  } catch {
    return null;
  }
}

async function main() {
  console.log("Fetching task list from Outscraper...");

  const tasksRes = await fetch("https://api.app.outscraper.com/tasks", {
    headers: { "X-API-KEY": OUTSCRAPER_API_KEY },
  });
  const tasksData = await tasksRes.json();

  const successTasks = tasksData.tasks.filter(
    (t: { status: string }) => t.status === "SUCCESS"
  );
  console.log(`Found ${successTasks.length} successful tasks`);

  for (const task of successTasks) {
    const fileResult = task.results?.find(
      (r: { file_url?: string; product_name: string }) =>
        r.file_url && r.product_name === "Google Maps Data"
    );

    if (!fileResult?.file_url) {
      console.log(`Task ${task.id}: No data file, skipping`);
      continue;
    }

    if (fileResult.quantity === 0) {
      console.log(`Task ${task.id}: 0 records, skipping`);
      continue;
    }

    console.log(
      `\nImporting task ${task.id} (${fileResult.quantity} records)...`
    );

    // Download XLSX
    const xlsxRes = await fetch(fileResult.file_url);
    const buffer = await xlsxRes.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);

    console.log(`  Parsed ${rows.length} rows from XLSX`);

    const companies = rows
      .map((row) => {
        const name = cleanString(row["name"]);
        if (!name) return null;
        const placeId = cleanString(row["place_id"]);
        if (!placeId) return null;

        return {
          name,
          subtypes: row["subtypes"]
            ? String(row["subtypes"])
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean)
            : null,
          category: cleanString(row["category"]),
          phone: cleanString(row["phone"]),
          email: cleanString(row["email"]),
          address: cleanString(row["address"]),
          street: cleanString(row["street"]),
          city: cleanString(row["city"]),
          postal_code: cleanString(row["postal_code"]),
          country_code: cleanString(row["country_code"]) || "GB",
          verified: parseBool(row["verified"]),
          rating: parseNumber(row["rating"]),
          reviews: parseNumber(row["reviews"]) as number | null,
          location_link: cleanString(row["location_link"]),
          website: cleanString(row["website"] ?? row["site"]),
          domain: cleanString(row["domain"]),
          instagram: cleanString(row["company_instagram"]),
          facebook: cleanString(row["company_facebook"]),
          linkedin: cleanString(row["company_linkedin"]),
          x_twitter: cleanString(row["company_x"]),
          youtube: cleanString(row["company_youtube"]),
          working_hours: parseWorkingHours(row["working_hours"]),
          business_status: cleanString(row["business_status"]),
          employee_count: cleanString(row["company_insights.employees"]),
          revenue: cleanString(row["company_insights.revenue"]),
          founded_year: parseNumber(
            row["company_insights.founded_year"]
          ) as number | null,
          industry: cleanString(row["company_insights.industry"]),
          phone_carrier_type: cleanString(
            row["phone.phones_enricher.carrier_type"]
          ),
          is_chain: parseBool(row["chain_info.chain"]),
          outscraper_place_id: placeId,
          outscraper_task_id: task.id,
          status: "uncalled" as const,
        };
      })
      .filter(Boolean);

    console.log(`  ${companies.length} valid companies to import`);

    // Upsert in batches
    let imported = 0;
    let errors = 0;
    const batchSize = 100;

    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, i + batchSize);
      const { error, count } = await supabase
        .from("companies")
        .upsert(batch, {
          onConflict: "outscraper_place_id",
          ignoreDuplicates: false,
          count: "exact",
        });

      if (error) {
        console.error(`  Batch error at offset ${i}:`, error.message);
        errors += batch.length;
      } else {
        imported += count ?? batch.length;
      }

      process.stdout.write(`  Progress: ${Math.min(i + batchSize, companies.length)}/${companies.length}\r`);
    }

    console.log(`  Done: ${imported} imported, ${errors} errors`);

    // Log the sync
    await supabase.from("outscraper_sync_log").insert({
      task_id: task.id,
      status: "completed",
      records_total: companies.length,
      records_imported: imported,
      records_skipped: errors,
      completed_at: new Date().toISOString(),
    });
  }

  // Final count
  const { count } = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true });
  console.log(`\nTotal companies in database: ${count}`);
}

main().catch(console.error);
