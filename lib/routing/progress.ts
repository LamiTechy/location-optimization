import { haversineMeters } from "@/lib/geo/haversine";
import type { LatLng } from "@/lib/geo/types";
import type { DirectionStep } from "@/lib/routing/directions";

/**
 * Live-navigation progress helpers (report: turn-by-turn tracking).
 *
 * All functions are pure so they can be unit tested without a device - the
 * screen only wires them to `geolocation.watchPosition`.
 */

/** Index of the polyline vertex closest to `point` (O(n), routes are short). */
export function nearestPathIndex(
  path: Array<[number, number]>,
  point: LatLng,
): number {
  if (path.length === 0) return -1;
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < path.length; i++) {
    const distance = haversineMeters(point, { lat: path[i][0], lng: path[i][1] });
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

/** Metres still to walk along the polyline from `fromIndex` to the end. */
export function remainingDistance(
  path: Array<[number, number]>,
  fromIndex: number,
): number {
  let total = 0;
  for (let i = Math.max(fromIndex, 0); i < path.length - 1; i++) {
    total += haversineMeters(
      { lat: path[i][0], lng: path[i][1] },
      { lat: path[i + 1][0], lng: path[i + 1][1] },
    );
  }
  return total;
}

/** Metres walked from the start of the polyline up to `index`. */
function cumulativeDistance(path: Array<[number, number]>, index: number): number {
  let total = 0;
  for (let i = 0; i < index && i < path.length - 1; i++) {
    total += haversineMeters(
      { lat: path[i][0], lng: path[i][1] },
      { lat: path[i + 1][0], lng: path[i + 1][1] },
    );
  }
  return total;
}

/**
 * Index of the instruction the walker is currently on: the last step that is
 * already behind them, or within `lookaheadM` metres of their position (so
 * the next turn is highlighted just before they reach it).
 */
export function activeStepIndex(
  steps: Pick<DirectionStep, "lat" | "lng">[],
  path: Array<[number, number]>,
  currentIndex: number,
  lookaheadM = 20,
): number {
  if (steps.length === 0) return -1;
  const walked = cumulativeDistance(path, Math.max(currentIndex, 0));
  let active = 0;
  for (let i = 0; i < steps.length; i++) {
    const stepIndex = nearestPathIndex(path, { lat: steps[i].lat, lng: steps[i].lng });
    if (stepIndex < 0) continue;
    if (cumulativeDistance(path, stepIndex) <= walked + lookaheadM) active = i;
  }
  return active;
}

/** True when the walker is inside the arrival radius of the destination. */
export function hasArrived(
  position: LatLng,
  destination: LatLng,
  radiusM: number,
): boolean {
  return haversineMeters(position, destination) <= radiusM;
}

/** Metres between the walker and the planned polyline (off-route detector). */
export function deviationMeters(
  path: Array<[number, number]>,
  point: LatLng,
): number {
  const index = nearestPathIndex(path, point);
  if (index < 0) return Number.POSITIVE_INFINITY;
  return haversineMeters(point, {
    lat: path[index][0],
    lng: path[index][1],
  });
}
