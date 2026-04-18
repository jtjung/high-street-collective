"use client";

import { useMemo } from "react";
import type { ColumnFiltersState } from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown, X } from "lucide-react";
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
  // For single-select columns, this is string|undefined.
  // For multi-select columns, this is string[] (may be empty = inactive).
  value: string | string[] | undefined;
  options: { value: string; label: string }[];
  onChangeSingle?: (v: string | undefined) => void;
  onToggleMulti?: (v: string) => void;
  onClearMulti?: () => void;
  emptyHint?: string;
}

function QuickFilterChip({
  label,
  value,
  options,
  onChangeSingle,
  onToggleMulti,
  onClearMulti,
  emptyHint,
}: QuickFilterChipProps) {
  const isMulti = Array.isArray(value);
  const multiValues = isMulti ? value : [];
  const active = isMulti ? multiValues.length > 0 : value !== undefined;

  // Derive display label
  let displayLabel: string | null = null;
  if (isMulti && multiValues.length > 0) {
    if (multiValues.length === 1) {
      displayLabel =
        options.find((o) => o.value === multiValues[0])?.label ?? multiValues[0];
    } else {
      displayLabel = `${multiValues.length} selected`;
    }
  } else if (!isMulti && value !== undefined) {
    displayLabel = options.find((o) => o.value === value)?.label ?? (value as string);
  }

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
            options.map((opt) => {
              const checked = isMulti
                ? multiValues.includes(opt.value)
                : value === opt.value;
              return (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => {
                    if (isMulti) {
                      onToggleMulti?.(opt.value);
                    } else {
                      onChangeSingle?.(
                        opt.value === value ? undefined : opt.value
                      );
                    }
                  }}
                  className={checked ? "bg-accent" : ""}
                  closeOnClick={isMulti ? false : true}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span
                      className={`h-3.5 w-3.5 shrink-0 flex items-center justify-center rounded border border-muted-foreground/30 ${checked ? "bg-primary border-primary" : ""}`}
                    >
                      {checked && (
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      )}
                    </span>
                    <span className={checked ? "font-medium" : ""}>
                      {opt.label}
                    </span>
                  </div>
                </DropdownMenuItem>
              );
            })
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {active && (
        <button
          onClick={() => {
            if (isMulti) {
              onClearMulti?.();
            } else {
              onChangeSingle?.(undefined);
            }
          }}
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

  // Get current single-select value for a column
  const getSingle = (id: string): string | undefined => {
    const f = columnFilters.find((x) => x.id === id);
    if (!f) return undefined;
    return typeof f.value === "string" ? f.value : undefined;
  };

  // Get current multi-select values for a column
  const getMulti = (id: string): string[] => {
    const f = columnFilters.find((x) => x.id === id);
    if (!f) return [];
    if (Array.isArray(f.value)) return f.value as string[];
    if (typeof f.value === "string" && f.value) return [f.value];
    return [];
  };

  const setSingle = (id: string, v: string | undefined) => {
    onFiltersChange((prev) => {
      const rest = prev.filter((x) => x.id !== id);
      return v === undefined ? rest : [...rest, { id, value: v }];
    });
  };

  const toggleMulti = (id: string, v: string) => {
    onFiltersChange((prev) => {
      const existing = prev.find((x) => x.id === id);
      const current: string[] = existing
        ? Array.isArray(existing.value)
          ? (existing.value as string[])
          : typeof existing.value === "string"
            ? [existing.value]
            : []
        : [];
      const next = current.includes(v)
        ? current.filter((x) => x !== v)
        : [...current, v];
      const rest = prev.filter((x) => x.id !== id);
      return next.length ? [...rest, { id, value: next }] : rest;
    });
  };

  const clearMulti = (id: string) => {
    onFiltersChange((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mr-1">
        Quick filters
      </span>
      <QuickFilterChip
        label="Website"
        value={getSingle("website")}
        options={WEBSITE_OPTIONS}
        onChangeSingle={(v) => setSingle("website", v)}
      />
      <QuickFilterChip
        label="Type"
        value={getMulti("subtypes")}
        options={distinctOptions.subtypes.map((s) => ({ value: s, label: s }))}
        onToggleMulti={(v) => toggleMulti("subtypes", v)}
        onClearMulti={() => clearMulti("subtypes")}
        emptyHint="No types in data"
      />
      <QuickFilterChip
        label="Area"
        value={getMulti("area")}
        options={distinctOptions.area.map((s) => ({ value: s, label: s }))}
        onToggleMulti={(v) => toggleMulti("area", v)}
        onClearMulti={() => clearMulti("area")}
        emptyHint="No areas in data"
      />
      <QuickFilterChip
        label="Neighbourhood"
        value={getMulti("neighborhood")}
        options={distinctOptions.neighborhood.map((s) => ({
          value: s,
          label: s,
        }))}
        onToggleMulti={(v) => toggleMulti("neighborhood", v)}
        onClearMulti={() => clearMulti("neighborhood")}
        emptyHint="No neighbourhoods in data"
      />
      <QuickFilterChip
        label="Outcomes"
        value={getMulti("outcomes")}
        options={OUTCOME_QUICK_OPTIONS}
        onToggleMulti={(v) => toggleMulti("outcomes", v)}
        onClearMulti={() => clearMulti("outcomes")}
      />
    </div>
  );
}
