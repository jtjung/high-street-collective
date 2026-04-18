"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { UserButton } from "@clerk/nextjs";
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import { CompaniesTable } from "./CompaniesTable";
import { CompanyPanel } from "./CompanyPanel";
import { SyncButton } from "./SyncButton";
import { RoutePanel } from "./RoutePanel";
import { QuickFilters } from "./QuickFilters";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search, X, LayoutGrid, Map as MapIcon, Clock, MapPin, Loader2 } from "lucide-react";
import { useCompanies, type Company } from "@/lib/use-companies";
import { NavTabs } from "@/components/NavTabs";
import { applyFilters } from "@/lib/filter-predicate";
import { isOpenAt } from "@/lib/hours";
import { toast } from "sonner";

const MapView = dynamic(
  () => import("./MapView").then((m) => m.MapView),
  { ssr: false, loading: () => <div className="h-[70vh] rounded-lg border bg-muted animate-pulse" /> }
);

const FILTERS_KEY = "hsc:columnFilters:v2";
const SORTING_KEY = "hsc:sorting:v2";
const VIEW_MODE_KEY = "hsc:viewMode:v1";

function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {
      // ignore
    }
  }, [key]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const nxt = typeof next === "function"
          ? (next as (p: T) => T)(prev)
          : next;
        try {
          localStorage.setItem(key, JSON.stringify(nxt));
        } catch {
          // ignore
        }
        return nxt;
      });
    },
    [key]
  );
  return [value, set] as const;
}


