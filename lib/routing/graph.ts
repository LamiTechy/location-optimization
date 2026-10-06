import type { PathType } from "@/db/schema";
import { haversineMeters } from "@/lib/geo/haversine";
import type { LatLng } from "@/lib/geo/types";

/** Raw node row as read from the `nodes` table. */
export interface NodeInput {
  id: number;
  latitude: number;
  longitude: number;
  locationId?: number | null;
  label?: string | null;
}

/** Raw edge row as read from the `edges` table. */
export interface EdgeInput {
  id: number;
  fromNode: number;
  toNode: number;
  distanceM?: number | null;
  pathType: PathType;
  isBidirectional?: boolean;
  isActive?: boolean;
  /** Optional curved geometry: [[lat, lng], ...] excluding the endpoints. */
  geometry?: Array<[number, number]> | null;
}

export interface GraphNodeInfo {
  id: number;
  lat: number;
  lng: number;
  locationId: number | null;
  label: string | null;
}

/** One directed traversal of an edge (bidirectional edges produce two arcs). */
export interface GraphArc {
  edgeId: number;
  /** Node this arc leaves from (needed to orient curved geometry). */
  from: number;
  to: number;
  weight: number;
  pathType: PathType;
  /** Optional curved geometry as [[lat, lng], ...] excluding the endpoints. */
  geometry?: Array<[number, number]> | null;
}

export interface Graph {
  nodes: Map<number, GraphNodeInfo>;
  adjacency: Map<number, GraphArc[]>;
  edgeCount: number;
}

export interface BuildGraphOptions {
  /**
   * Drops `stairs` edges entirely. The route service retries without this
   * flag (and returns a warning) when no stair-free path exists.
   */
  avoidStairs?: boolean;
}

export function buildGraph(
  nodes: NodeInput[],
  edges: EdgeInput[],
  options: BuildGraphOptions = {},
): Graph {
  const nodeMap = new Map<number, GraphNodeInfo>();
  for (const node of nodes) {
    nodeMap.set(node.id, {
      id: node.id,
      lat: node.latitude,
      lng: node.longitude,
      locationId: node.locationId ?? null,
      label: node.label ?? null,
    });
  }

  const adjacency = new Map<number, GraphArc[]>();
  const push = (from: number, arc: GraphArc) => {
    const list = adjacency.get(from);
    if (list) list.push(arc);
    else adjacency.set(from, [arc]);
  };

  // Guarantee every node has an adjacency entry (isolated nodes are valid).
  for (const node of nodeMap.keys()) adjacency.set(node, []);

  let edgeCount = 0;
  for (const edge of edges) {
    if (edge.isActive === false) continue;
    if (options.avoidStairs && edge.pathType === "stairs") continue;

    const from = nodeMap.get(edge.fromNode);
    const to = nodeMap.get(edge.toNode);
    if (!from || !to) continue; // dangling reference - never crash a route

    // Distance comes from the table; fall back to Haversine when absent.
    const weight =
      typeof edge.distanceM === "number" && edge.distanceM > 0
        ? edge.distanceM
        : haversineMeters({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng });

    edgeCount += 1;
    push(edge.fromNode, {
      edgeId: edge.id,
      from: edge.fromNode,
      to: edge.toNode,
      weight,
      pathType: edge.pathType,
      geometry: edge.geometry ?? null,
    });

    if (edge.isBidirectional !== false) {
      push(edge.toNode, {
        edgeId: edge.id,
        from: edge.toNode,
        to: edge.fromNode,
        weight,
        pathType: edge.pathType,
        // Reverse the curved geometry so it still runs along the travel
        // direction when the edge is traversed backwards.
        geometry: edge.geometry ? [...edge.geometry].reverse() : null,
      });
    }
  }

  return { nodes: nodeMap, adjacency, edgeCount };
}

export function getArcs(graph: Graph, nodeId: number): GraphArc[] {
  return graph.adjacency.get(nodeId) ?? [];
}

export function graphIsEmpty(graph: Graph): boolean {
  return graph.nodes.size === 0;
}

export function toLatLng(node: GraphNodeInfo): LatLng {
  return { lat: node.lat, lng: node.lng };
}
