"use client";

import { useMemo } from "react";
import type { ColumnFiltersState } from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, X } from "lucide-react";
import type { Company } from "@/lib/use-companies";
import { OUTCOME_OPTIONS } from "@/lib/outcomes";

function uniqSorted(xs: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const x of xs) {
    if (!x) continue;
    const v = String(x).trim();
    if (v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

const WEBSITE_OPTIONS = [
  { value: "__nonempty__", label: "Has website" },
  { value: "__empty__", label: "No website" },
];

const OUTCOME_QUICK_OPTIONS = [
  { value: "__uncalled__", label: "Uncalled" },
  { value: "__any__", label: "Called" },
  ...OUTCOME_OPTIONS.map((o) => ({ value: o.label, label: o.label })),
];

interface QuickFilterChipProps {
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onChange: (v: string | undefined) => void;
  emptyHint?: string;
}

function QuickFilterChip({
  label,
  value,
  options,
  onChange,
  emptyHint,
}: QuickFilterChipProps) {
  const active = value !== undefined;
  const displayLabel = active
    ? options.find((o) => o.value === value)?.label ?? value
    : null;
  const hasOptions = options.length > 0;
  return (
    <div className="inline-flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={!hasOptions && !active}
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs border rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            active
              ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15"
              : "hover:bg-accent text-muted-foreground hover:text-foreground"
          }`}
          title={!hasOptions ? emptyHint : undefined}
        >
          {active ? (
            <span className="font-medium">
              {label}: {displayLabel}
            </span>
          ) : (
            <span>{label}</span>
          )}
          <ChevronDown className="h-3 w-3 opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-72 overflow-y-auto w-56"
        >
          {options.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {emptyHint ?? "No options"}
            </div>
          ) : (
            options.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() =>
                  onChange(opt.value === value ? undefined : opt.value)
                }
                className={value === opt.value ? "bg-accent font-medium" : ""}
              >
                {opt.label}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {active && (
        <button
          onClick={() => onChange(undefined)}
          className="ml-0.5 inline-flex items-center justify-center w-5 h-5 rounded hover:bg-destructive/10 text-primary"
          aria-label={`Clear ${label} filter`}
          title={`Clear ${label} filter`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

interface QuickFiltersProps {
  companies: Company[];
  columnFilters: ColumnFiltersState;
  onFiltersChange: (
    updater:
      | ColumnFiltersState
      | ((prev: ColumnFiltersState) => ColumnFiltersState)
  ) => void;
}

export function QuickFilters({
  companies,
  columnFilters,
  onFiltersChange,
}: QuickFiltersProps) {
  const distinctOptions = useMemo(
    () => ({
      area: uniqSorted(companies.map((c) => c.area)),
      neighborhood: uniqSorted(companies.map((c) => c.neighborhood)),
      subtypes: uniqSorted(companies.flatMap((c) => c.subtypes ?? [])),
    }),
    [companies]
  );

  const getValue = (id: string) => {
    const f = columnFilters.find((x) => x.id === id);
    return f?.value === undefined ? undefined : String(f.value);
  };

  const setValue = (id: string, v: string | undefined) => {
    onFiltersChange((prev) => {
      const rest = prev.filter((x) => x.id !== id);
      return v === undefined ? rest : [...rest, { id, value: v }];
    });
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mr-1">
        Quick filters
      </span>
      <QuickFilterChip
        label="Website"
        value={getValue("website")}
        options={WEBSITE_OPTIONS}
        onChange={(v) => setValue("website", v)}
      />
      <QuickFilterChip
        label="Type"
        value={getValue("subtypes")}
        options={distinctOptions.subtypes.map((s) => ({
          value: s,
          label: s,
        }))}
        onChange={(v) => setValue("subtypes", v)}
        emptyHint="No types in data"
      />
      <QuickFilterChip
        label="Area"
        value={getValue("area")}
        options={distinctOptions.area.map((s) => ({ value: s, label: s }))}
        onChange={(v) => setValue("area", v)}
        emptyHint="No areas in data"
      />
      <QuickFilterChip
        label="Neighbourhood"
        value={getValue("neighborhood")}
        options={distinctOptions.neighborhood.map((s) => ({
          value: s,
          label: s,
        }))}
        onChange={(v) => setValue("neighborhood", v)}
        emptyHint="No neighbourhoods in data"
      />
      <QuickFilterChip
        label="Outcomes"
        value={getValue("outcomes")}
        options={OUTCOME_QUICK_OPTIONS}
        onChange={(v) => setValue("outcomes", v)}
      />
    </div>
  );
}
