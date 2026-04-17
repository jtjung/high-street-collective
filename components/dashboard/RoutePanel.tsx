"use client";

import { useMemo } from "react";
import { X, Navigation, Trash2, Loader2 } from "lucide-react";
import type { Company } from "@/lib/use-companies";
import { buildGoogleMapsRouteLink } from "@/lib/route-link";

type Props = {
  allVisibleCount: number;
  totalCount: number;
  selected: Company[];
  orderedIds: string[] | null;
  optimizing: boolean;
  routeStats: { distanceMeters: number; durationSeconds: number } | null;
  onSelectAllInView: () => void;
  onClearSelection: () => void;
  onRemoveSelected: (id: string) => void;
  onOptimize: () => void;
};

export function RoutePanel({
  allVisibleCount,
  totalCount,
  selected,
  orderedIds,
  optimizing,
  routeStats,
  onSelectAllInView,
  onClearSelection,
  onRemoveSelected,
  onOptimize,
}: Props) {
  const orderedSelected = useMemo(() => {
    if (!orderedIds) return selected;
    const byId = new Map(selected.map((s) => [s.id, s]));
    const picked = orderedIds.map((id) => byId.get(id)).filter(Boolean) as Company[];
    const leftover = selected.filter((s) => !orderedIds.includes(s.id));
    return [...picked, ...leftover];
  }, [selected, orderedIds]);

  const link = useMemo(
    () => buildGoogleMapsRouteLink(orderedSelected),
    [orderedSelected]
  );

  const geocodedSelected = selected.filter(
    (c) => typeof c.latitude === "number" && typeof c.longitude === "number"
  ).length;
  const missingCoords = selected.length - geocodedSelected;

  return (
    <aside className="w-full lg:w-80 shrink-0 flex flex-col border rounded-lg bg-card overflow-hidden">
      <div className="px-3 py-2.5 border-b">
        <p className="text-xs text-muted-foreground">
          {allVisibleCount.toLocaleString()} in view · {totalCount.toLocaleString()} total
        </p>
        <h2 className="text-sm font-semibold mt-0.5">
          Selected ({selected.length})
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[40vh] lg:max-h-none">
        {selected.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground text-center">
            Shift-click pins to add, or use{" "}
            <span className="font-medium">Select all in view</span> below.
          </div>
        ) : (
          <ol className="divide-y">
            {orderedSelected.map((c, i) => (
              <li
                key={c.id}
                className="flex items-start gap-2 px-3 py-2 text-xs hover:bg-muted/30"
              >
                <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground font-semibold text-[10px]">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{c.name}</p>
                  <p className="text-muted-foreground truncate">
                    {c.address ?? "—"}
                    {c.postal_code ? ` · ${c.postal_code}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => onRemoveSelected(c.id)}
                  className="shrink-0 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${c.name} from route`}
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="border-t p-3 space-y-2">
        {missingCoords > 0 && (
          <p className="text-[11px] text-amber-600">
            {missingCoords} selected company{missingCoords === 1 ? "" : "ies"} missing coordinates and will be skipped.
          </p>
        )}

        {routeStats && orderedIds && (
          <p className="text-[11px] text-muted-foreground">
            ~{(routeStats.distanceMeters / 1000).toFixed(1)} km · ~
            {Math.round(routeStats.durationSeconds / 60)} min walking
          </p>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={onSelectAllInView}
            className="text-xs border rounded-md px-2 py-1.5 hover:bg-accent"
          >
            Select all in view
          </button>
          <button
            onClick={onClearSelection}
            disabled={selected.length === 0}
            className="text-xs border rounded-md px-2 py-1.5 hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1"
          >
            <Trash2 className="h-3 w-3" /> Clear
          </button>
        </div>

        <button
          onClick={onOptimize}
          disabled={geocodedSelected < 2 || optimizing}
          className="w-full text-xs bg-primary text-primary-foreground rounded-md px-2 py-2 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 font-medium"
        >
          {optimizing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Optimizing…
            </>
          ) : (
            <>
              <Navigation className="h-3.5 w-3.5" /> Plan route ({geocodedSelected})
            </>
          )}
        </button>

        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-xs text-center border rounded-md px-2 py-1.5 hover:bg-accent"
          >
            Open in Google Maps ↗
          </a>
        )}
      </div>
    </aside>
  );
}