export function DashboardClient() {
  const { companies, loading, refresh, updateCompany } = useCompanies();
  const [selected, setSelected] = useState<Company | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFiltersRaw] = useLocalState<ColumnFiltersState>(
    FILTERS_KEY,
    [{ id: "website", value: "__empty__" }]
  );
  const [sorting, setSortingRaw] = useLocalState<SortingState>(SORTING_KEY, [
    { id: "postal_code", desc: false },
  ]);
  const [viewMode, setViewMode] = useLocalState<"table" | "map">(
    VIEW_MODE_KEY,
    "table"
  );

  // Open-at filter — not persisted (day-of-week must stay current)
  // time is "HH:MM" in 24-hour format; null = filter off
  const [openAtTime, setOpenAtTime] = useState<string | null>(null);

  // Derive { day, minutes } from openAtTime (always uses today's day of week)
  const openAtParam = useMemo((): { day: number; minutes: number } | null => {
    if (!openAtTime) return null;
    const [h, m] = openAtTime.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return { day: new Date().getDay(), minutes: h * 60 + m };
  }, [openAtTime]);

  // Portal slot for table toolbar (Filter + Columns), rendered next to the view toggle
  const [toolbarEl, setToolbarEl] = useState<HTMLDivElement | null>(null);

  // Geocode-all state
  const [geocoding, setGeocoding] = useState(false);

  const runGeocodeAll = useCallback(async () => {
    if (geocoding) return;
    setGeocoding(true);
    const toastId = toast.loading("Geocoding addresses… this may take a while");
    try {
      const res = await fetch("/api/companies/geocode-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: number;
        failed?: number;
        skipped?: number;
        total?: number;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? `Geocoding failed (HTTP ${res.status})`, {
          id: toastId,
        });
        return;
      }
      const { success = 0, failed = 0, skipped = 0, total = 0 } = data;
      if (total === 0) {
        toast.success("All companies already geocoded", { id: toastId });
      } else {
        toast.success(
          `Geocoded ${success}/${total} · ${failed} failed · ${skipped} skipped`,
          { id: toastId }
        );
      }
      refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Geocoding failed",
        { id: toastId }
      );
    } finally {
      setGeocoding(false);
    }
  }, [geocoding, refresh]);

  // Map view state — not persisted
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [visibleInMap, setVisibleInMap] = useState<string[]>([]);
  const [orderedIds, setOrderedIds] = useState<string[] | null>(null);
  const [routeStats, setRouteStats] = useState<{
    distanceMeters: number;
    durationSeconds: number;
  } | null>(null);
  const [optimizing, setOptimizing] = useState(false);

  // Undo stack for filter/sort changes
  const undoStack = useRef<Array<{ columnFilters: ColumnFiltersState; sorting: SortingState }>>([]);

  const setColumnFilters = useCallback(
    (next: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
      undoStack.current.push({ columnFilters, sorting });
      if (undoStack.current.length > 50) undoStack.current.shift();
      setColumnFiltersRaw(next);
    },
    [columnFilters, sorting, setColumnFiltersRaw]
  );

  const setSorting = useCallback(
    (next: SortingState | ((prev: SortingState) => SortingState)) => {
      undoStack.current.push({ columnFilters, sorting });
      if (undoStack.current.length > 50) undoStack.current.shift();
      setSortingRaw(next);
    },
    [columnFilters, sorting, setSortingRaw]
  );

  // Cmd+Z / Ctrl+Z — undo last filter/sort change (skip when inside an input)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      const isMac = /Mac|iPhone|iPad/.test(navigator.platform ?? "");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      const prev = undoStack.current.pop();
      if (!prev) return;
      setColumnFiltersRaw(prev.columnFilters);
      setSortingRaw(prev.sorting);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setColumnFiltersRaw, setSortingRaw]);

  const handlePhoneClick = useCallback((c: Company) => {
    setSelected(c);
    setPanelOpen(true);
  }, []);

  const handleTypeClick = useCallback(
    (type: string) => {
      setColumnFilters((prev) => {
        const rest = prev.filter((f) => f.id !== "subtypes");
        return [...rest, { id: "subtypes", value: type }];
      });
    },
    [setColumnFilters]
  );

  const handleAreaClick = useCallback(
    (area: string) => {
      setColumnFilters((prev) => {
        const rest = prev.filter((f) => f.id !== "area");
        return [...rest, { id: "area", value: area }];
      });
    },
    [setColumnFilters]
  );

  const handleNeighborhoodClick = useCallback(
    (neighborhood: string) => {
      setColumnFilters((prev) => {
        const rest = prev.filter((f) => f.id !== "neighborhood");
        return [...rest, { id: "neighborhood", value: neighborhood }];
      });
    },
    [setColumnFilters]
  );


  const clearAll = useCallback(() => {
    undoStack.current.push({ columnFilters, sorting });
    if (undoStack.current.length > 50) undoStack.current.shift();
    setSearch("");
    setColumnFiltersRaw([]);
    setSortingRaw([{ id: "postal_code", desc: false }]);
    setOpenAtTime(null);
  }, [columnFilters, sorting, setColumnFiltersRaw, setSortingRaw]);

  const hasFiltersApplied =
    search.length > 0 || columnFilters.length > 0 || openAtTime !== null;

  const enableOpenNow = useCallback(() => {
    const now = new Date();
    const h = now.getHours().toString().padStart(2, "0");
    const m = now.getMinutes().toString().padStart(2, "0");
    setOpenAtTime(`${h}:${m}`);
  }, []);

  const disableOpenAt = useCallback(() => setOpenAtTime(null), []);

  // Pre-filter by open-at before passing to both table and map.
  // The table handles all other column filters internally; this just narrows
  // the dataset when the open-at filter is active.
  const openAtFiltered = useMemo(
    () =>
      openAtParam
        ? companies.filter((c) =>
            isOpenAt(c.working_hours, openAtParam.day, openAtParam.minutes)
          )
        : companies,
    [companies, openAtParam]
  );

  // Map view — filtered companies (same predicate as table, applied eagerly)
  const filteredCompanies = useMemo(
    () => applyFilters(openAtFiltered, columnFilters, search),
    [openAtFiltered, columnFilters, search]
  );

  const selectedCompanies = useMemo(
    () => companies.filter((c) => selectedIds.has(c.id)),
    [companies, selectedIds]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setOrderedIds(null);
    setRouteStats(null);
  }, []);

  const selectAllInView = useCallback(() => {
    if (visibleInMap.length === 0) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of visibleInMap) next.add(id);
      return next;
    });
    setOrderedIds(null);
    setRouteStats(null);
  }, [visibleInMap]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setOrderedIds(null);
    setRouteStats(null);
  }, []);

  const removeFromSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setOrderedIds(null);
    setRouteStats(null);
  }, []);

  const optimizeRoute = useCallback(async () => {
    const stops = selectedCompanies
      .filter(
        (c): c is Company & { latitude: number; longitude: number } =>
          typeof c.latitude === "number" && typeof c.longitude === "number"
      )
      .map((c) => ({
        id: c.id,
        latitude: c.latitude,
        longitude: c.longitude,
      }));
    if (stops.length < 2) return;
    setOptimizing(true);
    try {
      const res = await fetch("/api/route/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stops }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as {
        orderedIds: string[];
        distanceMeters: number;
        durationSeconds: number;
      };
      setOrderedIds(body.orderedIds);
      setRouteStats({
        distanceMeters: body.distanceMeters,
        durationSeconds: body.durationSeconds,
      });
      toast.success(
        `Route optimized: ${(body.distanceMeters / 1000).toFixed(1)} km`
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to optimize route"
      );
    } finally {
      setOptimizing(false);
    }
  }, [selectedCompanies]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-3 sm:px-4 pt-2.5 sm:pt-3 pb-0">
        <div className="flex items-center justify-between gap-2 pb-2.5 sm:pb-3">
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-semibold tracking-tight truncate">
              HSC CRM
            </h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
              {companies.length.toLocaleString()} companies
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={refresh}
              className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-medium border rounded-md hover:bg-accent transition-colors"
              title="Refresh from server"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={runGeocodeAll}
              disabled={geocoding}
              className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-medium border rounded-md hover:bg-accent transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              title="Geocode all companies missing coordinates"
            >
              {geocoding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MapPin className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {geocoding ? "Geocoding…" : "Geocode"}
              </span>
            </button>
            <SyncButton onSyncComplete={refresh} />
            <UserButton />
          </div>
        </div>
        <NavTabs />
      </header>

      {/* Control bar */}
      <div className="border-b bg-card/60 px-3 sm:px-4 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-full sm:min-w-64 sm:max-w-md">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search name, phone, email, address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>

          {/* Open-at filter */}
          {openAtTime ? (
            <div className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-primary/10 border border-primary/30">
              <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-primary font-medium whitespace-nowrap">Open at</span>
              <input
                type="time"
                value={openAtTime}
                onChange={(e) => setOpenAtTime(e.target.value)}
                className="h-5 w-[5.5rem] bg-transparent text-xs text-primary border-none outline-none focus:ring-0 cursor-text"
              />
              <button
                onClick={disableOpenAt}
                className="text-primary/70 hover:text-primary ml-0.5"
                aria-label="Remove open-at filter"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={enableOpenNow}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs border rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground whitespace-nowrap"
              title="Filter to businesses open right now"
            >
              <Clock className="h-3.5 w-3.5" />
              Open now
            </button>
          )}

          {hasFiltersApplied && (
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}

          {/* Portal target — CompaniesTable renders Filter + Columns here on desktop */}
          <div
            ref={setToolbarEl}
            className="ml-auto hidden md:flex items-center gap-2"
          />

          <div className="md:ml-0 ml-auto inline-flex items-center border rounded-md p-0.5">
            <button
              onClick={() => setViewMode("table")}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${
                viewMode === "table"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Table view"
              aria-label="Table view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${
                viewMode === "map"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Map view"
              aria-label="Map view"
            >
              <MapIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Map</span>
            </button>
          </div>
        </div>

        {/* Desktop: quick-filter chips for the most common columns */}
        <div className="hidden md:block mt-2">
          <QuickFilters
            companies={companies}
            columnFilters={columnFilters}
            onFiltersChange={setColumnFilters}
          />
        </div>
      </div>

      <div className="p-2 sm:p-4">
        {viewMode === "table" ? (
          <CompaniesTable
            companies={openAtFiltered}
            loading={loading}
            globalFilter={search}
            columnFilters={columnFilters}
            sorting={sorting}
            onColumnFiltersChange={setColumnFilters}
            onSortingChange={setSorting}
            onPhoneClick={handlePhoneClick}
            onTypeClick={handleTypeClick}
            onAreaClick={handleAreaClick}
            onNeighborhoodClick={handleNeighborhoodClick}
            toolbarEl={toolbarEl}
          />
        ) : (
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 min-w-0">
              <MapView
                companies={filteredCompanies}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onCompanyClick={handlePhoneClick}
                orderedIds={orderedIds}
                onBoundsChange={setVisibleInMap}
              />
              <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
                Click a pin to open · Shift-click to add/remove from route
              </p>
            </div>
            <RoutePanel
              allVisibleCount={visibleInMap.length}
              totalCount={filteredCompanies.length}
              ungeocodedCount={
                filteredCompanies.filter(
                  (c) =>
                    typeof c.latitude !== "number" ||
                    typeof c.longitude !== "number"
                ).length
              }
              selected={selectedCompanies}
              orderedIds={orderedIds}
              optimizing={optimizing}
              routeStats={routeStats}
              onSelectAllInView={selectAllInView}
              onClearSelection={clearSelection}
              onRemoveSelected={removeFromSelection}
              onOptimize={optimizeRoute}
            />
          </div>
        )}
      </div>

      <CompanyPanel
        company={selected}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        onUpdated={updateCompany}
      />
    </div>
  );
}
