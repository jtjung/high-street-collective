"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { Company } from "@/lib/use-companies";
import { pinMarkerHtml } from "@/lib/pin-style";
import { Button } from "@/components/ui/button";

type Props = {
  companies: Company[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onCompanyClick: (c: Company) => void;
  orderedIds: string[] | null;
  onBoundsChange: (ids: string[]) => void;
};

function companiesWithCoords(companies: Company[]) {
  return companies.filter(
    (c): c is Company & { latitude: number; longitude: number } =>
      typeof c.latitude === "number" && typeof c.longitude === "number"
  );
}

function ClusterLayer({
  companies,
  selectedIds,
  onToggleSelect,
  onCompanyClick,
  orderedIds,
  onBoundsChange,
}: Props) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  const orderIndex = useMemo(() => {
    if (!orderedIds) return null;
    const m = new Map<string, number>();
    orderedIds.forEach((id, i) => m.set(id, i + 1));
    return m;
  }, [orderedIds]);

  useEffect(() => {
    const group = L.markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 60,
    });
    clusterRef.current = group;
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      clusterRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const group = clusterRef.current;
    if (!group) return;
    group.clearLayers();

    const withCoords = companiesWithCoords(companies);
    const markers = withCoords.map((c) => {
      const order = orderIndex?.get(c.id);
      const icon = L.divIcon({
        html: pinMarkerHtml(c, {
          selected: selectedIds.has(c.id),
          order,
        }),
        className: "hsc-pin",
        iconSize: order != null ? [24, 24] : [16, 16],
        iconAnchor: order != null ? [12, 12] : [8, 8],
      });
      const m = L.marker([c.latitude, c.longitude], { icon });
      m.bindTooltip(
        `<strong>${escapeHtml(c.name)}</strong>${
          c.postal_code ? ` · ${escapeHtml(c.postal_code)}` : ""
        }`,
        { direction: "top", offset: [0, -8] }
      );
      m.on("click", (e) => {
        // Shift-click to toggle selection, plain click to open panel
        const native = (e.originalEvent as MouseEvent | undefined) ?? null;
        if (native && (native.shiftKey || native.metaKey || native.ctrlKey)) {
          onToggleSelect(c.id);
        } else {
          onCompanyClick(c);
        }
      });
      return m;
    });
    group.addLayers(markers);

    // Fit bounds on first render when companies change significantly
    if (withCoords.length > 0) {
      const bounds = L.latLngBounds(
        withCoords.map((c) => [c.latitude, c.longitude])
      );
      // Only auto-fit if current view doesn't already contain the data
      if (!map.getBounds().intersects(bounds)) {
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies, selectedIds, orderedIds]);

  useEffect(() => {
    const handler = () => {
      const bounds = map.getBounds();
      const visible = companiesWithCoords(companies)
        .filter((c) => bounds.contains([c.latitude, c.longitude]))
        .map((c) => c.id);
      onBoundsChange(visible);
    };
    map.on("moveend", handler);
    // Fire once on mount so parent knows initial view
    handler();
    return () => {
      map.off("moveend", handler);
    };
  }, [map, companies, onBoundsChange]);

  return null;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function MapView(props: Props) {
  const withCoords = companiesWithCoords(props.companies);
  const ungeocoded = props.companies.length - withCoords.length;
  const initialCenter: [number, number] =
    withCoords.length > 0
      ? [withCoords[0].latitude, withCoords[0].longitude]
      : [51.5074, -0.1278]; // London default

  const [geocoding, setGeocoding] = useState(false);
  const [geocodeResult, setGeocodeResult] = useState<{
    success: number;
    failed: number;
    skipped: number;
    total: number;
  } | null>(null);

  async function runGeocode() {
    setGeocoding(true);
    setGeocodeResult(null);
    try {
      const res = await fetch("/api/companies/geocode-all", { method: "POST", body: JSON.stringify({}) });
      const data = await res.json();
      setGeocodeResult(data);
    } catch {
      setGeocodeResult(null);
    } finally {
      setGeocoding(false);
    }
  }

  return (
    <div className="relative h-[70vh] min-h-[480px] w-full rounded-lg border overflow-hidden bg-muted isolate">
      <MapContainer
        center={initialCenter}
        zoom={12}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClusterLayer {...props} />
      </MapContainer>

      {/* Floating geocode button when some companies are ungeocoded */}
      {ungeocoded > 0 && withCoords.length > 0 && (
        <div className="absolute bottom-4 right-4 z-[1000] flex flex-col items-end gap-2">
          {geocodeResult && (
            <div className="rounded-md bg-card border px-3 py-2 text-xs shadow">
              {geocodeResult.success} geocoded · {geocodeResult.failed} failed · {geocodeResult.skipped} skipped
            </div>
          )}
          <Button size="sm" disabled={geocoding} onClick={runGeocode}>
            {geocoding ? "Geocoding…" : `Geocode ${ungeocoded} missing`}
          </Button>
        </div>
      )}

      {/* Full overlay when nothing is geocoded yet */}
      {props.companies.length > 0 && withCoords.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center p-6 bg-background/90 z-[1000]">
          <div className="max-w-md rounded-lg border bg-card p-4 text-center text-sm">
            <p className="font-medium mb-2">No geocoded companies yet</p>
            {geocodeResult ? (
              <p className="text-muted-foreground text-xs">
                Done: {geocodeResult.success} geocoded · {geocodeResult.failed} failed · {geocodeResult.skipped} skipped
              </p>
            ) : (
              <Button size="sm" disabled={geocoding} onClick={runGeocode}>
                {geocoding ? `Geocoding ${props.companies.length} companies…` : "Geocode all companies"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
