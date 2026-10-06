import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { edges, nodes } from "@/db/schema";
import { bumpGraphVersion, requireAdminRole } from "@/lib/services/admin";
import { handleRoute } from "@/lib/services/handle-route";
import { haversineMeters } from "@/lib/geo/haversine";
import { badRequest, forbidden, jsonOk, notFound } from "@/lib/services/response";
import { adminEdgeSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

async function nodeById(
  db: Awaited<ReturnType<typeof getDb>>,
  id: number,
): Promise<{ id: number; latitude: number; longitude: number } | null> {
  const rows = await db
    .select({
      id: nodes.id,
      latitude: nodes.latitude,
      longitude: nodes.longitude,
    })
    .from(nodes)
    .where(sql`${nodes.id} = ${id}`)
    .limit(1);
  return rows[0] ?? null;
}

/**
 * POST /api/admin/edges - connect two nodes.
 * `distanceM` is optional: when omitted it is measured with Haversine so the
 * stored weight always matches the drawn geometry.
 */
export async function POST(req: NextRequest): Promise<Response> {
  return handleRoute(async () => {
    const admin = await requireAdminRole();
    if (!admin) return forbidden();

    const parsed = adminEdgeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return badRequest("Check the edge fields", parsed.error.issues);
    }

    const db = await getDb();
    const from = await nodeById(db, parsed.data.fromNode);
    const to = await nodeById(db, parsed.data.toNode);
    if (!from || !to) return notFound("One of the nodes does not exist");
    if (from.id === to.id) return badRequest("An edge must connect two different nodes");

    const distance =
      parsed.data.distanceM ??
      Math.max(
        1,
        Math.round(
          haversineMeters(
            { lat: from.latitude, lng: from.longitude },
            { lat: to.latitude, lng: to.longitude },
          ),
        ),
      );

    const duplicate = await db
      .select({ id: edges.id })
      .from(edges)
      .where(
        sql`(${edges.fromNode} = ${from.id} and ${edges.toNode} = ${to.id}) or
            (${edges.fromNode} = ${to.id} and ${edges.toNode} = ${from.id})`,
      )
      .limit(1);
    if (duplicate[0]) return badRequest("These nodes are already connected");

    const created = await db
      .insert(edges)
      .values({
        fromNode: from.id,
        toNode: to.id,
        distanceM: distance,
        pathType: parsed.data.pathType,
        isBidirectional: parsed.data.isBidirectional,
        isActive: parsed.data.isActive,
      })
      .returning();

    await bumpGraphVersion(db);
    return jsonOk({ edge: created[0] }, { status: 201 });
  });
}

/** PATCH /api/admin/edges { id, ...fields } */
export async function PATCH(req: NextRequest): Promise<Response> {
  return handleRoute(async () => {
    const admin = await requireAdminRole();
    if (!admin) return forbidden();

    const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const id = Number(raw?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return badRequest("id must be a positive integer");
    }

    const parsed = adminEdgeSchema.partial().safeParse(
      Object.fromEntries(Object.entries(raw ?? {}).filter(([key]) => key !== "id")),
    );
    if (!parsed.success) {
      return badRequest("Check the edge fields", parsed.error.issues);
    }

    const db = await getDb();
    const updated = await db
      .update(edges)
      .set(parsed.data)
      .where(sql`${edges.id} = ${id}`)
      .returning();
    if (!updated[0]) return notFound("Edge not found");

    await bumpGraphVersion(db);
    return jsonOk({ edge: updated[0] });
  });
}

/** DELETE /api/admin/edges?id=5 */
export async function DELETE(req: NextRequest): Promise<Response> {
  return handleRoute(async () => {
    const admin = await requireAdminRole();
    if (!admin) return forbidden();

    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return badRequest("id must be a positive integer");
    }

    const db = await getDb();
    const deleted = await db
      .delete(edges)
      .where(sql`${edges.id} = ${id}`)
      .returning({ id: edges.id });
    if (!deleted[0]) return notFound("Edge not found");

    await bumpGraphVersion(db);
    return jsonOk({ deleted: true, id });
  });
}
