import { DEFAULT_WALKING_SPEED_MPS } from "@/lib/config";

/** Seconds needed to walk `distanceM` at `speedMps`. */
export function walkingSeconds(
  distanceM: number,
  speedMps: number = DEFAULT_WALKING_SPEED_MPS,
): number {
  if (distanceM <= 0 || speedMps <= 0) return 0;
  return distanceM / speedMps;
}

/** Whole minutes, rounded **up** (you never arrive earlier than you will). */
export function walkingMinutes(
  distanceM: number,
  speedMps: number = DEFAULT_WALKING_SPEED_MPS,
): number {
  return Math.ceil(walkingSeconds(distanceM, speedMps) / 60);
}

/** Human label used across the UI: "less than 1 min", "8 min", "1 hr 5 min". */
export function formatWalkingTime(distanceM: number, speedMps?: number): string {
  const seconds = walkingSeconds(distanceM, speedMps);
  if (seconds < 60) return "less than 1 min";

  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** "640 m" below 1 km, "1.2 km" above. */
export function formatDistance(distanceM: number): string {
  if (distanceM < 1000) return `${Math.round(distanceM)} m`;
  return `${(distanceM / 1000).toFixed(1)} km`;
}
