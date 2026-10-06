"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  ArrowUpDown,
  Clock,
  Crosshair,
  Flag,
  Heart,
  Info,
  Loader2,
  MapPin,
  Navigation2,
  Route,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import type { LocationCategory } from "@/db/schema";
import {
  ARRIVAL_RADIUS_M,
  CAMPUS_CENTER,
  PLACEHOLDER_COORDINATE_NOTICE,
  REROUTE_DEVIATION_M,
} from "@/lib/config";
import { apiFetch, ApiError } from "@/lib/client/api";
import { formatDistance } from "@/lib/geo/eta";
import type { LatLng } from "@/lib/geo/types";
import { categoryBadge, categoryLabel } from "@/lib/categories";
import type { DirectionStep } from "@/lib/routing/directions";
import {
  activeStepIndex,
  deviationMeters,
  hasArrived,
  nearestPathIndex,
  remainingDistance,
} from "@/lib/routing/progress";
import type { MarkerDef } from "@/components/map/adapter";
import { ArrivalCard } from "./ArrivalCard";
import { BottomSheet } from "./BottomSheet";
import { SearchBox } from "./SearchBox";
import { StepsList } from "./StepsList";
import { placeLabel, samePlace, type PlaceRef } from "./types";

/**
 * Leaflet runs entirely in the browser (it touches `window` on import), so
 * the map is mounted with `ssr: false`. `ssr: false` is only legal inside a
 * client component, which is why this component exists.
 */
const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-surface-3 text-sm text-ink-muted">
      <span className="inline-flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Loading map...
      </span>
    </div>
  ),
});

interface RouteResponse {
  ok: boolean;
  distanceM: number;
  durationMin: number;
  durationSec: number;
  path: Array<[number, number]>;
  steps: DirectionStep[];
  from: { id: number | null; name: string; lat: number; lng: number };
  to: { id: number | null; name: string; lat: number; lng: number };
  warnings: string[];
}

interface LocationRow {
  id: number;
  name: string;
  category: LocationCategory;
  latitude: number;
  longitude: number;
  shortCode: string | null;
  building: string | null;
}

interface LocateState {
  position: LatLng | null;
  status: "idle" | "locating" | "denied" | "unsupported";
}

interface NavState {
  watching: boolean;
  position: LatLng | null;
  arrived: boolean;
  /** Index of the instruction currently being followed (-1 = none). */
  stepIndex: number;
  /** Metres between the walker and the planned polyline. */
  deviation: number;
  pathIndex: number;
}

const NAV_IDLE: NavState = {
  watching: false,
  position: null,
  arrived: false,
  stepIndex: -1,
  deviation: 0,
  pathIndex: -1,
};

/** `/navigate?from=12&to=7` and `/navigate?from=gps:7.15,3.34&to=19`. */
function parseEndpointParam(value?: string): PlaceRef | null {
  if (!value) return null;
  if (value.startsWith("gps:")) {
    const [lat, lng] = value.slice(4).split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { type: "gps", lat, lng, name: "Shared point" };
    }
    return null;
  }
  const id = Number.parseInt(value, 10);
  if (Number.isInteger(id) && id > 0) {
    return { type: "location", id, name: `Place #${id}` };
  }
  return null;
}

function encodeEndpoint(place: PlaceRef | null): string | undefined {
  if (!place) return undefined;
  if (place.type === "gps") return `gps:${place.lat.toFixed(6)},${place.lng.toFixed(6)}`;
  return String(place.id);
}

