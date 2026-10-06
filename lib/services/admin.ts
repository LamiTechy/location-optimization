import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { getSessionWithRole } from "@/lib/auth/session";
import {
  edges,
  feedback,
  graphMeta,
  locations,
  nodes,
  routeHistory,
  users,
} from "@/db/schema";
import { haversineMeters } from "@/lib/geo/haversine";
import type { Graph } from "@/lib/routing/graph";
import { loadGraph, invalidateGraphCache } from "./graph-cache";

/** Every admin API handler starts with this guard (role re-checked server side). */
export async function requireAdminRole(): Promise<{ id: number } | null> {
  const session = await getSessionWithRole(["admin"]);
  return session ? { id: Number(session.sub) } : null;
}

/**
 * Invalidates the routing cache by bumping `graph_meta.version`.
 * Called after every node/edge edit from the admin map editor.
 */
export async function bumpGraphVersion(db: Db): Promise<number> {
  const rows = await db
    .update(graphMeta)
    .set({ updatedAt: new Date(), version: sql`${graphMeta.version} + 1` })
    .returning({ version: graphMeta.version });

  if (rows[0]) {
    invalidateGraphCache();
    return rows[0].version;
  }

  await db.insert(graphMeta).values({ version: 1 }).onConflictDoNothing();
  invalidateGraphCache();
  return 1;
}

/** Nearest existing graph node to a coordinate, used to auto-connect new places. */
export async function nearestNode(
  db: Db,
  latitude: number,
  longitude: number,
): Promise<{ id: number; latitude: number; longitude: number } | null> {
  const rows = await db
    .select({
      id: nodes.id,
      latitude: nodes.latitude,
      longitude: nodes.longitude,
    })
    .from(nodes)
    .limit(500);

  let best: { id: number; latitude: number; longitude: number } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    const distance = haversineMeters(
      { lat: latitude, lng: longitude },
      { lat: row.latitude, lng: row.longitude },
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = row;
    }
  }
  return best;
}

export interface AdminStats {
  users: number;
  admins: number;
  locations: number;
  activeLocations: number;
  nodes: number;
  edges: number;
  activeEdges: number;
  routes: number;
  averageDistanceM: number | null;
  averageRating: number | null;
  feedbackCount: number;
  graphVersion: number;
  reachableNodes: number;
  connected: boolean;
}

/**
 * Dashboard numbers for the admin overview, including a live connectivity
 * check (report: "the graph must stay fully connected").
 */
export async function adminStats(db: Db): Promise<AdminStats> {
  const [userRows, locationRows, nodeRows, edgeRows, routeRows, feedbackRows] =
    await Promise.all([
      db.select({ role: users.role }).from(users),
      db.select({ isActive: locations.isActive }).from(locations),
      db.select({ id: nodes.id }).from(nodes),
      db.select({ isActive: edges.isActive, from: edges.fromNode, to: edges.toNode }).from(edges),
      db.select({ distanceM: routeHistory.distanceM }).from(routeHistory),
      db.select({ rating: feedback.rating }).from(feedback),
    ]);

  const { graph } = await loadGraph(db);
  const reachable = countReachable(graph);
  const versionRows = await db
    .select({ version: graphMeta.version })
    .from(graphMeta)
    .limit(1);

  const distances = routeRows.map((row) => row.distanceM);
  const ratings = feedbackRows.map((row) => row.rating);

  return {
    users: userRows.length,
    admins: userRows.filter((row) => row.role === "admin").length,
    locations: locationRows.length,
    activeLocations: locationRows.filter((row) => row.isActive).length,
    nodes: nodeRows.length,
    edges: edgeRows.length,
    activeEdges: edgeRows.filter((row) => row.isActive).length,
    routes: routeRows.length,
    averageDistanceM:
      distances.length > 0
        ? Math.round((distances.reduce((a, b) => a + b, 0) / distances.length) * 10) / 10
        : null,
    averageRating:
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null,
    feedbackCount: feedbackRows.length,
    graphVersion: versionRows[0]?.version ?? 0,
    reachableNodes: reachable,
    connected: nodeRows.length > 0 && reachable === nodeRows.length,
  };
}

/** Breadth-first reachability over the walkable graph. */
function countReachable(graph: Graph): number {
  const start = graph.nodes.keys().next().value;
  if (start === undefined) return 0;

  const seen = new Set<number>();
  const queue = [start];
  seen.add(start);

  while (queue.length > 0) {
    const current = queue.pop() as number;
    for (const arc of graph.adjacency.get(current) ?? []) {
      if (!seen.has(arc.to)) {
        seen.add(arc.to);
        queue.push(arc.to);
      }
    }
  }
  return seen.size;
}
