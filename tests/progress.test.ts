import { describe, expect, it } from "vitest";
import {
  activeStepIndex,
  deviationMeters,
  hasArrived,
  nearestPathIndex,
  remainingDistance,
} from "@/lib/routing/progress";

const path: Array<[number, number]> = [
  [7.15, 3.34],
  [7.151, 3.34],
  [7.152, 3.34],
  [7.153, 3.34],
];

describe("nearestPathIndex", () => {
  it("returns the closest vertex", () => {
    expect(nearestPathIndex(path, { lat: 7.1529, lng: 3.3401 })).toBe(3);
    expect(nearestPathIndex(path, { lat: 7.15, lng: 3.34 })).toBe(0);
  });

  it("handles an empty path", () => {
    expect(nearestPathIndex([], { lat: 0, lng: 0 })).toBe(-1);
  });
});

describe("remainingDistance", () => {
  it("shrinks as the walker advances", () => {
    const total = remainingDistance(path, 0);
    const halfway = remainingDistance(path, 2);
    expect(total).toBeGreaterThan(halfway);
    expect(halfway).toBeGreaterThan(0);
    expect(remainingDistance(path, path.length - 1)).toBe(0);
  });
});

describe("deviationMeters / hasArrived", () => {
  it("detects being on the path", () => {
    expect(deviationMeters(path, { lat: 7.151, lng: 3.34 })).toBeLessThan(1);
  });

  it("detects straying 50 m from the path", () => {
    // ~0.0005 degrees of latitude is roughly 55 m.
    expect(deviationMeters(path, { lat: 7.1515, lng: 3.3405 })).toBeGreaterThan(30);
  });

  it("detects arrival within the radius", () => {
    const destination = { lat: 7.153, lng: 3.34 };
    expect(hasArrived({ lat: 7.15305, lng: 3.34 }, destination, 15)).toBe(true);
    expect(hasArrived({ lat: 7.15, lng: 3.34 }, destination, 15)).toBe(false);
  });
});

describe("activeStepIndex", () => {
  const steps = [
    { lat: 7.15, lng: 3.34 },
    { lat: 7.152, lng: 3.34 },
    { lat: 7.153, lng: 3.34 },
  ];

  it("starts on the first instruction", () => {
    expect(activeStepIndex(steps, path, 0)).toBe(0);
  });

  it("advances once the walker passes a step", () => {
    expect(activeStepIndex(steps, path, 2)).toBe(1);
    expect(activeStepIndex(steps, path, 3)).toBe(2);
  });
});