export function NavigateScreen({
  fromParam,
  toParam,
}: {
  fromParam?: string;
  toParam?: string;
}) {
  const toast = useToast();

  const [from, setFrom] = useState<PlaceRef | null>(() => parseEndpointParam(fromParam));
  const [to, setTo] = useState<PlaceRef | null>(() => parseEndpointParam(toParam));
  const [fromText, setFromText] = useState(() => placeLabel(parseEndpointParam(fromParam)));
  const [toText, setToText] = useState(() => placeLabel(parseEndpointParam(toParam)));
  const [routeResult, setRouteResult] = useState<{
    key: string;
    route: RouteResponse | null;
    error: { code: string; message: string } | null;
  } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locate, setLocate] = useState<LocateState>({ position: null, status: "idle" });
  const requestId = useRef(0);
  const inFlight = useRef<string | null>(null);

  /* ---------------------------------------------------------------- */
  /* Live navigation (geolocation watcher)                              */
  /* ---------------------------------------------------------------- */
  const [nav, setNav] = useState<NavState>(NAV_IDLE);
  const watchId = useRef<number | null>(null);
  const routeRef = useRef<RouteResponse | null>(null);
  const lastRerouteAt = useRef(0);

  /* Never leak a watcher when the screen unmounts. */
  useEffect(
    () => () => {
      if (watchId.current !== null && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(watchId.current);
      }
    },
    [],
  );

  const stopNavigation = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
    }
    watchId.current = null;
    setNav(NAV_IDLE);
  }, []);

  /** Single place to change an endpoint (keeps its input text in sync). */
  const applyFrom = useCallback((place: PlaceRef | null) => {
    setFrom(place);
    setFromText(placeLabel(place));
    setRouteResult(null);
    inFlight.current = null;
    setNav((current) => (current.arrived ? { ...current, arrived: false } : current));
  }, []);

  const applyTo = useCallback((place: PlaceRef | null) => {
    setTo(place);
    setToText(placeLabel(place));
    setRouteResult(null);
    inFlight.current = null;
    setNav((current) => (current.arrived ? { ...current, arrived: false } : current));
  }, []);

  const startNavigation = useCallback(() => {
    if (!routeRef.current) return;
    if (!navigator.geolocation) {
      toast.error("This device cannot provide a location");
      return;
    }

    setNav({ ...NAV_IDLE, watching: true });
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const point: LatLng = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const active = routeRef.current;
        if (!active) {
          setNav((current) => ({ ...current, position: point }));
          return;
        }

        const index = nearestPathIndex(active.path, point);
        const deviation = deviationMeters(active.path, point);
        const arrived = hasArrived(
          point,
          { lat: active.to.lat, lng: active.to.lng },
          ARRIVAL_RADIUS_M,
        );

        setNav({
          watching: !arrived,
          position: point,
          arrived,
          stepIndex: activeStepIndex(active.steps, active.path, index),
          deviation,
          pathIndex: index,
        });

        if (arrived) {
          if (watchId.current !== null) {
            navigator.geolocation.clearWatch(watchId.current);
            watchId.current = null;
          }
          return;
        }

        // Off-route detection: recalculate at most once every 15 seconds.
        if (
          deviation > REROUTE_DEVIATION_M &&
          Date.now() - lastRerouteAt.current > 15_000
        ) {
          lastRerouteAt.current = Date.now();
          applyFrom({ type: "gps", lat: point.lat, lng: point.lng, name: "My location" });
          toast.push("You left the planned path - recalculating the route", "info");
        }
      },
      () => {
        setNav((current) => ({ ...current, watching: false }));
        toast.error("Location permission is needed for live navigation");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 },
    );
  }, [applyFrom, toast]);

  /* ---------------------------------------------------------------- */
  /* Saved places (favourites)                                          */
  /* ---------------------------------------------------------------- */
  const [favouriteIds, setFavouriteIds] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ favouriteLocationIds: number[] }>("/api/favourites")
      .then((data) => {
        if (!cancelled) setFavouriteIds(data.favouriteLocationIds ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const toLocationId = to?.type === "location" ? to.id : null;
  const toSaved = toLocationId !== null && favouriteIds.includes(toLocationId);

  const toggleFavourite = useCallback(async () => {
    if (toLocationId === null) return;
    const saving = !toSaved;
    setFavouriteIds((current) =>
      saving ? [...current, toLocationId] : current.filter((id) => id !== toLocationId),
    );
    try {
      await apiFetch("/api/favourites", {
        method: saving ? "POST" : "DELETE",
        json: { locationId: toLocationId },
      });
      toast.success(saving ? "Saved to your places" : "Removed from saved places");
    } catch {
      setFavouriteIds((current) =>
        saving
          ? current.filter((id) => id !== toLocationId)
          : [...current, toLocationId],
      );
      toast.error("Could not update your saved places");
    }
  }, [toLocationId, toSaved, toast]);

  /* ---------------------------------------------------------------- */
  /* Load the directory once for map markers                            */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;
    apiFetch<{ locations: LocationRow[] }>("/api/locations?limit=100")
      .then((data) => {
        if (!cancelled) setLocations(data.locations ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  /* Resolve names for shared links (`?from=12`). */
  useEffect(() => {
    const needsLookup = [from, to].some(
      (place) => place?.type === "location" && place.name.startsWith("Place #"),
    );
    if (!needsLookup) return;

    const ids = [from, to]
      .filter((place): place is PlaceRef & { type: "location" } => place?.type === "location")
      .map((place) => place.id)
      .join(",");
    if (!ids) return;

    let cancelled = false;
    apiFetch<{ locations: LocationRow[] }>(`/api/locations?ids=${ids}&limit=10`)
      .then((data) => {
        if (cancelled) return;
        const byId = new Map(data.locations.map((row) => [row.id, row]));

        const resolve = (place: PlaceRef | null): PlaceRef | null => {
          if (place?.type !== "location" || !place.name.startsWith("Place #")) {
            return place;
          }
          const row = byId.get(place.id);
          return row
            ? {
                ...place,
                name: row.name,
                category: row.category,
                shortCode: row.shortCode,
                building: row.building,
              }
            : { ...place, name: "Unknown place" };
        };

        const nextFrom = resolve(from);
        const nextTo = resolve(to);
        if (nextFrom !== from) {
          setFrom(nextFrom);
          setFromText(placeLabel(nextFrom));
        }
        if (nextTo !== to) {
          setTo(nextTo);
          setToText(placeLabel(nextTo));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  /* ---------------------------------------------------------------- */
  /* Request the optimized route whenever both endpoints are set        */
  /* ---------------------------------------------------------------- */
  const routeKey =
    from && to && !samePlace(from, to)
      ? `${encodeEndpoint(from)}>${encodeEndpoint(to)}`
      : null;

  const route =
    routeResult && routeResult.key === routeKey ? routeResult.route : null;
  const routeError =
    routeResult && routeResult.key === routeKey ? routeResult.error : null;
  const routing =
    routeKey !== null && (!routeResult || routeResult.key !== routeKey);

  /* Keep the latest route visible to the geolocation watcher. */
  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  useEffect(() => {
    if (!routeKey || !from || !to) return;
    if (routeResult?.key === routeKey) return;
    if (inFlight.current === routeKey) return;
    inFlight.current = routeKey;

    const id = ++requestId.current;

    apiFetch<RouteResponse>("/api/route", {
      method: "POST",
      json: { from, to },
    })
      .then((data) => {
        if (id !== requestId.current) return;
        setRouteResult({ key: routeKey, route: data, error: null });
        if (data.warnings.length > 0) {
          toast.push(data.warnings[0], "info");
        }
      })
      .catch((error: unknown) => {
        if (id !== requestId.current) return;
        if (error instanceof ApiError) {
          setRouteResult({
            key: routeKey,
            route: null,
            error: { code: error.code, message: error.message },
          });
        } else {
          setRouteResult({
            key: routeKey,
            route: null,
            error: {
              code: "NETWORK_ERROR",
              message: "Could not reach the routing service. Check your connection.",
            },
          });
        }
      })
      .finally(() => {
        if (id === requestId.current) inFlight.current = null;
      });
  }, [routeKey, from, to, routeResult, toast]);

  /* Shareable URL (replaceState: no server round-trip, no state reset). */
  useEffect(() => {
    const params = new URLSearchParams();
    const fromValue = encodeEndpoint(from);
    const toValue = encodeEndpoint(to);
    if (fromValue) params.set("from", fromValue);
    if (toValue) params.set("to", toValue);
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [from, to]);

  const center = useMemo<LatLng>(() => {
    if (route?.path.length) {
      const middle = route.path[Math.floor(route.path.length / 2)];
      return { lat: middle[0], lng: middle[1] };
    }
    if (from?.type === "gps") return { lat: from.lat, lng: from.lng };
    return CAMPUS_CENTER;
  }, [route, from]);

  const fitPoints = useMemo<LatLng[] | null>(() => {
    if (route?.path.length) {
      return route.path.map(([lat, lng]) => ({ lat, lng }));
    }
    const points = [placePoint(from, locations), placePoint(to, locations)].filter(
      (point): point is LatLng => point !== null,
    );
    return points.length > 0 ? points : null;
  }, [route, from, to, locations]);

  const markers = useMemo<MarkerDef[]>(() => {
    const defs: MarkerDef[] = locations.map((row) => ({
      id: `loc-${row.id}`,
      position: { lat: row.latitude, lng: row.longitude },
      label: row.name,
      kind: "location",
      category: row.category,
      badge: row.shortCode ? row.shortCode.slice(0, 3).toUpperCase() : categoryBadge(row.category),
    }));

    const start = placePoint(from, locations);
    if (from && start) {
      defs.push({
        id: "marker-start",
        position: start,
        label: placeLabel(from),
        kind: "start",
      });
    }
    const end = placePoint(to, locations);
    if (to && end) {
      defs.push({
        id: "marker-end",
        position: end,
        label: placeLabel(to),
        kind: "end",
      });
    }
    return defs;
  }, [locations, from, to]);

  const routePoints = useMemo(
    () => (route?.path ?? []).map(([lat, lng]) => ({ lat, lng })),
    [route],
  );

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setLocate((state) => ({ ...state, status: "unsupported" }));
      return;
    }
    setLocate((state) => ({ ...state, status: "locating" }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocate({
          position: { lat: position.coords.latitude, lng: position.coords.longitude },
          status: "idle",
        });
        applyFrom({
          type: "gps",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          name: "My location",
        });
      },
      () => setLocate((state) => ({ ...state, status: "denied" })),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }, [applyFrom]);

  function swap() {
    applyFrom(to);
    applyTo(from);
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "MAPOLY Navigator route",
          text: `${placeLabel(from)} → ${placeLabel(to)}`,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Route link copied");
    } catch {
      toast.error("Could not share this route");
    }
  }

  const endpointLabel = route
    ? `${route.from.name} → ${route.to.name}`
    : from && to
      ? `${placeLabel(from)} → ${placeLabel(to)}`
      : "Plan a walking route";

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapView
        center={center}
        markers={markers}
        route={routePoints}
        fitPoints={fitPoints}
        userPosition={nav.position ?? locate.position}
        follow={nav.watching}
        showAccuracy={Boolean(nav.position ?? locate.position)}
        className="absolute inset-0"
      />

      {/* Placeholder-coordinate notice (report honesty requirement) */}
      <p className="pointer-events-none absolute left-14 right-3 top-3 z-[540] rounded-xl border border-accent-300 bg-accent-100/95 px-3 py-2 text-center text-[11px] font-semibold leading-snug text-accent-800 shadow-card sm:left-auto sm:max-w-xs">
        {PLACEHOLDER_COORDINATE_NOTICE}
      </p>

      {/* Floating map controls */}
      <div className="absolute right-3 top-20 z-[550] flex flex-col gap-2">
        <button
          type="button"
          onClick={locateMe}
          className="tap grid size-11 place-items-center rounded-full border border-line bg-surface text-primary-600 shadow-card transition hover:bg-surface-3"
          aria-label="Centre the map on my location"
          title="My location"
        >
          {locate.status === "locating" ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <Crosshair className="size-5" aria-hidden />
          )}
        </button>
      </div>

      {locate.status === "denied" && (
        <div className="absolute inset-x-3 top-16 z-[550] rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-xs font-semibold text-danger-500 backdrop-blur">
          Location permission denied - pick a start place instead.
        </div>
      )}

      {/* Optimized route panel */}
      <div className="absolute inset-x-0 bottom-0 z-[560] px-3 pb-3">
        <BottomSheet
          expanded={expanded}
          onExpandedChange={setExpanded}
          title={endpointLabel}
          actions={
            from && to ? (
              <button
                type="button"
                onClick={swap}
                className="grid size-8 place-items-center rounded-lg bg-surface-3 text-ink-muted transition hover:text-primary-600"
                aria-label="Swap start and destination"
                title="Swap start and destination"
              >
                <ArrowUpDown className="size-4" aria-hidden />
              </button>
            ) : null
          }
        >
          {/* Endpoints */}
          <div className="space-y-2.5">
            <div className="flex items-start gap-2">
              <span className="mt-3 grid size-6 shrink-0 place-items-center rounded-full bg-success-500/15 text-success-500">
                <span className="size-2.5 rounded-full bg-success-500" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <SearchBox
                  label="Starting point"
                  placeholder="Start: type a place or use GPS"
                  value={from}
                  onChange={applyFrom}
                  text={fromText}
                  onTextChange={setFromText}
                  allowGps
                />
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="mt-3 grid size-6 shrink-0 place-items-center rounded-full bg-accent-500/20 text-accent-700">
                <Flag className="size-3" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <SearchBox
                  label="Destination"
                  placeholder="Where to? e.g. Library"
                  value={to}
                  onChange={applyTo}
                  text={toText}
                  onTextChange={setToText}
                  autoFocus={!from}
                />
              </div>
            </div>
          </div>

          {/* Route state */}
          {routing && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-3 text-sm text-ink-muted">
              <Spinner label="Computing the shortest walking path..." />
            </div>
          )}

          {!routing && routeError && (
            <div
              role="alert"
              className="mt-4 rounded-2xl border border-danger-500/30 bg-danger-500/10 p-4"
            >
              <p className="flex items-center gap-2 text-sm font-bold text-danger-500">
                <AlertTriangle className="size-4" aria-hidden />
                {routeError.code === "NO_ROUTE"
                  ? "No walking path"
                  : routeError.code === "UNKNOWN_LOCATION"
                    ? "Place not found"
                    : "Route unavailable"}
              </p>
              <p className="mt-1 text-sm text-ink-muted">{routeError.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {to && (
                  <Button size="sm" variant="ghost" onClick={() => applyTo(null)}>
                    Choose another destination
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => applyFrom(null)}>
                  Change start point
                </Button>
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                Step 3 of the flow: pick a different destination and the route is
                recomputed automatically.
              </p>
            </div>
          )}

          {!routing && !routeError && route && (
            <div className="mt-4 animate-fade-up">
              {nav.arrived && (
                <div className="mb-3">
                  <ArrivalCard
                    destinationName={route.to.name}
                    walkedDistanceM={Math.max(
                      0,
                      route.distanceM -
                        (nav.pathIndex >= 0
                          ? remainingDistance(route.path, nav.pathIndex)
                          : 0),
                    )}
                    onDone={stopNavigation}
                  />
                </div>
              )}

              {!nav.arrived && nav.watching && (
                <div className="mb-3 rounded-2xl bg-primary-950 p-3.5 text-white">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-accent-300">
                    Navigating
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-snug">
                    {route.steps[nav.stepIndex]?.instruction ?? "Follow the highlighted path"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/70">
                    <span>
                      {formatDistance(
                        Math.max(
                          0,
                          route.distanceM -
                            (nav.pathIndex >= 0
                              ? remainingDistance(route.path, nav.pathIndex)
                              : 0),
                        ),
                      )}{" "}
                      walked
                    </span>
                    <span>
                      ~
                      {Math.max(
                        1,
                        Math.round(
                          remainingDistance(route.path, Math.max(nav.pathIndex, 0)) /
                            1.4 /
                            60,
                        ),
                      )}{" "}
                      min left
                    </span>
                    {nav.deviation > REROUTE_DEVIATION_M && (
                      <span className="font-bold text-accent-400">
                        {Math.round(nav.deviation)} m off route - recalculating
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5">
                    <Button size="sm" variant="accent" onClick={stopNavigation}>
                      Stop navigation
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-2 p-3 text-center">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                    Distance
                  </p>
                  <p className="text-lg font-extrabold text-ink">
                    {formatDistance(route.distanceM)}
                  </p>
                </div>
                <div className="border-x border-line">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                    Walking
                  </p>
                  <p className="text-lg font-extrabold text-ink">
                    {route.durationMin} min
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                    Steps
                  </p>
                  <p className="text-lg font-extrabold text-ink">{route.steps.length}</p>
                </div>
              </div>

              {route.warnings.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {route.warnings.map((warning) => (
                    <li
                      key={warning}
                      className="flex items-start gap-2 rounded-xl bg-accent-100 px-3 py-2 text-xs font-medium text-accent-800"
                    >
                      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      {warning}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!nav.watching && !nav.arrived && (
                  <Button size="sm" variant="primary" onClick={startNavigation}>
                    <Navigation2 className="size-4" aria-hidden />
                    Start navigation
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setExpanded((current) => !current)}
                >
                  Turn-by-turn
                </Button>
                <Button size="sm" variant="ghost" onClick={share}>
                  <Share2 className="size-4" aria-hidden />
                  Share link
                </Button>
                {toLocationId !== null && (
                  <Button
                    size="sm"
                    variant={toSaved ? "accent" : "ghost"}
                    onClick={toggleFavourite}
                    aria-pressed={toSaved}
                  >
                    <Heart className={`size-4 ${toSaved ? "fill-current" : ""}`} aria-hidden />
                    {toSaved ? "Saved" : "Save"}
                  </Button>
                )}
                <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                  <Clock className="size-3.5" aria-hidden />
                  ~{route.durationMin} min walk
                </span>
              </div>

              <StepsList
                steps={route.steps}
                activeIndex={nav.watching || nav.arrived ? nav.stepIndex : -1}
              />
            </div>
          )}

          {!routing && !routeError && !route && (
            <div className="mt-4 rounded-2xl border border-dashed border-line px-4 py-5 text-center">
              <Route className="mx-auto size-6 text-primary-600" aria-hidden />
              <p className="mt-2 text-sm font-semibold text-ink">
                {from && !to
                  ? "Now choose your destination"
                  : !from && to
                    ? "Now choose where you start"
                    : "Pick a start and a destination"}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Dijkstra&apos;s algorithm returns the shortest walking path in
                milliseconds. Try “Library”, a hostel, or use GPS.
              </p>
              {!from && (
                <Button size="sm" variant="ghost" className="mt-3" onClick={locateMe}>
                  <Crosshair className="size-4" aria-hidden />
                  Start from my location
                </Button>
              )}
            </div>
          )}

          {/* Category hint strip */}
          {!expanded && !route && !routing && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {(["gate", "library", "hostel", "lecture_hall", "cafeteria"] as LocationCategory[])
                .slice(0, 5)
                .map((category) => (
                  <button
                    key={category}
                    type="button"
                    className="chip shrink-0"
                    onClick={() => {
                      const first = locations.find((row) => row.category === category);
                      if (first) {
                        applyTo({
                          type: "location",
                          id: first.id,
                          name: first.name,
                          category: first.category,
                          shortCode: first.shortCode,
                          building: first.building,
                        });
                      }
                    }}
                  >
                    <MapPin className="size-3" aria-hidden />
                    {categoryLabel(category)}
                  </button>
                ))}
            </div>
          )}
        </BottomSheet>
      </div>
    </div>
  );
}

function placePoint(
  place: PlaceRef | null,
  locations: LocationRow[],
): LatLng | null {
  if (!place) return null;
  if (place.type === "gps") return { lat: place.lat, lng: place.lng };
  const row = locations.find((candidate) => candidate.id === place.id);
  if (!row) return null;
  return { lat: row.latitude, lng: row.longitude };
}
