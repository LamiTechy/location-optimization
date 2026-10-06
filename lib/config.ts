import type { LatLng } from "@/lib/geo/types";

/**
 * Campus centre used as the anchor for ALL seeded coordinates.
 *
 * WARNING: every coordinate produced by `db/seed.ts` is a *placeholder*
 * clustered around this point. They are deliberately derived from metric
 * offsets so the sample graph is topologically correct (and therefore good
 * enough to demo routing), but they are NOT surveyed GPS readings.
 *
 * Calibrate real positions with the Admin -> Map Editor before presenting.
 */
export const CAMPUS_CENTER: LatLng = {
  // Ojere hill, Abeokuta, Ogun State - approximate area of MAPOLY.
  lat: 7.1566,
  lng: 3.3408,
};

export const APP_NAME = "MAPOLY Navigator";
export const APP_TAGLINE = "Location Optimization System";
export const APP_FOOTER =
  "Location Optimization System, Computer Science Department, MAPOLY";
export const INSTITUTION = "Moshood Abiola Polytechnic, Abeokuta";

/** Default walking speed used for ETA calculations (m/s). */
export const DEFAULT_WALKING_SPEED_MPS = 1.4;

/** GPS fix further than this from the nearest graph node is "off campus". */
export const OFF_CAMPUS_SNAP_RADIUS_M = 150;

/** Re-route the user when they stray this far from the planned polyline. */
export const REROUTE_DEVIATION_M = 30;

/** Consider the destination reached inside this radius. */
export const ARRIVAL_RADIUS_M = 15;

/** Visible banner text while seed coordinates are uncalibrated. */
export const PLACEHOLDER_COORDINATE_NOTICE =
  "Coordinates are placeholders. Calibrate with real GPS readings via the Map Editor before demo.";
