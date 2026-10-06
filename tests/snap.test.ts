import { describe, expect, it } from "vitest";
import { offsetMetersToLatLng } from "@/lib/geo/haversine";
import { buildGraph } from "@/lib/routing/graph";
import {
  distanceToPolylineM,
  distanceToSegmentM,
  snapToNearestNode,
} from "@/lib/routing/snap";

const centre = { lat: 7.1566, lng: 3.3408 };

const p1 = offsetMetersToLatLng(centre, 0, 0);
const p2 = offsetMetersToLatLng(centre, 120, 0);

const graph = buildGraph(
  [
    { id: 1, latitude: p1.lat, longitude: p1.lng, label: "Centre" },
    { id: 2, latitude: p2.lat, longitude: p2.lng, label: "East point" },
  ],
  [{ id: 1, fromNode: 1, toNode: 2, distanceM: 120, pathType: "road" }],
);

describe("snapToNearestNode", () => {
  it("snaps a GPS fix to the closest graph node", () => {
    const fix = offsetMetersToLatLng(centre, 10, 4);
    const snapped = snapToNearestNode(graph, fix);
    expect(snapped?.node.id).toBe(1);
    expect(snapped?.offCampus).toBe(false);
    expect(snapped?.distanceM).toBeLessThan(15);
  });

  it("warns when the fix is further than the snap radius", () => {
    const fix = offsetMetersToLatLng(centre, 400, 400);
    const snapped = snapToNearestNode(graph, fix);
    expect(snapped?.offCampus).toBe(true);
    expect(snapped?.distanceM).toBeGreaterThan(150);
  });

  it("returns null for an empty graph", () => {
    expect(snapToNearestNode(buildGraph([], []), centre)).toBeNull();
  });
});

describe("polyline deviation", () => {
  const polyline = [
    offsetMetersToLatLng(centre, 0, 0),
    offsetMetersToLatLng(centre, 0, 100),
  ];

  it("measures 0 m for a point on the path", () => {
    const onPath = offsetMetersToLatLng(centre, 0, 50);
    expect(distanceToSegmentM(onPath, polyline[0], polyline[1])).toBeCloseTo(0, 0);
  });

  it("measures lateral offset for a point beside the path", () => {
    const beside = offsetMetersToLatLng(centre, 30, 50);
    const distance = distanceToSegmentM(beside, polyline[0], polyline[1]);
    expect(distance).toBeGreaterThan(25);
    expect(distance).toBeLessThan(35);
  });

  it("supports the 30 m re-routing rule", () => {
    const nearby = offsetMetersToLatLng(centre, 20, 50);
    const stray = offsetMetersToLatLng(centre, 80, 50);
    expect(distanceToPolylineM(nearby, polyline)).toBeLessThan(30);
    expect(distanceToPolylineM(stray, polyline)).toBeGreaterThan(30);
  });
});
