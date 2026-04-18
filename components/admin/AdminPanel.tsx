"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { toast } from "sonner";
import { UserButton } from "@clerk/nextjs";
import {
  RefreshCw,
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { NavTabs } from "@/components/NavTabs";
import { Input } from "@/components/ui/input";

interface DistrictStatus {
  district: string;
  area: string;
  name: string;
  companiesCount: number;
  taskCount: number;
  lastTaskDate: string | null;
  lastTaskId: string | null;
  lastSyncDate: string | null;
  lastSyncStatus: string | null;
  recordsImported: number | null;
}

interface PostcodeStatusResponse {
  rows: DistrictStatus[];
  totals: {
    districts: number;
    districtsWithTasks: number;
    districtsWithCompanies: number;
    companiesInLondonDistricts: number;
    otherCompanies: number;
    totalTasks: number;
  };
  outscraperError: string | null;
  fetchedAt: string;
}

type Filter = "all" | "scraped" | "not_scraped" | "no_companies";

export function AdminPanel({ adminEmail }: { adminEmail: string }) {
  const [data, setData] = useState<PostcodeStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const fetchStatus = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/postcode-status", {
        cache: "no-store",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as PostcodeStatusResponse;
      setData(json);
      if (json.outscraperError) {
        toast.error(`Outscraper: ${json.outscraperError}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const rows = useMemo(() => data?.rows ?? [], [data]);

  const areas = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.area));
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (areaFilter !== "all" && r.area !== areaFilter) return false;
      if (filter === "scraped" && r.taskCount === 0) return false;
      if (filter === "not_scraped" && r.taskCount > 0) return false;
      if (filter === "no_companies" && r.companiesCount > 0) return false;
      if (!q) return true;
      return (
        r.district.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q)
      );
    });
  }, [rows, filter, areaFilter, search]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-3 sm:px-4 pt-2.5 sm:pt-3 pb-0">
        <div className="flex items-center justify-between gap-2 pb-2.5 sm:pb-3">
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-semibold tracking-tight truncate">
              Admin
            </h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
              {adminEmail}
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={fetchStatus}
              disabled={refreshing}
              className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-medium border rounded-md hover:bg-accent transition-colors disabled:opacity-60"
              title="Refresh (live Outscraper API)"
            >
              {refreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {refreshing ? "Refreshing…" : "Refresh"}
              </span>
            </button>
            <UserButton />
          </div>
        </div>
        <NavTabs />
      </header>

      <div className="p-3 sm:p-4 space-y-4">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            London postcode scrape status
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            Pulled live from the Outscraper API on each refresh. Matches
            tasks to districts by scanning <code>metadata.tags</code>,{" "}
            <code>metadata.locations</code>, and other string fields for
            the district code as a whole token.
          </p>

          {loading ? (
            <div className="text-sm text-muted-foreground py-12 text-center">
              Loading status…
            </div>
          ) : data ? (
            <>
              {/* Totals */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mb-4 text-xs">
                <StatCard
                  label="Districts"
                  value={data.totals.districts.toString()}
                />
                <StatCard
                  label="Scraped"
                  value={`${data.totals.districtsWithTasks} / ${data.totals.districts}`}
                  hint={`${Math.round(
                    (data.totals.districtsWithTasks /
                      Math.max(data.totals.districts, 1)) *
                      100
                  )}%`}
                />
                <StatCard
                  label="With companies"
                  value={`${data.totals.districtsWithCompanies} / ${data.totals.districts}`}
                />
                <StatCard
                  label="Companies (LDN)"
                  value={data.totals.companiesInLondonDistricts.toLocaleString()}
                />
                <StatCard
                  label="Companies (other)"
                  value={data.totals.otherCompanies.toLocaleString()}
                />
                <StatCard
                  label="Outscraper tasks"
                  value={data.totals.totalTasks.toString()}
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <div className="inline-flex items-center border rounded-md p-0.5 text-xs">
                  {(
                    [
                      { v: "all", label: "All" },
                      { v: "scraped", label: "Scraped" },
                      { v: "not_scraped", label: "Not scraped" },
                      { v: "no_companies", label: "No companies" },
                    ] as { v: Filter; label: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.v}
                      onClick={() => setFilter(opt.v)}
                      className={`px-2 py-1 rounded ${
                        filter === opt.v
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="inline-flex items-center border rounded-md p-0.5 text-xs flex-wrap">
                  <button
                    onClick={() => setAreaFilter("all")}
                    className={`px-2 py-1 rounded ${
                      areaFilter === "all"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All areas
                  </button>
                  {areas.map((a) => (
                    <button
                      key={a}
                      onClick={() => setAreaFilter(a)}
                      className={`px-2 py-1 rounded ${
                        areaFilter === a
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
                <Input
                  type="text"
                  placeholder="Filter district…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 w-44 text-xs"
                />
                <span className="text-xs text-muted-foreground ml-auto">
                  {filteredRows.length} shown
                </span>
              </div>

              {/* Table */}
              <div className="border rounded-lg overflow-hidden bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium w-8"></th>
                        <th className="text-left px-3 py-2 font-medium">
                          District
                        </th>
                        <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">
                          Locality
                        </th>
                        <th className="text-right px-3 py-2 font-medium">
                          Companies
                        </th>
                        <th className="text-right px-3 py-2 font-medium">
                          Tasks
                        </th>
                        <th className="text-left px-3 py-2 font-medium hidden md:table-cell">
                          Last task
                        </th>
                        <th className="text-left px-3 py-2 font-medium hidden lg:table-cell">
                          Last sync
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="text-center text-muted-foreground py-6"
                          >
                            No districts match the current filter.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((r) => (
                          <tr
                            key={r.district}
                            className="border-t hover:bg-muted/30"
                          >
                            <td className="px-3 py-2">
                              {r.taskCount > 0 ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                              ) : r.companiesCount > 0 ? (
                                <AlertCircle
                                  className="h-3.5 w-3.5 text-amber-500"
                                  aria-label="Has companies but no matched task"
                                />
                              ) : (
                                <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono font-medium">
                              {r.district}
                              <span className="ml-1.5 text-[10px] text-muted-foreground font-sans">
                                {r.area}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                              {r.name}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {r.companiesCount > 0 ? (
                                r.companiesCount.toLocaleString()
                              ) : (
                                <span className="text-muted-foreground">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {r.taskCount > 0 ? (
                                r.taskCount
                              ) : (
                                <span className="text-muted-foreground">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 hidden md:table-cell text-xs">
                              {r.lastTaskDate ? (
                                <span title={new Date(r.lastTaskDate).toLocaleString()}>
                                  {formatDistanceToNow(
                                    parseISO(r.lastTaskDate),
                                    { addSuffix: true }
                                  )}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 hidden lg:table-cell text-xs">
                              {r.lastSyncDate ? (
                                <div className="flex items-center gap-1">
                                  <span
                                    className={
                                      r.lastSyncStatus === "completed"
                                        ? "text-green-600"
                                        : r.lastSyncStatus === "failed"
                                          ? "text-destructive"
                                          : "text-amber-600"
                                    }
                                  >
                                    {r.lastSyncStatus ?? "—"}
                                  </span>
                                  <span
                                    className="text-muted-foreground"
                                    title={new Date(r.lastSyncDate).toLocaleString()}
                                  >
                                    ·{" "}
                                    {formatDistanceToNow(
                                      parseISO(r.lastSyncDate),
                                      { addSuffix: true }
                                    )}
                                  </span>
                                  {r.recordsImported != null && (
                                    <span className="text-muted-foreground">
                                      · {r.recordsImported} imported
                                    </span>
                                  )}
                                </div>
                              ) : r.lastTaskId ? (
                                <span className="text-amber-600">
                                  task not yet synced
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground mt-2">
                Fetched{" "}
                {formatDistanceToNow(parseISO(data.fetchedAt), {
                  addSuffix: true,
                })}
                {" · "}
                <a
                  href="https://app.outscraper.com/tasks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary hover:underline"
                >
                  Outscraper dashboard
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border rounded-md p-2.5 bg-card">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-0.5 font-semibold text-sm">
        {value}
        {hint && (
          <span className="ml-1 text-[11px] font-normal text-muted-foreground">
            ({hint})
          </span>
        )}
      </div>
    </div>
  );
}
