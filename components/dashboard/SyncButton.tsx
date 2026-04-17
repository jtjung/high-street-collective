"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RefreshCw, Loader2, Pencil, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface OutscraperTask {
  id: string;
  status: string;
  created: string;
  updated: string;
  metadata: {
    tags?: string;
    categories?: string[];
    locations?: string[];
    language?: string;
    organizations_per_query?: number;
    limit?: number;
    drop_duplicates?: boolean;
    enrichments?: string[];
    [key: string]: unknown;
  };
  results: {
    product_name: string;
    quantity: number;
    file_url?: string;
  }[];
}

const NICKNAMES_KEY = "outscraper:nicknames";

function loadNicknames(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NICKNAMES_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveNicknames(map: Record<string, string>) {
  localStorage.setItem(NICKNAMES_KEY, JSON.stringify(map));
}

interface SyncButtonProps {
  onSyncComplete: () => void;
}

function MetadataRow({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null || value === "") return null;
  const display = Array.isArray(value) ? value.join(", ") : String(value);
  return (
    <div className="flex gap-1.5 text-xs">
      <span className="text-muted-foreground shrink-0 capitalize">{label.replace(/_/g, " ")}:</span>
      <span className="font-medium break-all">{display}</span>
    </div>
  );
}

function TaskCard({
  task,
  nickname,
  onNicknameChange,
  syncing,
  onSync,
}: {
  task: OutscraperTask;
  nickname: string;
  onNicknameChange: (id: string, name: string) => void;
  syncing: string | null;
  onSync: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nickname);
  const [open, setOpen] = useState(false);

  const gmData = task.results.find((r) => r.product_name === "Google Maps Data");

  const commitNickname = () => {
    onNicknameChange(task.id, draft.trim());
    setEditing(false);
  };

  // Known metadata keys we show explicitly; everything else falls through to "other"
  const KNOWN_KEYS = ["tags", "categories", "locations", "language", "organizations_per_query", "limit", "drop_duplicates", "enrichments"];
  const otherEntries = Object.entries(task.metadata).filter(
    ([k]) => !KNOWN_KEYS.includes(k) && k !== "tags"
  );

  const displayName = nickname || task.metadata.tags || task.id.slice(0, 8);

  return (
    <div className="rounded border text-sm">
      {/* Header row */}
      <div className="flex items-start gap-2 p-2">
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-1">
              <Input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitNickname();
                  if (e.key === "Escape") setEditing(false);
                }}
                className="h-6 text-xs px-1.5 py-0"
              />
              <button onClick={commitNickname} className="text-primary hover:opacity-70">
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 group">
              <p className="font-medium truncate">{displayName}</p>
              <button
                onClick={() => { setDraft(nickname); setEditing(true); }}
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                title="Edit nickname"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            {gmData?.quantity ?? 0} records &middot;{" "}
            {new Date(task.created).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setOpen(!open)}
            className="text-muted-foreground hover:text-foreground"
            title="Show metadata"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          <Button
            size="sm"
            variant="ghost"
            disabled={syncing !== null}
            onClick={() => onSync(task.id)}
            className="h-7 w-7 p-0"
          >
            {syncing === task.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Expandable metadata */}
      {open && (
        <div className="border-t px-2 py-2 space-y-1 bg-muted/30">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Task metadata
          </p>
          <MetadataRow label="Task ID" value={task.id} />
          <MetadataRow label="Status" value={task.status} />
          <MetadataRow label="Created" value={new Date(task.created).toLocaleString()} />
          <MetadataRow label="Updated" value={new Date(task.updated).toLocaleString()} />
          <MetadataRow label="Tags" value={task.metadata.tags} />
          <MetadataRow label="Categories" value={task.metadata.categories} />
          <MetadataRow label="Locations" value={task.metadata.locations} />
          <MetadataRow label="Language" value={task.metadata.language} />
          <MetadataRow label="Orgs per query" value={task.metadata.organizations_per_query} />
          <MetadataRow label="Limit" value={task.metadata.limit} />
          <MetadataRow label="Drop duplicates" value={task.metadata.drop_duplicates} />
          <MetadataRow label="Enrichments" value={task.metadata.enrichments} />
          {otherEntries.map(([k, v]) => (
            <MetadataRow key={k} label={k} value={v} />
          ))}
          {task.results.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-2 mb-1.5">
                Results
              </p>
              {task.results.map((r, i) => (
                <div key={i} className="flex gap-1.5 text-xs">
                  <span className="text-muted-foreground shrink-0">{r.product_name}:</span>
                  <span className="font-medium">{r.quantity} records</span>
                  {r.file_url && (
                    <span className="text-muted-foreground">(has file)</span>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function SyncButton({ onSyncComplete }: SyncButtonProps) {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<OutscraperTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});

  useEffect(() => {
    setNicknames(loadNicknames());
  }, []);

  const handleNicknameChange = (taskId: string, name: string) => {
    const updated = { ...nicknames, [taskId]: name };
    setNicknames(updated);
    saveNicknames(updated);
  };

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
      <PopoverContent className="w-[420px]" align="end">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Outscraper Tasks</h4>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading tasks...
            </div>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completed tasks found</p>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-0.5">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  nickname={nicknames[task.id] ?? ""}
                  onNicknameChange={handleNicknameChange}
                  syncing={syncing}
                  onSync={syncTask}
                />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
