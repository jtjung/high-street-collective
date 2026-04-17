import { getAuth } from "@/lib/get-auth";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";
import { getTask, downloadTaskFile } from "@/lib/outscraper/client";
import { parseOutscraperXlsx } from "@/lib/outscraper/parser";
import { lookupAreas } from "@/lib/postcodes";

export const maxDuration = 300;

export async function POST(request: Request) {
  const { userId } = await getAuth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await request.json();
  if (!taskId) {
    return NextResponse.json(
      { error: "taskId is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  // Create sync log entry
  const { data: syncLog, error: logError } = await supabase
    .from("outscraper_sync_log")
    .insert({ task_id: taskId, status: "processing" })
    .select()
    .single();

  if (logError) {
    return NextResponse.json(
      { error: "Failed to create sync log" },
      { status: 500 }
    );
  }

  try {
    // Fetch task details from Outscraper
    const task = await getTask(taskId);
    if (task.status !== "SUCCESS") {
      throw new Error(`Task is not completed: ${task.status}`);
    }

    // Find the Google Maps Data result with file_url
    const dataResult = task.results.find(
      (r) => r.file_url && r.product_name === "Google Maps Data"
    );
    if (!dataResult?.file_url) {
      throw new Error("No data file found in task results");
    }

    // Download and parse XLSX
    const buffer = await downloadTaskFile(dataResult.file_url);
    const companies = parseOutscraperXlsx(buffer, taskId);

    // Enrich with area + neighborhood via postcodes.io
    const postcodes = companies
      .map((c) => c.postal_code)
      .filter((p): p is string => !!p);
    const areaMap = await lookupAreas(postcodes);
    for (const company of companies) {
      const result = company.postal_code
        ? areaMap.get(company.postal_code.toUpperCase())
        : undefined;
      if (result) {
        company.area = result.area;
        company.neighborhood = result.neighborhood;
      }
    }

    // Deduplicate by outscraper_place_id — duplicates within a batch cause
    // "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const seen = new Set<string>();
    const deduped = companies.filter((c) => {
      if (!c.outscraper_place_id) return true;
      if (seen.has(c.outscraper_place_id)) return false;
      seen.add(c.outscraper_place_id);
      return true;
    });

    let imported = 0;
    let skipped = 0;

    // Upsert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < deduped.length; i += batchSize) {
      const batch = deduped.slice(i, i + batchSize);

      const { error: upsertError, count } = await supabase
        .from("companies")
        .upsert(batch, {
          onConflict: "outscraper_place_id",
          ignoreDuplicates: false,
          count: "exact",
        });

      if (upsertError) {
        console.error("Upsert batch error:", upsertError);
        skipped += batch.length;
      } else {
        imported += count ?? batch.length;
      }
    }

    // Update sync log
    await supabase
      .from("outscraper_sync_log")
      .update({
        status: "completed",
        records_total: deduped.length,
        records_imported: imported,
        records_skipped: skipped,
        completed_at: new Date().toISOString(),
      })
      .eq("id", syncLog.id);

    return NextResponse.json({
      success: true,
      total: companies.length,
      imported,
      skipped,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

    await supabase
      .from("outscraper_sync_log")
      .update({
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", syncLog.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
