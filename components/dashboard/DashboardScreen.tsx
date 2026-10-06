"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clock,
  Crosshair,
  Heart,
  Loader2,
  MapPinned,
  Search as SearchIcon,
} from "lucide-react";
import { Spinner } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import type { LocationCategory } from "@/db/schema";
import { CATEGORY_META, CATEGORY_ORDER, categoryLabel } from "@/lib/categories";
import { apiFetch } from "@/lib/client/api";
import { SearchBox } from "@/components/navigate/SearchBox";
import {
  getRecentsSnapshot,
  getServerRecentsSnapshot,
  subscribeRecents,
  type PlaceRef,
} from "@/components/navigate/types";

interface LocationRow {
  id: number;
  name: string;
  category: LocationCategory;
  latitude: number;
  longitude: number;
  shortCode: string | null;
  building: string | null;
}

/**
 * Student home: search-first directory with category browsing, recent
 * destinations and saved favourites (report Figure 4.x).
 */
export function DashboardScreen({ userName }: { userName: string }) {
  const router = useRouter();
  const toast = useToast();

  const [pick, setPick] = useState<PlaceRef | null>(null);
  const [pickText, setPickText] = useState("");
  const [category, setCategory] = useState<LocationCategory>("gate");
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [favourites, setFavourites] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const recents = useSyncExternalStore(
    subscribeRecents,
    getRecentsSnapshot,
    getServerRecentsSnapshot,
  );

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiFetch<{ locations: LocationRow[] }>("/api/locations?limit=100"),
      apiFetch<{ favouriteLocationIds: number[] }>("/api/favourites"),
    ])
      .then(([directory, saved]) => {
        if (cancelled) return;
        setLocations(directory.locations ?? []);
        setFavourites(saved.favouriteLocationIds ?? []);
      })
      .catch(() => {
        if (!cancelled) toast.push("Could not load the campus directory", "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [toast]);

  /* Selecting a search hit jumps straight into navigation with it as target. */
  function handlePick(place: PlaceRef | null) {
    setPick(place);
    if (!place) return;
    if (place.type === "location") {
      router.push(`/navigate?to=${place.id}`);
    } else {
      router.push(`/navigate?from=gps:${place.lat.toFixed(6)},${place.lng.toFixed(6)}`);
    }
  }

  const byCategory = useMemo(
    () => locations.filter((row) => row.category === category),
    [locations, category],
  );

  const favouritePlaces = useMemo(
    () => locations.filter((row) => favourites.includes(row.id)),
    [locations, favourites],
  );

  function goToNearestGate() {
    router.push("/navigate?from=gps");
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6 sm:px-6">
        {/* Greeting */}
        <section className="rounded-3xl bg-primary-950 px-5 py-6 text-white sm:px-7">
          <p className="text-xs font-bold uppercase tracking-widest text-accent-300">
            Location Optimization System
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Hello, {userName} 👋
          </h1>
          <p className="mt-1 max-w-lg text-sm text-white/70">
            Where are you headed? Search any place on campus and get the
            shortest walking route in milliseconds.
          </p>

          <div className="mt-4 text-ink">
            <SearchBox
              label="Search campus places"
              placeholder="Search places - Library, Hostel A, ELS..."
              value={pick}
              onChange={handlePick}
              text={pickText}
              onTextChange={setPickText}
              allowGps
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={goToNearestGate} className="chip !border-white/25 !bg-white/10 !text-white hover:!bg-white/20">
              <Crosshair className="size-3" aria-hidden />
              Route from my location
            </button>
            <button
              type="button"
              onClick={() => router.push("/navigate?to=5")}
              className="chip !border-white/25 !bg-white/10 !text-white hover:!bg-white/20"
            >
              <SearchIcon className="size-3" aria-hidden />
              Go to the Library
            </button>
          </div>
        </section>

        {/* Recents */}
        {recents.length > 0 && (
          <section className="mt-6">
            <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-ink-muted">
              <Clock className="size-4" aria-hidden /> Recent destinations
            </h2>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {recents.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => router.push(`/navigate?to=${place.id}`)}
                  className="card tap flex shrink-0 items-center gap-2.5 px-3.5 py-2.5 text-left transition hover:border-primary-300"
                >
                  <span className="grid size-8 place-items-center rounded-full bg-primary-50 text-primary-600">
                    <MapPinned className="size-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-ink">{place.name}</span>
                    <span className="block text-xs text-ink-muted">
                      {categoryLabel(place.category)}
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-ink-muted" aria-hidden />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Favourites */}
        <section className="mt-6">
          <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-ink-muted">
            <Heart className="size-4" aria-hidden /> Saved places
          </h2>
          {loading ? (
            <div className="mt-2">
              <Spinner label="Loading your saved places..." />
            </div>
          ) : favouritePlaces.length === 0 ? (
            <p className="mt-2 rounded-2xl border border-dashed border-line px-4 py-4 text-sm text-ink-muted">
              Nothing saved yet. Tap the heart on any route to keep it here.
            </p>
          ) : (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {favouritePlaces.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => router.push(`/navigate?to=${place.id}`)}
                  className="card tap flex items-center gap-3 px-4 py-3 text-left transition hover:border-primary-300"
                >
                  <span className="grid size-9 place-items-center rounded-xl bg-accent-100 text-accent-700">
                    <Heart className="size-4 fill-current" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-ink">
                      {place.name}
                    </span>
                    <span className="block text-xs text-ink-muted">
                      {categoryLabel(place.category)}
                      {place.building ? ` · ${place.building}` : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Category browser */}
        <section className="mt-6">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink-muted">
            Browse by category
          </h2>

          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORY_ORDER.map((value) => {
              const meta = CATEGORY_META[value];
              const Icon = meta.icon;
              return (
                <button
                  key={value}
                  type="button"
                  className="chip"
                  data-active={value === category}
                  onClick={() => setCategory(value)}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {meta.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3">
            {loading ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="skeleton h-16" />
                ))}
              </div>
            ) : byCategory.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-4 py-4 text-sm text-ink-muted">
                No places recorded for {categoryLabel(category)} yet.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {byCategory.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => router.push(`/navigate?to=${place.id}`)}
                    className="card tap flex items-start gap-3 px-4 py-3 text-left transition hover:border-primary-300"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-600">
                      <MapPinned className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-ink">
                        {place.name}
                        {place.shortCode && (
                          <span className="ml-1.5 rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink-muted">
                            {place.shortCode}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-ink-muted">
                        {place.building ?? categoryLabel(place.category)}
                      </span>
                    </span>
                    <ArrowRight className="ml-auto size-4 shrink-0 text-ink-muted" aria-hidden />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {loading && locations.length === 0 && (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-ink-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Loading directory...
          </div>
        )}
      </div>
    </div>
  );
}
