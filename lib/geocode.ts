const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";

export type GeocodeResult = {
  latitude: number;
  longitude: number;
};

/**
 * Geocode a single address via Nominatim (OpenStreetMap).
 * Free, no API key, but rate-limited to ~1 req/sec — caller must pace requests.
 */
export async function geocodeAddress(
  address: string,
  opts: { userAgent?: string; countryCode?: string } = {}
): Promise<GeocodeResult | null> {
  const userAgent =
    opts.userAgent ?? "hsc-crm/1.0 (https://github.com/jtjung/high-street-collective)";
  const params = new URLSearchParams({
    q: address,
    format: "json",
    limit: "1",
  });
  if (opts.countryCode) params.set("countrycodes", opts.countryCode);

  const res = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
    headers: { "User-Agent": userAgent, Accept: "application/json" },
  });

  if (!res.ok) return null;
  const body = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!body.length) return null;
  const hit = body[0];
  return {
    latitude: parseFloat(hit.lat),
    longitude: parseFloat(hit.lon),
  };
}
