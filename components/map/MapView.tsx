"use client";

import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Circle,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { LatLng } from "@/lib/geo/types";
import {
  OSM_ATTRIBUTION,
  OSM_TILES,
  type MapViewProps,
  type MarkerDef,
} from "./adapter";

/** Marker glyphs rendered as DOM (avoids Leaflet's bundled PNG icons). */
function iconFor(marker: MarkerDef): L.DivIcon {
  const palette: Record<MarkerDef["kind"], string> = {
    location: "bg-primary-600 text-white border-primary-700",
    start: "bg-success-500 text-white border-success-600",
    end: "bg-accent-500 text-[#2b1500] border-accent-600",
    user: "bg-primary-500 text-white border-white",
  };
  const letters: Record<MarkerDef["kind"], string> = {
    location: marker.badge ?? "•",
    start: "A",
    end: "B",
    user: "",
  };
  const dot =
    marker.kind === "user"
      ? '<span class="block size-3.5 rounded-full bg-white ring-2 ring-primary-500"></span>'
      : `<span class="text-[11px] font-extrabold leading-none">${letters[marker.kind]}</span>`;

  return L.divIcon({
    className: "",
    html: `<span class="grid place-items-center rounded-full border-2 shadow-card ${palette[marker.kind]}" style="width:26px;height:26px">${dot}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function FitBounds({ points }: { points: LatLng[] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 17, animate: true });
    }
  }, [map, points]);
  return null;
}

function ClickHandler({
  onMapClick,
}: {
  onMapClick?: (point: LatLng) => void;
}) {
  useMapEvents({
    click(event) {
      onMapClick?.({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

function RecenterOnUser({
  position,
  follow = false,
}: {
  position: LatLng | null;
  follow?: boolean;
}) {
  const map = useMap();
  const initialised = useRef(false);
  useEffect(() => {
    if (!position) return;
    if (!initialised.current) {
      map.setView([position.lat, position.lng], 17, { animate: false });
      initialised.current = true;
      return;
    }
    if (follow) {
      map.panTo([position.lat, position.lng], { animate: true, duration: 0.4 });
    }
  }, [map, position, follow]);
  return null;
}

/**
 * Leaflet implementation of the MapAdapter contract (OpenStreetMap tiles,
 * no API key). Loaded with `ssr: false` from a client component.
 */
export default function MapView({
  center,
  zoom = 16,
  markers = [],
  route = null,
  activeRoute = null,
  userPosition = null,
  follow = false,
  fitPoints = null,
  overlays = null,
  showAccuracy = false,
  onMapClick,
  onMarkerClick,
  onOverlayClick,
  className = "",
  interactive = true,
}: MapViewProps) {
  const [tilesFailed, setTilesFailed] = useState(false);

  const overlayLayers = useMemo(
    () =>
      (overlays ?? [])
        .filter((layer) => layer.positions.length > 1)
        .map((layer) => ({
          ...layer,
          positions: layer.positions.map(
            (p) => [p.lat, p.lng] as [number, number],
          ),
        })),
    [overlays],
  );

  const routePositions = useMemo(
    () => (route ?? []).map((p) => [p.lat, p.lng] as [number, number]),
    [route],
  );
  const activePositions = useMemo(
    () => (activeRoute ?? []).map((p) => [p.lat, p.lng] as [number, number]),
    [activeRoute],
  );

  return (
    <div className={`relative h-full w-full ${className}`}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        zoomControl={interactive}
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        className="h-full w-full"
        attributionControl
      >
        <TileLayer
          url={OSM_TILES}
          attribution={OSM_ATTRIBUTION}
          maxZoom={19}
          eventHandlers={{
            tileerror: () => setTilesFailed(true),
            tileload: () => setTilesFailed(false),
          }}
        />

        <ClickHandler onMapClick={onMapClick} />
        <FitBounds points={fitPoints} />
        <RecenterOnUser position={userPosition} follow={follow} />

        {/* Base layers (admin graph edges) drawn under the route */}
        {overlayLayers.map((layer) => (
          <Polyline
            key={layer.id}
            positions={layer.positions}
            eventHandlers={{
              click: () => onOverlayClick?.(layer.id),
            }}
            pathOptions={{
              color: layer.color ?? "#64748b",
              weight: layer.weight ?? 4,
              opacity: layer.dashed ? 0.7 : 0.9,
              dashArray: layer.dashed ? "6 8" : undefined,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        ))}

        {/* Route casing + animated dashes on top */}
        {routePositions.length > 1 && (
          <>
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: "#ffffff",
                weight: 9,
                opacity: 0.9,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            <Polyline
              positions={routePositions}
              className="route-line route-animated"
              pathOptions={{
                color: "#2044d8",
                weight: 5,
                opacity: 1,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </>
        )}

        {activePositions.length > 1 && (
          <Polyline
            positions={activePositions}
            pathOptions={{
              color: "#f79e1b",
              weight: 7,
              opacity: 1,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        )}

        {showAccuracy && userPosition && (
          <Circle
            center={[userPosition.lat, userPosition.lng]}
            radius={25}
            pathOptions={{
              color: "#3661f1",
              weight: 1,
              fillColor: "#3661f1",
              fillOpacity: 0.15,
            }}
          />
        )}

        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.position.lat, marker.position.lng]}
            icon={iconFor(marker)}
            eventHandlers={{
              click: () => onMarkerClick?.(marker),
            }}
            title={marker.label}
            alt={marker.label}
            keyboard
          />
        ))}

        {userPosition && (
          <Marker
            key="user"
            position={[userPosition.lat, userPosition.lng]}
            icon={iconFor({ id: "user", position: userPosition, kind: "user" })}
          />
        )}
      </MapContainer>

      {tilesFailed && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[500] rounded-xl border border-line bg-surface/95 px-4 py-2.5 text-center text-xs font-medium text-ink shadow-card">
          Map tiles could not load (offline?). Routing and search still work.
        </div>
      )}
    </div>
  );
}
