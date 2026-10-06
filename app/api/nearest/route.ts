import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { locations } from "@/db/schema";
import { OFF_CAMPUS_SNAP_RADIUS_M } from "@/lib/config";
import { haversineMeters } from "@/lib/geo/haversine";
import type { LatLng } from "@/lib/geo/types";
import { loadGraph } from "@/lib/services/graph-cache";
import { handleRoute } from "@/lib/services/handle-route";
import { badRequest, jsonOk, unauthorized } from "@/lib/services/response";
import { snapToNearestNode } from "@/lib/routing/snap";
import { nearestQuerySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/**
 * GET /api/nearest?lat=7.15&lng=3.34
 *
 * Snaps a GPS fix (or a map tap) to the closest graph node and reports the
 * closest campus place, so the UI can say "You are near the Library".
 */
export async function GET(req: NextRequest): Promise<Response> {
  return handleRoute(async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const parsed = nearestQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    if (!parsed.success) {
      return badRequest("Valid lat and lng are required", parsed.error.issues);
    }

    const db = await getDb();
    const { graph } = await loadGraph(db);
    const point: LatLng = { lat: parsed.data.lat, lng: parsed.data.lng };
    const snapped = snapToNearestNode(graph, point);

    if (!snapped) {
      return jsonOk({
        node: null,
        offCampus: true,
        distanceM: null,
        nearestLocation: null,
      });
    }

    // Nearest campus place (used for friendly "you are near ..." copy).
    const placeRows = await db
      .select({
        id: locations.id,
        name: locations.name,
        latitude: locations.latitude,
        longitude: locations.longitude,
      })
      .from(locations)
      .where(sql`${locations.isActive} = true`)
      .limit(100);

    let nearest: { id: number; name: string; distanceM: number } | null = null;
    for (const place of placeRows) {
      const distance = haversineMeters(point, {
        lat: place.latitude,
        lng: place.longitude,
      });
      if (!nearest || distance < nearest.distanceM) {
        nearest = {
          id: place.id,
          name: place.name,
          distanceM: Math.round(distance),
        };
      }
    }

    return jsonOk({
      node: {
        id: snapped.node.id,
        lat: snapped.node.lat,
        lng: snapped.node.lng,
        locationId: snapped.node.locationId,
        label: snapped.node.label,
      },
      distanceM: snapped.distanceM,
      offCampus: snapped.offCampus,
      snapRadiusM: OFF_CAMPUS_SNAP_RADIUS_M,
      nearestLocation: nearest,
    });
  });
}
