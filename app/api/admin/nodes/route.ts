import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { nodes } from "@/db/schema";
import { bumpGraphVersion, requireAdminRole } from "@/lib/services/admin";
import { handleRoute } from "@/lib/services/handle-route";
import { badRequest, forbidden, jsonOk, notFound } from "@/lib/services/response";
import { adminNodeSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/** POST /api/admin/nodes - add a junction or entrance to the graph. */
export async function POST(req: NextRequest): Promise<Response> {
  return handleRoute(async () => {
    const admin = await requireAdminRole();
    if (!admin) return forbidden();

    const parsed = adminNodeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return badRequest("Check the node fields", parsed.error.issues);
    }

    const db = await getDb();
    const created = await db
      .insert(nodes)
      .values({
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        locationId: parsed.data.locationId ?? null,
        label: parsed.data.label ?? null,
      })
      .returning();

    await bumpGraphVersion(db);
    return jsonOk({ node: created[0] }, { status: 201 });
  });
}

/** PATCH /api/admin/nodes { id, latitude?, longitude?, label?, locationId? } */
export async function PATCH(req: NextRequest): Promise<Response> {
  return handleRoute(async () => {
    const admin = await requireAdminRole();
    if (!admin) return forbidden();

    const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const id = Number(raw?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return badRequest("id must be a positive integer");
    }

    const parsed = adminNodeSchema.partial().safeParse(
      Object.fromEntries(Object.entries(raw ?? {}).filter(([key]) => key !== "id")),
    );
    if (!parsed.success) {
      return badRequest("Check the node fields", parsed.error.issues);
    }

    const db = await getDb();
    const updated = await db
      .update(nodes)
      .set(parsed.data)
      .where(sql`${nodes.id} = ${id}`)
      .returning();
    if (!updated[0]) return notFound("Node not found");

    await bumpGraphVersion(db);
    return jsonOk({ node: updated[0] });
  });
}

/** DELETE /api/admin/nodes?id=5 (connected edges cascade) */
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
      .delete(nodes)
      .where(sql`${nodes.id} = ${id}`)
      .returning({ id: nodes.id });
    if (!deleted[0]) return notFound("Node not found");

    await bumpGraphVersion(db);
    return jsonOk({ deleted: true, id });
  });
}
