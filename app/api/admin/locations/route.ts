import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { edges, locations, nodes } from "@/db/schema";
import {
  bumpGraphVersion,
  nearestNode,
  requireAdminRole,
} from "@/lib/services/admin";
import { handleRoute } from "@/lib/services/handle-route";
import { buildSearchText } from "@/lib/services/locations";
import { badRequest, forbidden, jsonOk, notFound } from "@/lib/services/response";
import { locationInputSchema } from "@/lib/validators";
import { haversineMeters } from "@/lib/geo/haversine";

export const dynamic = "force-dynamic";

/** GET /api/admin/locations - every row, including retired ones. */
export async function GET(): Promise<Response> {
  return handleRoute(async () => {
    const admin = await requireAdminRole();
    if (!admin) return forbidden();

    const db = await getDb();
    const rows = await db
      .select()
      .from(locations)
      .orderBy(sql`${locations.name} asc`);

    return jsonOk({ locations: rows, count: rows.length });
  });
}

/**
 * POST /api/admin/locations - create a place.
 *
 * Optionally (`connect: true`, default) a graph node is created at the same
 * coordinates and linked to the nearest existing node, so the new place is
 * routable immediately.
 */
export async function POST(req: NextRequest): Promise<Response> {
  return handleRoute(async () => {
    const admin = await requireAdminRole();
    if (!admin) return forbidden();

    const raw = await req.json().catch(() => null);
    const payload = raw as { connect?: boolean; location?: unknown } | null;
    const parsed = locationInputSchema.safeParse(payload?.location ?? raw);
    if (!parsed.success) {
      return badRequest("Check the location fields", parsed.error.issues);
    }

    const db = await getDb();
    const input = parsed.data;
    const searchText = buildSearchText({
      name: input.name,
      shortCode: input.shortCode,
      building: input.building,
      category: input.category,
      description: input.description,
    });

    const created = await db
      .insert(locations)
      .values({ ...input, searchText })
      .returning();
    const location = created[0];
    if (!location) return badRequest("Could not create the location");

    const shouldConnect = payload?.connect !== false;
    if (shouldConnect) {
      const near = await nearestNode(db, location.latitude, location.longitude);

      const nodeRows = await db
        .insert(nodes)
        .values({
          latitude: location.latitude,
          longitude: location.longitude,
          locationId: location.id,
          label: location.name,
        })
        .returning({ id: nodes.id });
      const nodeId = nodeRows[0]?.id;

      if (nodeId && near && near.id !== nodeId) {
        const distance = haversineMeters(
          { lat: location.latitude, lng: location.longitude },
          { lat: near.latitude, lng: near.longitude },
        );
        await db.insert(edges).values({
          fromNode: nodeId,
          toNode: near.id,
          distanceM: Math.max(1, Math.round(distance)),
          pathType: "footpath",
          isBidirectional: true,
          isActive: true,
        });
      }
      await bumpGraphVersion(db);
    }

    return jsonOk({ location }, { status: 201 });
  });
}

/** PATCH /api/admin/locations { id, ...fields } */
export async function PATCH(req: NextRequest): Promise<Response> {
  return handleRoute(async () => {
    const admin = await requireAdminRole();
    if (!admin) return forbidden();

    const raw = (await req.json().catch(() => null)) as
      | ({ id?: number } & Record<string, unknown>)
      | null;
    const id = Number(raw?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return badRequest("id must be a positive integer");
    }

    const parsed = locationInputSchema.partial().safeParse(
      Object.fromEntries(
        Object.entries(raw ?? {}).filter(([key]) => key !== "id"),
      ),
    );
    if (!parsed.success) {
      return badRequest("Check the location fields", parsed.error.issues);
    }

    const db = await getDb();
    const patch: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.name || parsed.data.shortCode !== undefined || parsed.data.building !== undefined) {
      const current = await db
        .select()
        .from(locations)
        .where(sql`${locations.id} = ${id}`)
        .limit(1);
      if (!current[0]) return notFound("Location not found");
      patch.searchText = buildSearchText({
        name: parsed.data.name ?? current[0].name,
        shortCode: parsed.data.shortCode ?? current[0].shortCode,
        building: parsed.data.building ?? current[0].building,
        category: parsed.data.category ?? current[0].category,
        description: parsed.data.description ?? current[0].description,
      });
    }

    const updated = await db
      .update(locations)
      .set(patch)
      .where(sql`${locations.id} = ${id}`)
      .returning();
    if (!updated[0]) return notFound("Location not found");

    return jsonOk({ location: updated[0] });
  });
}

/** DELETE /api/admin/locations?id=5 */
export async function DELETE(req: NextRequest): Promise<Response> {
  return handleRoute(async () => {
    const admin = await requireAdminRole();
    if (!admin) return forbidden();

    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return badRequest("id must be a positive integer");
    }

    const db = await getDb();

    // Remove the place's graph nodes too (their edges cascade), otherwise a
    // deleted location would leave an orphan junction in the walkway graph.
    const nodeIds = await db
      .select({ id: nodes.id })
      .from(nodes)
      .where(sql`${nodes.locationId} = ${id}`);
    if (nodeIds.length > 0) {
      await db
        .delete(nodes)
        .where(
          sql`${nodes.id} in (${sql.join(
            nodeIds.map((row) => sql`${row.id}`),
            sql`, `,
          )})`,
        );
    }

    const deleted = await db
      .delete(locations)
      .where(sql`${locations.id} = ${id}`)
      .returning({ id: locations.id });
    if (!deleted[0]) return notFound("Location not found");

    await bumpGraphVersion(db);
    return jsonOk({ deleted: true, id, nodesRemoved: nodeIds.length });
  });
}
