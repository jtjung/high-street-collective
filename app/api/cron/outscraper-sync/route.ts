import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server-client";
import { listTasks, downloadTaskFile, getTask } from "@/lib/outscraper/client";
import { parseOutscraperXlsx } from "@/lib/outscraper/parser";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // Auth via CRON_SECRET
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  try {
    // Get all tasks from Outscraper
    const { tasks } = await listTasks();
    const successfulTasks = tasks.filter((t) => t.status === "SUCCESS");

    // Get already-imported task IDs
    const { data: importedLogs } = await supabase
      .from("outscraper_sync_log")
      .select("task_id")
      .eq("status", "completed");

    const importedTaskIds = new Set(
      importedLogs?.map((l) => l.task_id) ?? []
    );

    // Find new tasks to import
    const newTasks = successfulTasks.filter(
      (t) => !importedTaskIds.has(t.id)
    );

    if (newTasks.length === 0) {
      return NextResponse.json({ message: "No new tasks to import" });
    }

    const results = [];

    for (const task of newTasks) {
      // Create sync log
      const { data: syncLog } = await supabase
        .from("outscraper_sync_log")
        .insert({ task_id: task.id, status: "processing" })
        .select()
        .single();

      try {
        // Get full task details
        const fullTask = await getTask(task.id);
        const dataResult = fullTask.results.find(
          (r) => r.file_url && r.product_name === "Google Maps Data"
        );

        if (!dataResult?.file_url) {
          throw new Error("No data file found");
        }

        const buffer = await downloadTaskFile(dataResult.file_url);
        const companies = parseOutscraperXlsx(buffer, task.id);

        let imported = 0;
        let skipped = 0;
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
            skipped += batch.length;
          } else {
            imported += count ?? batch.length;
          }
        }

        await supabase
          .from("outscraper_sync_log")
          .update({
            status: "completed",
            records_total: companies.length,
            records_imported: imported,
            records_skipped: skipped,
            completed_at: new Date().toISOString(),
          })
          .eq("id", syncLog!.id);

        results.push({
          taskId: task.id,
          imported,
          skipped,
          total: companies.length,
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
          .eq("id", syncLog!.id);

        results.push({ taskId: task.id, error: message });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
