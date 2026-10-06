import type { LocationCategory } from "@/db/schema";
import type { LatLng } from "@/lib/geo/types";

/**
 * Map adapter contract.
 *
 * The UI only ever talks to these types, so the Leaflet implementation in
 * `MapView.tsx` can be swapped for a Google Maps adapter (or a static image
 * adapter during tests) without touching a single screen.
 */
export type MapProviderId = "leaflet" | "google";

export interface MarkerDef {
  id: string;
  position: LatLng;
  label?: string;
  kind: "location" | "start" | "end" | "user";
  category?: LocationCategory;
  badge?: string;
}

export interface PolylineDef {
  id: string;
  positions: LatLng[];
  color?: string;
  weight?: number;
  dashed?: boolean;
}

export interface MapViewProps {
  /** Initial camera position (used on first render). */
  center: LatLng;
  zoom?: number;
  markers?: MarkerDef[];
  /** Ordered polyline to draw as the optimized route. */
  route?: LatLng[] | null;
  /** Highlighted portion of the route (live navigation). */
  activeRoute?: LatLng[] | null;
  userPosition?: LatLng | null;
  /** Keep the camera locked to `userPosition` (live navigation). */
  follow?: boolean;
  /** Points the camera should frame whenever they change (auto-fit). */
  fitPoints?: LatLng[] | null;
  /** Extra drawn layers (admin graph editor draws walkway edges). */
  overlays?: PolylineDef[] | null;
  /** Show the user's accuracy circle around `userPosition`. */
  showAccuracy?: boolean;
  onMapClick?: (point: LatLng) => void;
  onMarkerClick?: (marker: MarkerDef) => void;
  /** Click on one of the `overlays` polylines (admin edge selection). */
  onOverlayClick?: (id: string) => void;
  className?: string;
  interactive?: boolean;
}

export const MAP_PROVIDER: MapProviderId = "leaflet";

export const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
