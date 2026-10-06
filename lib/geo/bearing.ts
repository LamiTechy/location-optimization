import type { LatLng } from "./types";

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Initial great-circle bearing from `a` to `b`, in degrees clockwise from
 * true north (0 = north, 90 = east, 180 = south, 270 = west).
 */
export function bearingDegrees(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const COMPASS_16 = [
  "north",
  "north-north-east",
  "north-east",
  "east-north-east",
  "east",
  "east-south-east",
  "south-east",
  "south-south-east",
  "south",
  "south-south-west",
  "south-west",
  "west-south-west",
  "west",
  "west-north-west",
  "north-west",
  "north-north-west",
];

/** Human-readable compass word for a bearing, e.g. 42 -> "north-east". */
export function compassWord(bearing: number): string {
  const normalized = ((bearing % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return COMPASS_16[index];
}

/** Signed difference between two bearings, normalised to [-180, 180). */
export function bearingDelta(from: number, to: number): number {
  let delta = (((to - from) % 360) + 360) % 360;
  if (delta >= 180) delta -= 360;
  return delta;
}
