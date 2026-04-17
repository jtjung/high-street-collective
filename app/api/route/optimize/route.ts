import { getAuth } from "@/lib/get-auth";
import { NextResponse } from "next/server";

type Stop = { id: string; latitude: number; longitude: number };
type Body = { stops: Stop[]; mode?: "foot" | "driving" | "bike" };

/**
 * Solves the Travelling Salesman Problem for the given stops using the public
 * OSRM demo Trip service. No API key required. The order returned visits every
 * stop exactly once starting from the first pin (source=first) and is
 * open-ended (roundtrip=false) — i.e. it doesn't force a return to origin.
 *
 * https://project-osrm.org/docs/v5.24.0/api/#trip-service
 */
export async function POST(req: Request) {
  const { userId } = await getAuth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { stops, mode = "foot" } = (await req.json()) as Body;
  if (!Array.isArray(stops) || stops.length < 2) {
    return NextResponse.json(
      { error: "At least 2 stops required" },
      { status: 400 }
    );
  }
  if (stops.length > 100) {
    return NextResponse.json(
      { error: "OSRM trip capped at 100 stops" },
      { status: 400 }
    );
  }

  const coords = stops
    .map((s) => `${s.longitude},${s.latitude}`)
    .join(";");
  const url = `https://router.project-osrm.org/trip/v1/${mode}/${coords}?source=first&roundtrip=false&overview=false`;

  const osrmRes = await fetch(url);
  if (!osrmRes.ok) {
    return NextResponse.json(
      { error: `OSRM error ${osrmRes.status}` },
      { status: 502 }
    );
  }

  const body = (await osrmRes.json()) as {
    code: string;
    waypoints?: Array<{ waypoint_index: number }>;
    trips?: Array<{ distance: number; duration: number }>;
  };

  if (body.code !== "Ok" || !body.waypoints || !body.trips?.length) {
    return NextResponse.json(
      { error: `OSRM returned ${body.code}` },
      { status: 502 }
    );
  }

  // waypoint_index = position in the optimized trip (0-indexed)
  // map back to the input stops
  const ordered = stops
    .map((stop, i) => ({
      stop,
      tripIndex: body.waypoints![i].waypoint_index,
    }))
    .sort((a, b) => a.tripIndex - b.tripIndex)
    .map((o) => o.stop.id);

  return NextResponse.json({
    orderedIds: ordered,
    distanceMeters: body.trips[0].distance,
    durationSeconds: body.trips[0].duration,
  });
}
