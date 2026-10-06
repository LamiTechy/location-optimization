import { describe, expect, it } from "vitest";
import {
  buildDirections,
  classifyTurn,
  type DirectionPathNode,
} from "@/lib/routing/directions";

function node(
  id: number,
  lat: number,
  lng: number,
  landmark?: string,
): DirectionPathNode {
  return { id, lat, lng, landmark: landmark ?? null };
}

describe("classifyTurn", () => {
  it("treats small bearing changes as straight", () => {
    expect(classifyTurn(0)).toBe("continue");
    expect(classifyTurn(10)).toBe("continue");
    expect(classifyTurn(-10)).toBe("continue");
  });

  it("classifies left and right turns", () => {
    expect(classifyTurn(90)).toBe("right");
    expect(classifyTurn(-90)).toBe("left");
    expect(classifyTurn(25)).toBe("slight-right");
    expect(classifyTurn(-25)).toBe("slight-left");
    expect(classifyTurn(130)).toBe("sharp-right");
    expect(classifyTurn(-170)).toBe("uturn");
  });
});

describe("buildDirections", () => {
  it("merges consecutive straight segments into one step", () => {
    const steps = buildDirections({
      // Three nodes heading due north: no turns, so one travel step + arrival.
      nodes: [
        node(1, 7.1566, 3.3408),
        node(2, 7.1576, 3.3408),
        node(3, 7.1586, 3.3408, "Polytechnic Library"),
      ],
      destinationName: "Polytechnic Library",
    });

    expect(steps).toHaveLength(2);
    expect(steps[0].type).toBe("depart");
    expect(steps[0].instruction).toContain("Head north");
    expect(steps[0].instruction).toContain("Polytechnic Library");
    // ~222 m for the two 111 m hops.
    expect(steps[0].distanceM).toBeGreaterThan(200);
    expect(steps[0].distanceM).toBeLessThan(240);
    expect(steps[1].type).toBe("arrive");
    expect(steps[1].instruction).toBe("Arrive at Polytechnic Library");
    expect(steps[1].distanceM).toBe(0);
  });

  it("turns a landmark into 'Turn <dir> at <place>'", () => {
    const steps = buildDirections({
      nodes: [
        node(1, 7.1566, 3.3408),
        node(2, 7.1576, 3.3408, "Library"),
        node(3, 7.1576, 3.3398), // heading west = left turn
      ],
      destinationName: "Administrative Block",
    });

    expect(steps.map((s) => s.type)).toEqual(["depart", "left", "arrive"]);
    expect(steps[1].instruction).toBe("Turn left at Library");
    expect(steps[1].lat).toBeCloseTo(7.1576, 4);
  });

  it("labels a right turn without a landmark", () => {
    const steps = buildDirections({
      nodes: [
        node(1, 7.1566, 3.3408),
        node(2, 7.1576, 3.3408),
        node(3, 7.1576, 3.3418), // heading east = right turn
      ],
      destinationName: "ICT Centre",
    });
    expect(steps[1].instruction).toBe("Turn right");
    expect(steps[1].type).toBe("right");
  });

  it("uses the first named place as the departure landmark", () => {
    const steps = buildDirections({
      nodes: [
        node(1, 7.1566, 3.3408), // unnamed junction
        node(2, 7.1566, 3.3418),
        node(3, 7.1576, 3.3418, "ICT Centre"),
      ],
      destinationName: "ICT Centre",
    });
    expect(steps[0].instruction).toBe("Head east toward ICT Centre");
  });

  it("always finishes with an arrival step", () => {
    const steps = buildDirections({
      nodes: [node(1, 7.1566, 3.3408), node(2, 7.1576, 3.3408)],
      destinationName: "Main Gate",
    });
    expect(steps.at(-1)?.type).toBe("arrive");
    expect(steps.at(-1)?.instruction).toBe("Arrive at Main Gate");
  });

  it("returns a single arrival step when start equals destination", () => {
    const steps = buildDirections({
      nodes: [node(1, 7.1566, 3.3408)],
      destinationName: "Main Gate",
    });
    expect(steps).toHaveLength(1);
    expect(steps[0].type).toBe("arrive");
    expect(steps[0].distanceM).toBe(0);
  });
});
