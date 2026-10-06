import { describe, expect, it } from "vitest";
import { dijkstra } from "@/lib/routing/dijkstra";
import {
  buildGraph,
  type EdgeInput,
  type NodeInput,
} from "@/lib/routing/graph";

/** Nodes placed along a small grid so Haversine fallbacks stay realistic. */
function node(id: number, latOffset = 0, lngOffset = 0): NodeInput {
  return {
    id,
    latitude: 7.1566 + latOffset,
    longitude: 3.3408 + lngOffset,
    label: `n${id}`,
  };
}

function edge(
  id: number,
  fromNode: number,
  toNode: number,
  distanceM: number | null,
  overrides: Partial<EdgeInput> = {},
): EdgeInput {
  return {
    id,
    fromNode,
    toNode,
    distanceM,
    pathType: "road",
    isBidirectional: true,
    isActive: true,
    ...overrides,
  };
}

/**
 * Hand-verifiable reference graph (see docs/ALGORITHM.md):
 *
 *      1 --1-- 2
 *      |       |
 *      4       5
 *      |       |
 *      3 --1-- 4
 *
 * Shortest 1 -> 4 is 1-2-3-4? No: 1-3-4 costs 5, 1-2-4 costs 6 and
 * 1-2-3-4 costs 1 + 2 + 1 = 4, which the test asserts.
 */
const referenceGraph = () =>
  buildGraph(
    [node(1), node(2), node(3), node(4), node(5)],
    [
      edge(11, 1, 2, 1),
      edge(12, 1, 3, 4),
      edge(13, 2, 3, 2),
      edge(14, 3, 4, 1),
      edge(15, 2, 4, 5),
    ],
  );

describe("dijkstra - shortest path", () => {
  it("finds the true shortest path and its length", () => {
    const result = dijkstra(referenceGraph(), 1, 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.path).toEqual([1, 2, 3, 4]);
    expect(result.distanceM).toBe(4);
    expect(result.edges).toEqual([11, 13, 14]);
  });

  it("returns one of two equally short paths in a tie", () => {
    const graph = buildGraph(
      [node(1), node(2), node(3), node(4)],
      [
        edge(1, 1, 2, 1),
        edge(2, 1, 3, 1),
        edge(3, 2, 4, 1),
        edge(4, 3, 4, 1),
      ],
    );
    const result = dijkstra(graph, 1, 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.distanceM).toBe(2);
    expect([
      [1, 2, 4],
      [1, 3, 4],
    ]).toContainEqual(result.path);
  });

  it("computes distance when the edge distance is missing (Haversine)", () => {
    const graph = buildGraph([node(1, 0.001), node(2)], [edge(1, 1, 2, null)]);
    const result = dijkstra(graph, 1, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.distanceM).toBeGreaterThan(105);
    expect(result.distanceM).toBeLessThan(117);
  });
});

describe("dijkstra - edge cases", () => {
  it("handles start equal to destination", () => {
    const result = dijkstra(referenceGraph(), 1, 1);
    expect(result).toEqual({ ok: true, path: [1], edges: [], distanceM: 0 });
  });

  it("reports an unreachable destination", () => {
    const graph = buildGraph(
      [node(1), node(2), node(3)],
      [edge(1, 1, 2, 5)], // node 3 is isolated
    );
    expect(dijkstra(graph, 1, 3)).toEqual({ ok: false, code: "NO_ROUTE" });
  });

  it("reports unknown node ids", () => {
    expect(dijkstra(referenceGraph(), 99, 1)).toEqual({
      ok: false,
      code: "UNKNOWN_START",
    });
    expect(dijkstra(referenceGraph(), 1, 99)).toEqual({
      ok: false,
      code: "UNKNOWN_DESTINATION",
    });
  });

  it("reports an empty graph", () => {
    expect(dijkstra(buildGraph([], []), 1, 2)).toEqual({
      ok: false,
      code: "EMPTY_GRAPH",
    });
  });
});

describe("dijkstra - directed and filtered edges", () => {
  it("only allows one-way edges in their declared direction", () => {
    const graph = buildGraph(
      [node(1), node(2)],
      [edge(1, 1, 2, 10, { isBidirectional: false })],
    );
    expect(dijkstra(graph, 1, 2).ok).toBe(true);
    expect(dijkstra(graph, 2, 1)).toEqual({ ok: false, code: "NO_ROUTE" });
  });

  it("ignores inactive edges (blocked roads)", () => {
    const graph = buildGraph(
      [node(1), node(2)],
      [edge(1, 1, 2, 10, { isActive: false })],
    );
    expect(dijkstra(graph, 1, 2)).toEqual({ ok: false, code: "NO_ROUTE" });
  });

  it("prefers a detour over stairs when avoidStairs is set", () => {
    const graph = (avoidStairs: boolean) =>
      buildGraph(
        [node(1), node(2), node(3)],
        [
          edge(1, 1, 2, 10),
          edge(2, 2, 3, 10),
          edge(3, 1, 3, 5, { pathType: "stairs" }),
        ],
        { avoidStairs },
      );

    const withStairs = dijkstra(graph(false), 1, 3);
    expect(withStairs.ok && withStairs.distanceM).toBe(5);

    const withoutStairs = dijkstra(graph(true), 1, 3);
    expect(withoutStairs.ok).toBe(true);
    if (withoutStairs.ok) {
      expect(withoutStairs.path).toEqual([1, 2, 3]);
      expect(withoutStairs.distanceM).toBe(20);
    }
  });

  it("returns NO_ROUTE when the only link is stairs and they are avoided", () => {
    const graph = buildGraph(
      [node(1), node(2)],
      [edge(1, 1, 2, 10, { pathType: "stairs" })],
      { avoidStairs: true },
    );
    expect(dijkstra(graph, 1, 2)).toEqual({ ok: false, code: "NO_ROUTE" });
  });
});
