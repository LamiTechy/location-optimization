import { OFF_CAMPUS_SNAP_RADIUS_M } from "@/lib/config";
import { haversineMeters } from "@/lib/geo/haversine";
import type { LatLng } from "@/lib/geo/types";
import type { Graph, GraphNodeInfo } from "./graph";

export interface SnapResult {
  node: GraphNodeInfo;
  distanceM: number;
  /** True when the fix is further than the snap radius (user may be off campus). */
  offCampus: boolean;
}

/**
 * Snaps a raw GPS reading (or any picked coordinate) to the nearest node of
 * the routing graph - Dijkstra can only start/end at graph nodes.
 *
 * Returns null only when the graph has no nodes at all.
 */
export function snapToNearestNode(
  graph: Graph,
  point: LatLng,
  options: { maxDistanceM?: number } = {},
): SnapResult | null {
  const maxDistanceM = options.maxDistanceM ?? OFF_CAMPUS_SNAP_RADIUS_M;
  let best: GraphNodeInfo | null = null;
  let bestDistance = Infinity;

  for (const node of graph.nodes.values()) {
    const distance = haversineMeters(point, { lat: node.lat, lng: node.lng });
    if (distance < bestDistance) {
      bestDistance = distance;
      best = node;
    }
  }

  if (!best) return null;
  return {
    node: best,
    distanceM: Math.round(bestDistance * 10) / 10,
    offCampus: bestDistance > maxDistanceM,
  };
}

/**
 * Perpendicular distance (metres) from `point` to the segment a->b.
 *
 * Uses a local equirectangular projection - exact enough at campus scale
 * (< 1 km) and cheap enough to call on every GPS update while navigating.
 */
export function distanceToSegmentM(point: LatLng, a: LatLng, b: LatLng): number {
  const latRef = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const metersPerDegLat = 111_320;
  const metersPerDegLng = 111_320 * Math.cos(latRef);

  const ax = a.lng * metersPerDegLng;
  const ay = a.lat * metersPerDegLat;
  const bx = b.lng * metersPerDegLng;
  const by = b.lat * metersPerDegLat;
  const px = point.lng * metersPerDegLng;
  const py = point.lat * metersPerDegLat;

  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) return Math.hypot(px - ax, py - ay);

  let t = ((px - ax) * dx + (py - ay) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  return Math.hypot(px - closestX, py - closestY);
}

/**
 * Smallest distance from a point to a whole polyline, used to detect when a
 * walking user has strayed far enough from the plan to need re-routing.
 */
export function distanceToPolylineM(point: LatLng, polyline: LatLng[]): number {
  if (polyline.length === 0) return Infinity;
  if (polyline.length === 1) return haversineMeters(point, polyline[0]);

  let best = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = distanceToSegmentM(point, polyline[i], polyline[i + 1]);
    if (d < best) best = d;
  }
  return best;
}
