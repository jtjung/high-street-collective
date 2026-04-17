export interface PostcodeResult {
  area: string | null;
  neighborhood: string | null;
}

async function fetchBatch(
  postcodes: string[]
): Promise<Map<string, PostcodeResult>> {
  const res = await fetch("https://api.postcodes.io/postcodes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postcodes }),
  });
  if (!res.ok) return new Map();
  const data = await res.json();
  const map = new Map<string, PostcodeResult>();
  for (const item of (data.result ?? []) as Array<{
    query: string;
    result: Record<string, string> | null;
  }>) {
    if (!item?.result) continue;
    map.set(item.query.toUpperCase(), {
      area: item.result.admin_district ?? item.result.admin_county ?? null,
      neighborhood: item.result.admin_ward ?? null,
    });
  }
  return map;
}

// Looks up area + neighborhood for a list of postcodes via postcodes.io.
// Batches 100 at a time; delay is applied between batches to respect rate limits.
export async function lookupAreas(
  postcodes: string[],
  delayMs = 1000
): Promise<Map<string, PostcodeResult>> {
  const unique = [...new Set(postcodes.map((p) => p.toUpperCase()))];
  const result = new Map<string, PostcodeResult>();
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);
    const batchResult = await fetchBatch(batch);
    batchResult.forEach((v, k) => result.set(k, v));
    if (i + 100 < unique.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return result;
}
