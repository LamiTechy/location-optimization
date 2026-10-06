import { NextRequest } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { locations, routeHistory } from "@/db/schema";
import { handleRoute } from "@/lib/services/handle-route";
import { badRequest, jsonOk, unauthorized } from "@/lib/services/response";

export const dynamic = "force-dynamic";

/**
 * GET /api/history - the signed-in user's recent routes, newest first,
 * with the saved place names resolved (report: Route History).
 */
export async function GET(): Promise<Response> {
  return handleRoute(async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const db = await getDb();
    const userId = Number(session.sub);

    const rows = await db
      .select({
        id: routeHistory.id,
        distanceM: routeHistory.distanceM,
        durationMin: routeHistory.durationMin,
        createdAt: routeHistory.createdAt,
        fromLocationId: routeHistory.fromLocationId,
        toLocationId: routeHistory.toLocationId,
        fromLat: routeHistory.fromLat,
        fromLng: routeHistory.fromLng,
        fromName: locations.name,
      })
      .from(routeHistory)
      .leftJoin(
        locations,
        eq(locations.id, routeHistory.fromLocationId),
      )
      .where(eq(routeHistory.userId, userId))
      .orderBy(desc(routeHistory.createdAt))
      .limit(50);

    const toIds = [
      ...new Set(
        rows
          .map((row) => row.toLocationId)
          .filter((id): id is number => typeof id === "number"),
      ),
    ];
    const destinationRows =
      toIds.length > 0
        ? await db
            .select({ id: locations.id, name: locations.name })
            .from(locations)
            .where(sql`${locations.id} in (${sql.join(toIds.map((id) => sql`${id}`), sql`, `)})`)
        : [];
    const destinationNames = new Map(destinationRows.map((row) => [row.id, row.name]));

    return jsonOk({
      history: rows.map((row) => ({
        id: row.id,
        distanceM: row.distanceM,
        durationMin: row.durationMin,
        createdAt: row.createdAt,
        from:
          row.fromLocationId !== null
            ? { type: "location", id: row.fromLocationId, name: row.fromName ?? "Unknown place" }
            : row.fromLat !== null && row.fromLng !== null
              ? { type: "gps", lat: row.fromLat, lng: row.fromLng, name: "My location" }
              : null,
        to:
          row.toLocationId !== null
            ? {
                type: "location",
                id: row.toLocationId,
                name: destinationNames.get(row.toLocationId) ?? "Unknown place",
              }
            : null,
      })),
    });
  });
}

/** DELETE /api/history?id=12 (one) or DELETE /api/history (all). */
export async function DELETE(req: NextRequest): Promise<Response> {
  return handleRoute(async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const db = await getDb();
    const userId = Number(session.sub);

    const raw = req.nextUrl.searchParams.get("id");
    if (raw === null) {
      await db.delete(routeHistory).where(eq(routeHistory.userId, userId));
      return jsonOk({ cleared: true });
    }

    const id = Number.parseInt(raw, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return badRequest("id must be a positive integer");
    }

    await db
      .delete(routeHistory)
      .where(
        and(eq(routeHistory.userId, userId), eq(routeHistory.id, id)),
      );
    return jsonOk({ cleared: true, id });
  });
}
