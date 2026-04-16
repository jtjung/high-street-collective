"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface OutscraperTask {
  id: string;
  status: string;
  created: string;
  metadata: {
    tags?: string;
    categories?: string[];
  };
  results: {
    product_name: string;
    quantity: number;
    file_url?: string;
  }[];
}

interface SyncButtonProps {
  onSyncComplete: () => void;
}

export function SyncButton({ onSyncComplete }: SyncButtonProps) {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<OutscraperTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/outscraper/tasks");
      const data = await res.json();
      setTasks(
        (data.tasks || []).filter(
          (t: OutscraperTask) => t.status === "SUCCESS"
        )
      );
    } catch {
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  const syncTask = async (taskId: string) => {
    setSyncing(taskId);
    try {
      const res = await fetch("/api/outscraper/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          `Imported ${data.imported} companies (${data.skipped} skipped)`
        );
        onSyncComplete();
      } else {
        toast.error(data.error || "Sync failed");
      }
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(null);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) loadTasks();
      }}
    >
      <PopoverTrigger className="inline-flex items-center justify-center gap-1 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
        <RefreshCw className="h-4 w-4" />
        Sync Data
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Outscraper Tasks</h4>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading tasks...
            </div>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-gray-500">No completed tasks found</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {tasks.map((task) => {
                const gmData = task.results.find(
                  (r) => r.product_name === "Google Maps Data"
                );
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded border p-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {task.metadata.tags || "Untitled"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {gmData?.quantity ?? 0} records &middot;{" "}
                        {new Date(task.created).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={syncing !== null}
                      onClick={() => syncTask(task.id)}
                    >
                      {syncing === task.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
