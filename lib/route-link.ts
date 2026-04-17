import type { Company } from "@/lib/use-companies";

/**
 * Build a Google Maps "directions with waypoints" deep link. Opens in the
 * native Google Maps app on mobile, web Google Maps on desktop.
 * https://developers.google.com/maps/documentation/urls/get-started#directions-action
 */
export function buildGoogleMapsRouteLink(
  stops: Company[],
  opts: { travelMode?: "walking" | "driving" | "bicycling" | "transit" } = {}
): string | null {
  const valid = stops.filter(
    (s) => typeof s.latitude === "number" && typeof s.longitude === "number"
  );
  if (valid.length < 2) return null;
  const [origin, ...rest] = valid;
  const destination = rest[rest.length - 1];
  const waypoints = rest.slice(0, -1);

  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", `${origin.latitude},${origin.longitude}`);
  url.searchParams.set(
    "destination",
    `${destination.latitude},${destination.longitude}`
  );
  if (waypoints.length) {
    url.searchParams.set(
      "waypoints",
      waypoints.map((w) => `${w.latitude},${w.longitude}`).join("|")
    );
  }
  url.searchParams.set("travelmode", opts.travelMode ?? "walking");
  return url.toString();
}
