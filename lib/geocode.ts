const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";

export type GeocodeResult = {
  latitude: number;
  longitude: number;
};

async function queryNominatim(
  query: string,
  userAgent: string,
  countryCode?: string
): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({ q: query, format: "json", limit: "1" });
  if (countryCode) params.set("countrycodes", countryCode);

  const res = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
    headers: { "User-Agent": userAgent, Accept: "application/json" },
  });

  if (!res.ok) return null;
  const body = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!body.length) return null;
  return { latitude: parseFloat(body[0].lat), longitude: parseFloat(body[0].lon) };
}

/**
 * Strip noisy prefixes Nominatim struggles with:
 *   "Unit B, 101 Lower Marsh..."    -> "101 Lower Marsh..."
 *   "Flat 3, 22 High St..."          -> "22 High St..."
 *   "Fields, Campdale Rd..."         -> "Campdale Rd..."
 *   "The Billiard Factory, 443..."   -> "443..."
 * Returns null when no change was made.
 */
function simplify(addr: string): string | null {
  // Drop a leading unit/flat/suite/building descriptor ending in a comma.
  const cleaned = addr
    .replace(/^\s*(unit|flat|suite|apt|apartment|room|floor|shop|kiosk|studio)\s+[^,]+,\s*/i, "")
    .replace(/^\s*[A-Za-z][^,\d]{0,40},\s*(?=\d)/, ""); // drop leading named-thing before a number
  return cleaned !== addr ? cleaned : null;
}

/**
 * Extract a UK postcode from an address string.
 * Matches standard UK formats (e.g. "SE1 7AB", "W4 2DR", "EC1A 1BB").
 */
function extractPostcode(addr: string): string | null {
  const m = addr.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Geocode a single address via Nominatim (OpenStreetMap).
 * Free, no API key, but rate-limited to ~1 req/sec — caller must pace requests
 * between distinct calls. This function may issue multiple internal queries
 * with a 1.1s delay between them when falling back.
 */
export async function geocodeAddress(
  address: string,
  opts: {
    userAgent?: string;
    countryCode?: string;
    postalCode?: string | null;
    city?: string | null;
  } = {}
): Promise<GeocodeResult | null> {
  const userAgent =
    opts.userAgent ?? "hsc-crm/1.0 (https://github.com/jtjung/high-street-collective)";
  const countryCode = opts.countryCode;

  const attempts: string[] = [address];

  const simplified = simplify(address);
  if (simplified) attempts.push(simplified);

  const addrPostcode = extractPostcode(address);
  const postcode = (opts.postalCode ?? addrPostcode)?.toUpperCase();
  if (postcode && opts.city) attempts.push(`${postcode}, ${opts.city}`);
  else if (postcode) attempts.push(postcode);
  else if (opts.city) attempts.push(opts.city);

  for (let i = 0; i < attempts.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1100)); // respect Nominatim rate limit
    try {
      const res = await queryNominatim(attempts[i], userAgent, countryCode);
      if (res) return res;
    } catch {
      // try next attempt
    }
  }

  return null;
}
