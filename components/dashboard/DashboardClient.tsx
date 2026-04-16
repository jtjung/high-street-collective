"use client";

import { useState, useCallback, useMemo } from "react";
import { UserButton } from "@clerk/nextjs";
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import { CompaniesTable } from "./CompaniesTable";
import { CompanyPanel } from "./CompanyPanel";
import { SyncButton } from "./SyncButton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Search, X } from "lucide-react";
import { useCompanies, type Company } from "@/lib/use-companies";
import { OUTCOME_OPTIONS } from "@/lib/outcomes";

const FILTERS_KEY = "hsc:columnFilters:v2";
const SORTING_KEY = "hsc:sorting:v2";

function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const nxt = typeof next === "function"
          ? (next as (p: T) => T)(prev)
          : next;
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(key, JSON.stringify(nxt));
          } catch {
            // ignore
          }
        }
        return nxt;
      });
    },
    [key]
  );
  return [value, set] as const;
}

// Options used in the top control bar
const WEBSITE_FILTER_OPTIONS = [
  { value: "__all__", label: "All websites" },
  { value: "__empty__", label: "No website" },
  { value: "__nonempty__", label: "Has website" },
];

const OUTCOME_FILTER_OPTIONS = [
  { value: "__all__", label: "All companies" },
  { value: "__uncalled__", label: "Uncalled only" },
  { value: "__any__", label: "Called (any outcome)" },
  ...OUTCOME_OPTIONS.map((o) => ({ value: o.label, label: o.label })),
];

const SORT_OPTIONS = [
  { value: "postal_code:asc", label: "Postal code A→Z" },
  { value: "postal_code:desc", label: "Postal code Z→A" },
  { value: "name:asc", label: "Name A→Z" },
  { value: "name:desc", label: "Name Z→A" },
  { value: "last_reached_out:desc", label: "Most recently reached" },
  { value: "last_reached_out:asc", label: "Least recently reached" },
  { value: "callback_at:asc", label: "Callback soonest" },
  { value: "callback_at:desc", label: "Callback latest" },
];

export function DashboardClient() {
  const { companies, loading, refresh, updateCompany } = useCompanies();
  const [selected, setSelected] = useState<Company | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useLocalState<ColumnFiltersState>(
    FILTERS_KEY,
    [{ id: "website", value: "__empty__" }]
  );
  const [sorting, setSorting] = useLocalState<SortingState>(SORTING_KEY, [
    { id: "postal_code", desc: false },
  ]);

  const handlePhoneClick = useCallback((c: Company) => {
    setSelected(c);
    setPanelOpen(true);
  }, []);

  // Derive control-bar values from columnFilters/sorting
  const websiteFilter = useMemo(() => {
    const f = columnFilters.find((f) => f.id === "website");
    return (f?.value as string) ?? "__all__";
  }, [columnFilters]);

  const outcomeFilter = useMemo(() => {
    const f = columnFilters.find((f) => f.id === "outcomes");
    return (f?.value as string) ?? "__all__";
  }, [columnFilters]);

  const sortValue = useMemo(() => {
    if (sorting.length === 0) return "postal_code:asc";
    const s = sorting[0];
    return `${s.id}:${s.desc ? "desc" : "asc"}`;
  }, [sorting]);

  const setWebsiteFilter = useCallback(
    (value: string) => {
      setColumnFilters((prev) => {
        const rest = prev.filter((f) => f.id !== "website");
        if (value === "__all__") return rest;
        return [...rest, { id: "website", value }];
      });
    },
    [setColumnFilters]
  );

  const setOutcomeFilter = useCallback(
    (value: string) => {
      setColumnFilters((prev) => {
        const rest = prev.filter((f) => f.id !== "outcomes");
        if (value === "__all__") return rest;
        return [...rest, { id: "outcomes", value }];
      });
    },
    [setColumnFilters]
  );

  const setSort = useCallback(
    (value: string) => {
      const [id, dir] = value.split(":");
      setSorting([{ id, desc: dir === "desc" }]);
    },
    [setSorting]
  );

  const clearAll = useCallback(() => {
    setSearch("");
    setColumnFilters([]);
    setSorting([{ id: "postal_code", desc: false }]);
  }, [setColumnFilters, setSorting]);

  const hasFiltersApplied =
    search.length > 0 || columnFilters.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold tracking-tight">
              High Street Collective CRM
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {companies.length.toLocaleString()} companies · cached locally
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border rounded-md hover:bg-accent transition-colors"
              title="Refresh from server"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
            <SyncButton onSyncComplete={refresh} />
            <UserButton />
          </div>
        </div>
      </header>

      {/* Control bar */}
      <div className="border-b bg-card/60 px-4 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-64 max-w-md">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search name, phone, email, address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>

          <Select
            value={websiteFilter}
            onValueChange={(v) => v && setWebsiteFilter(v)}
          >
            <SelectTrigger className="h-9 w-40 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEBSITE_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={outcomeFilter}
            onValueChange={(v) => v && setOutcomeFilter(v)}
          >
            <SelectTrigger className="h-9 w-48 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OUTCOME_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortValue} onValueChange={(v) => v && setSort(v)}>
            <SelectTrigger className="h-9 w-52 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFiltersApplied && (
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        <CompaniesTable
          companies={companies}
          loading={loading}
          globalFilter={search}
          columnFilters={columnFilters}
          sorting={sorting}
          onColumnFiltersChange={setColumnFilters}
          onSortingChange={setSorting}
          onPhoneClick={handlePhoneClick}
        />
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
