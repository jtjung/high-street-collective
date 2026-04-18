import type { Company } from "@/lib/use-companies";

type PinStyle = {
  fill: string;
  label: string; // short label for tooltip
};

const OUTCOME_PRIORITY: Array<{ key: string; style: PinStyle }> = [
  { key: "interested", style: { fill: "#16a34a", label: "Interested" } },
  { key: "send_website", style: { fill: "#2563eb", label: "Send website" } },
  { key: "follow_up", style: { fill: "#f59e0b", label: "Follow up" } },
  { key: "voicemail", style: { fill: "#f97316", label: "Voicemail" } },
  { key: "dead_number", style: { fill: "#334155", label: "Dead number" } },
  { key: "not_interested", style: { fill: "#dc2626", label: "Not interested" } },
];

const UNCALLED: PinStyle = { fill: "#94a3b8", label: "Uncalled" };

export function pinStyleFor(c: Company): PinStyle {
  const outs = c.outcomes ?? [];
  for (const o of OUTCOME_PRIORITY) {
    if (outs.includes(o.key)) return o.style;
  }
  return UNCALLED;
}

/**
 * Raw HTML for a Leaflet DivIcon — small circle with optional ring styles and
 * optional numeric label overlay (used in route order mode).
 */
export function pinMarkerHtml(
  c: Company,
  opts: { selected?: boolean; order?: number; isOpen?: boolean | null } = {}
): string {
  const { fill } = pinStyleFor(c);
  const noWebsite = !c.website;
  const noEmail = !c.email;
  const ring = opts.selected
    ? "box-shadow: 0 0 0 3px #0f172a, 0 0 0 5px #fff;"
    : noWebsite && noEmail
    ? "box-shadow: 0 0 0 2px #fff, 0 0 0 3px #111; border: 1px dashed #fff;"
    : noWebsite
    ? "box-shadow: 0 0 0 2px #fff, 0 0 0 3px #111;"
    : noEmail
    ? "border: 2px dashed #fff; box-shadow: 0 0 0 1px #111;"
    : "box-shadow: 0 0 0 2px #fff, 0 0 0 3px rgba(0,0,0,.25);";

  const size = opts.order != null ? 24 : 16;
  const base = `background:${fill};width:${size}px;height:${size}px;border-radius:50%;${ring}`;
  const label =
    opts.order != null
      ? `<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;font-family:ui-sans-serif,system-ui;line-height:1;">${opts.order}</span>`
      : "";
  const dot =
    opts.isOpen != null
      ? `<div style="position:absolute;bottom:-2px;right:-2px;width:7px;height:7px;border-radius:50%;background:${opts.isOpen ? "#22c55e" : "#ef4444"};border:1.5px solid #fff;"></div>`
      : "";
  return `<div style="position:relative;${base}">${label}${dot}</div>`;
}
