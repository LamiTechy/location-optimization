import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { locations, nodes as nodesTable, routeHistory } from "@/db/schema";
import { OFF_CAMPUS_SNAP_RADIUS_M } from "@/lib/config";
import { walkingMinutes, walkingSeconds } from "@/lib/geo/eta";
import type { LatLng } from "@/lib/geo/types";
import { buildDirections, type DirectionStep } from "@/lib/routing/directions";
import { dijkstra } from "@/lib/routing/dijkstra";
import type { Graph, GraphArc, GraphNodeInfo } from "@/lib/routing/graph";
import { snapToNearestNode } from "@/lib/routing/snap";
import type { RouteRequest } from "@/lib/validators";
import { loadGraph } from "./graph-cache";

export interface RouteEndpoint {
  id: number | null;
  name: string;
  lat: number;
  lng: number;
}

export interface RouteSuccess {
  ok: true;
  distanceM: number;
  durationMin: number;
  durationSec: number;
  /** Ordered [lat, lng] pairs forming the drawn polyline. */
  path: Array<[number, number]>;
  steps: DirectionStep[];
  from: RouteEndpoint;
  to: RouteEndpoint;
  warnings: string[];
  fromNodeId: number;
  toNodeId: number;
}

export type RouteFailure = {
  ok: false;
  code:
    | "UNKNOWN_LOCATION"
    | "NO_ROUTE"
    | "EMPTY_GRAPH"
    | "UNKNOWN_START"
    | "UNKNOWN_DESTINATION";
  message: string;
  status: number;
};

export type RouteOutcome = RouteSuccess | RouteFailure;

export interface ComputeRouteOptions {
  userId?: number | null;
  /** Persist a route_history row (default true when userId is present). */
  recordHistory?: boolean;
}

interface ResolvedEndpoint {
  nodeId: number;
  point: LatLng;
  name: string;
  locationId: number | null;
  warnings: string[];
}

function failure(code: RouteFailure["code"], message: string, status: number): RouteFailure {
  return { ok: false, code, message, status };
}

async function resolveEndpoint(
  db: Db,
  graph: Graph,
  point: NonNullable<RouteRequest["from"]>,
  label: "start" | "destination",
): Promise<ResolvedEndpoint | RouteFailure> {
  const warnings: string[] = [];

  if (point.type === "location") {
    const rows = await db
      .select()
      .from(locations)
      .where(sql`${locations.id} = ${point.id}`)
      .limit(1);
    const location = rows[0];
    if (!location) {
      return failure(
        "UNKNOWN_LOCATION",
        label === "start"
          ? "Start location not found"
          : "Destination not found",
        404,
      );
    }

    const attached = await db
      .select({
        id: nodesTable.id,
        latitude: nodesTable.latitude,
        longitude: nodesTable.longitude,
      })
      .from(nodesTable)
      .where(sql`${nodesTable.locationId} = ${location.id}`)
      .limit(1);

    const locationPoint = { lat: location.latitude, lng: location.longitude };

    if (attached[0]) {
      return {
        nodeId: attached[0].id,
        point: locationPoint,
        name: location.name,
        locationId: location.id,
        warnings,
      };
    }

    // No dedicated node yet (admin created a location without connecting it).
    const snapped = snapToNearestNode(graph, locationPoint);
    if (!snapped) {
      return failure("EMPTY_GRAPH", "The campus graph is empty", 500);
    }
    warnings.push(
      `"${location.name}" is not connected to the walkway network yet - using the nearest junction.`,
    );
    return {
      nodeId: snapped.node.id,
      point: locationPoint,
      name: location.name,
      locationId: location.id,
      warnings,
    };
  }

  const gpsPoint = { lat: point.lat, lng: point.lng };
  const snapped = snapToNearestNode(graph, gpsPoint);
  if (!snapped) {
    return failure("EMPTY_GRAPH", "The campus graph is empty", 500);
  }
  if (snapped.offCampus) {
    warnings.push(
      `Your location is ${Math.round(snapped.distanceM)} m from the nearest campus path (over ${OFF_CAMPUS_SNAP_RADIUS_M} m) - you may be off campus.`,
    );
  }

  return {
    nodeId: snapped.node.id,
    point: gpsPoint,
    name: label === "start" ? "Your location" : "Selected point",
    locationId: null,
    warnings,
  };
}

/**
 * Application-layer route optimization (report Figure 3.2):
 * resolve endpoints -> load graph -> Dijkstra -> polyline + directions.
 *
 * Never throws: failures come back as `{ ok: false, code, status }` so the
 * route handler can translate them straight into HTTP responses.
 */
