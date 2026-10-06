import { getArcs, graphIsEmpty, type Graph } from "./graph";
import { MinHeap } from "./min-heap";

export type DijkstraErrorCode =
  | "EMPTY_GRAPH"
  | "UNKNOWN_START"
  | "UNKNOWN_DESTINATION"
  | "NO_ROUTE";

export type DijkstraResult =
  | {
      ok: true;
      /** Ordered node ids from start to destination. */
      path: number[];
      /** Ordered edge ids used between those nodes (path.length - 1 items). */
      edges: number[];
      /** Total weight (metres) of the path. */
      distanceM: number;
    }
  | { ok: false; code: DijkstraErrorCode };

/**
 * Classic Dijkstra's algorithm over the campus graph.
 *
 * Complexity: **O((V + E) log V)** thanks to the binary min-heap priority
 * queue - each node is inserted and extracted at most once (log V per
 * operation) and each adjacency arc is relaxed at most once.
 *
 * Design decisions:
 * - weights are edge lengths in metres, so the shortest distance is the
 *   shortest *walking* distance;
 * - the search stops as soon as the destination node is popped from the heap
 *   (at that moment its distance is final - the "early exit" optimisation);
 * - results are a discriminated union, never exceptions, so route handlers can
 *   translate failures into clean HTTP status codes.
 *
 * Handles every edge case from the test plan: start equals destination,
 * unreachable destination, unknown node ids and an empty graph.
 */
export function dijkstra(
  graph: Graph,
  startId: number,
  endId: number,
): DijkstraResult {
  if (graphIsEmpty(graph)) return { ok: false, code: "EMPTY_GRAPH" };
  if (!graph.nodes.has(startId)) return { ok: false, code: "UNKNOWN_START" };
  if (!graph.nodes.has(endId)) return { ok: false, code: "UNKNOWN_DESTINATION" };

  if (startId === endId) {
    return { ok: true, path: [startId], edges: [], distanceM: 0 };
  }

  const dist = new Map<number, number>();
  const prev = new Map<number, { from: number; edgeId: number }>();
  const visited = new Set<number>();

  const heap = new MinHeap<{ id: number; d: number }>((a, b) => a.d - b.d);
  dist.set(startId, 0);
  heap.push({ id: startId, d: 0 });

  while (heap.size > 0) {
    const current = heap.pop()!;
    if (visited.has(current.id)) continue; // stale heap entry
    visited.add(current.id);

    // Early exit: the destination's shortest distance is final once popped.
    if (current.id === endId) {
      return reconstruct(prev, startId, endId, current.d);
    }

    for (const arc of getArcs(graph, current.id)) {
      if (visited.has(arc.to)) continue;
      const candidate = current.d + arc.weight;
      const known = dist.get(arc.to);
      if (known === undefined || candidate < known) {
        dist.set(arc.to, candidate);
        prev.set(arc.to, { from: current.id, edgeId: arc.edgeId });
        heap.push({ id: arc.to, d: candidate });
      }
    }
  }

  return { ok: false, code: "NO_ROUTE" };
}

function reconstruct(
  prev: Map<number, { from: number; edgeId: number }>,
  startId: number,
  endId: number,
  distanceM: number,
): DijkstraResult {
  const path: number[] = [endId];
  const edges: number[] = [];
  let cursor = endId;

  while (cursor !== startId) {
    const step = prev.get(cursor);
    if (!step) return { ok: false, code: "NO_ROUTE" };
    edges.unshift(step.edgeId);
    path.unshift(step.from);
    cursor = step.from;
  }

  return { ok: true, path, edges, distanceM };
}
