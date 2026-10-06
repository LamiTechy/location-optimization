import { describe, expect, it } from "vitest";
import { bearingDegrees, bearingDelta, compassWord } from "@/lib/geo/bearing";
import {
  formatDistance,
  formatWalkingTime,
  walkingMinutes,
} from "@/lib/geo/eta";
import {
  haversineMeters,
  latLngToOffsetMeters,
  offsetMetersToLatLng,
} from "@/lib/geo/haversine";

const A = { lat: 7.1566, lng: 3.3408 };

describe("haversineMeters", () => {
  it("measures one degree of latitude as ~111.19 km", () => {
    const distance = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(distance).toBeGreaterThan(111_000);
    expect(distance).toBeLessThan(111_400);
  });

  it("returns 0 for identical points", () => {
    expect(haversineMeters(A, A)).toBe(0);
  });

  it("is symmetric", () => {
    const b = { lat: 7.1575, lng: 3.3421 };
    expect(haversineMeters(A, b)).toBeCloseTo(haversineMeters(b, A), 6);
  });

  it("matches a known short campus-scale distance", () => {
    // 100 m due north of the campus centre.
    const b = offsetMetersToLatLng(A, 0, 100);
    expect(haversineMeters(A, b)).toBeCloseTo(100, 0);
  });
});

describe("coordinate offsets", () => {
  it("round-trips metre offsets", () => {
    const point = offsetMetersToLatLng(A, 250, -130);
    const offset = latLngToOffsetMeters(A, point);
    expect(offset.x).toBeCloseTo(250, 2);
    expect(offset.y).toBeCloseTo(-130, 2);
  });
});

describe("bearing", () => {
  it("points north when moving towards higher latitude", () => {
    expect(bearingDegrees({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(0, 1);
  });

  it("points east when moving towards higher longitude", () => {
    expect(bearingDegrees({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90, 1);
  });

  it("normalises deltas to [-180, 180)", () => {
    expect(bearingDelta(350, 10)).toBe(20);
    expect(bearingDelta(10, 350)).toBe(-20);
    expect(bearingDelta(0, 180)).toBe(-180); // range is [-180, 180)
    expect(bearingDelta(0, 179)).toBe(179);
    expect(bearingDelta(0, 181)).toBe(-179);
  });

  it("maps bearings to compass words", () => {
    expect(compassWord(0)).toBe("north");
    expect(compassWord(45)).toBe("north-east");
    expect(compassWord(90)).toBe("east");
    expect(compassWord(200)).toBe("south-south-west"); // 200 deg = SSW
    expect(compassWord(225)).toBe("south-west");
    expect(compassWord(360)).toBe("north");
  });
});

describe("walking estimates", () => {
  it("rounds minutes up", () => {
    expect(walkingMinutes(140, 1.4)).toBe(2); // 100 s -> 2 min
    expect(walkingMinutes(14, 1.4)).toBe(1); // 10 s -> 1 min
    expect(walkingMinutes(0)).toBe(0);
  });

  it("reports very short trips as less than a minute", () => {
    expect(formatWalkingTime(50)).toBe("less than 1 min");
    expect(formatWalkingTime(200)).toBe("3 min");
  });

  it("formats distances below and above a kilometre", () => {
    expect(formatDistance(642)).toBe("642 m");
    expect(formatDistance(1500)).toBe("1.5 km");
  });
});
