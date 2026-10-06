import { asc, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { edges, graphMeta, locations, nodes } from "@/db/schema";
import { requireAdminRole } from "@/lib/services/admin";
import { handleRoute } from "@/lib/services/handle-route";
import { forbidden, jsonOk } from "@/lib/services/response";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/graph - the full walkway graph (nodes + edges) for the map
 * editor, joined with location names so the panel can label entrance nodes.
 */
export async function GET(): Promise<Response> {
  return handleRoute(async () => {
    const admin = await requireAdminRole();
    if (!admin) return forbidden();

    const db = await getDb();
    const [nodeRows, edgeRows, versionRows] = await Promise.all([
      db
        .select({
          id: nodes.id,
          latitude: nodes.latitude,
          longitude: nodes.longitude,
          label: nodes.label,
          locationId: nodes.locationId,
          locationName: locations.name,
        })
        .from(nodes)
        .leftJoin(locations, sql`${locations.id} = ${nodes.locationId}`)
        .orderBy(asc(nodes.id)),
      db.select().from(edges).orderBy(asc(edges.id)),
      db.select({ version: graphMeta.version }).from(graphMeta).limit(1),
    ]);

    return jsonOk({
      nodes: nodeRows.map((row) => ({
        id: row.id,
        latitude: row.latitude,
        longitude: row.longitude,
        label: row.label,
        locationId: row.locationId,
        locationName: row.locationName,
      })),
      edges: edgeRows.map((row) => ({
        id: row.id,
        fromNode: row.fromNode,
        toNode: row.toNode,
        distanceM: row.distanceM,
        pathType: row.pathType,
        isBidirectional: row.isBidirectional,
        isActive: row.isActive,
      })),
      version: versionRows[0]?.version ?? 0,
    });
  });
}
