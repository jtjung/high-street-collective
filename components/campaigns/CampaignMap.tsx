"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const OUTCOME_PRIORITY: Array<[string, string]> = [
  ["interested", "#16a34a"],
  ["send_website", "#2563eb"],
  ["follow_up", "#f59e0b"],
  ["voicemail", "#f97316"],
  ["dead_number", "#334155"],
  ["not_interested", "#dc2626"],
];

function outcomeColor(outcomes: string[] | null | undefined): string {
  for (const [key, fill] of OUTCOME_PRIORITY) {
    if (outcomes?.includes(key)) return fill;
  }
  return "#94a3b8";
}

export type CampaignMapMember = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  outcomes?: string[] | null;
};

type Props = {
  members: CampaignMapMember[];
  orderedIds?: string[] | null;
};

export function CampaignMap({ members, orderedIds }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const geocoded = members.filter(
      (m): m is CampaignMapMember & { latitude: number; longitude: number } =>
        typeof m.latitude === "number" && typeof m.longitude === "number"
    );
    if (geocoded.length === 0) return;

    const map = L.map(el);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const orderMap = orderedIds
      ? new Map(orderedIds.map((id, i) => [id, i + 1]))
      : null;

    const bounds: [number, number][] = [];

    for (const m of geocoded) {
      bounds.push([m.latitude, m.longitude]);
      const order = orderMap?.get(m.id);
      const fill = outcomeColor(m.outcomes);
      const size = order != null ? 24 : 16;
      const label =
        order != null
          ? `<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;font-family:ui-sans-serif,system-ui;">${order}</span>`
          : "";

      const icon = L.divIcon({
        html: `<div style="position:relative;background:${fill};width:${size}px;height:${size}px;border-radius:50%;box-shadow:0 0 0 2px #fff,0 0 0 3px rgba(0,0,0,.25);">${label}</div>`,
        className: "",
        iconAnchor: [size / 2, size / 2],
        iconSize: [size, size],
      });

      L.marker([m.latitude, m.longitude], { icon })
        .bindTooltip(m.name, { permanent: false })
        .addTo(map);
    }

    if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    } else {
      map.fitBounds(bounds, { padding: [30, 30] });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const geocodedCount = members.filter((m) => typeof m.latitude === "number").length;
  if (geocodedCount === 0) return null;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        ref={containerRef}
        style={{ height: 400 }}
        className="w-full"
      />
    </div>
  );
}