export async function computeRoute(
  db: Db,
  request: RouteRequest,
  options: ComputeRouteOptions = {},
): Promise<RouteOutcome> {
  const warnings: string[] = [];
  const avoidStairs = request.avoidStairs ?? false;

  let loaded = await loadGraph(db, { avoidStairs });

  const start = await resolveEndpoint(db, loaded.graph, request.from, "start");
  if ("ok" in start) return start;
  const end = await resolveEndpoint(db, loaded.graph, request.to, "destination");
  if ("ok" in end) return end;
  warnings.push(...start.warnings, ...end.warnings);

  let result = dijkstra(loaded.graph, start.nodeId, end.nodeId);

  // Stairs were avoided but no alternative exists: retry including stairs and
  // tell the user why (spec: "fall back if no other route exists").
  if (!result.ok && result.code === "NO_ROUTE" && avoidStairs) {
    loaded = await loadGraph(db, { avoidStairs: false });
    const retry = dijkstra(loaded.graph, start.nodeId, end.nodeId);
    if (retry.ok) {
      result = retry;
      warnings.push(
        "No stair-free path exists - this route includes stairs.",
      );
    }
  }

  if (!result.ok) {
    switch (result.code) {
      case "EMPTY_GRAPH":
        return failure("EMPTY_GRAPH", "The campus graph is empty", 500);
      case "NO_ROUTE":
        return failure(
          "NO_ROUTE",
          "No walking path connects these places right now",
          404,
        );
      case "UNKNOWN_START":
      case "UNKNOWN_DESTINATION":
        return failure(
          result.code,
          "One of the selected points is not on the campus network",
          404,
        );
    }
  }

  const path = result.path;
  const pathNodes: GraphNodeInfo[] = path
    .map((id) => loaded.graph.nodes.get(id))
    .filter((node): node is GraphNodeInfo => Boolean(node));

  if (pathNodes.length < 2) {
    return failure(
      "NO_ROUTE",
      "Start and destination are the same place",
      400,
    );
  }

  /* Polyline: merge each edge's geometry so curves are followed exactly. */
  const polyline: Array<[number, number]> = [
    [pathNodes[0].lat, pathNodes[0].lng],
  ];
  const edgePathTypes: Array<GraphArc["pathType"]> = [];

  for (let i = 0; i < result.edges.length; i++) {
    const fromId = path[i];
    const toId = path[i + 1];
    const arc = loaded.graph.adjacency
      .get(fromId)
      ?.find(
        (candidate) =>
          candidate.edgeId === result.edges[i] && candidate.to === toId,
      );
    if (!arc) continue;
    edgePathTypes.push(arc.pathType);
    if (arc.geometry) {
      for (const [lat, lng] of arc.geometry) polyline.push([lat, lng]);
    }
    const toNode = loaded.graph.nodes.get(toId);
    if (toNode) polyline.push([toNode.lat, toNode.lng]);
  }

  /* Landmarks: prefer the live location name over a stale node label. */
  const locationIds = [
    ...new Set(
      pathNodes
        .map((node) => node.locationId)
        .filter((id): id is number => typeof id === "number"),
    ),
  ];
  const landmarkNames = new Map<number, string>();
  if (locationIds.length > 0) {
    const placeRows = await db
      .select({ id: locations.id, name: locations.name })
      .from(locations)
      .where(sql`${locations.id} in (${sql.join(locationIds.map((id) => sql`${id}`), sql`, `)})`);
    for (const row of placeRows) landmarkNames.set(row.id, row.name);
  }

  const directionNodes = pathNodes.map((node) => ({
    id: node.id,
    lat: node.lat,
    lng: node.lng,
    landmark: node.locationId
      ? (landmarkNames.get(node.locationId) ?? node.label)
      : node.label,
  }));

  const steps = buildDirections({
    nodes: directionNodes,
    edgePathTypes,
    destinationName: end.name,
  });

  const distanceM = Math.round(result.distanceM * 10) / 10;
  const speed = request.walkingSpeedMps ?? 1.4;

  const success: RouteSuccess = {
    ok: true,
    distanceM,
    durationMin: walkingMinutes(distanceM, speed),
    durationSec: Math.round(walkingSeconds(distanceM, speed)),
    path: polyline,
    steps,
    from: {
      id: start.locationId,
      name: start.name,
      lat: start.point.lat,
      lng: start.point.lng,
    },
    to: {
      id: end.locationId,
      name: end.name,
      lat: end.point.lat,
      lng: end.point.lng,
    },
    warnings,
    fromNodeId: start.nodeId,
    toNodeId: end.nodeId,
  };

  if (options.userId && options.recordHistory !== false) {
    await db
      .insert(routeHistory)
      .values({
        userId: options.userId,
        fromLocationId: start.locationId,
        fromLat: start.locationId ? null : start.point.lat,
        fromLng: start.locationId ? null : start.point.lng,
        toLocationId: end.locationId,
        distanceM: success.distanceM,
        durationMin: success.durationMin,
      })
      .catch((error: unknown) => {
        // History is never worth failing a route request for.
        console.error("[route] could not write history:", error);
      });
  }

  return success;
}
