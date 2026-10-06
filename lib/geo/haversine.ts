import type { LatLng } from "./types";

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two coordinates using the Haversine formula.
 * Accurate to ~0.5% for the short (campus-scale) distances used in this project.
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Converts a metric offset (east, north) from a centre point to lat/lng. */
export function offsetMetersToLatLng(
  center: LatLng,
  xMeters: number,
  yMeters: number,
): LatLng {
  const lat = center.lat + yMeters / 111_320;
  const lng =
    center.lng + xMeters / (111_320 * Math.cos(toRad(center.lat)));
  return { lat, lng };
}

/** Converts a lat/lng difference back into a metric offset from a centre point. */
export function latLngToOffsetMeters(
  center: LatLng,
  point: LatLng,
): { x: number; y: number } {
  const y = (point.lat - center.lat) * 111_320;
  const x =
    (point.lng - center.lng) * 111_320 * Math.cos(toRad(center.lat));
  return { x, y };
}

/** Rounds to a sensible precision: 1 decimal for distances under 1 km. */
export function roundMeters(meters: number): number {
  return meters < 1000 ? Math.round(meters * 10) / 10 : Math.round(meters);
}
