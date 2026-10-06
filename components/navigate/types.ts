"use client";

import type { LocationCategory } from "@/db/schema";

/** A pick from search / recents / favourites, or a raw GPS fix. */
export type PlaceRef =
  | {
      type: "location";
      id: number;
      name: string;
      category?: LocationCategory;
      shortCode?: string | null;
      building?: string | null;
    }
  | {
      type: "gps";
      lat: number;
      lng: number;
      name?: string;
    };

export function placeLabel(place: PlaceRef | null): string {
  if (!place) return "";
  if (place.type === "gps") return place.name ?? "My location";
  return place.name;
}

export function samePlace(a: PlaceRef | null, b: PlaceRef | null): boolean {
  if (!a || !b) return false;
  if (a.type === "location" && b.type === "location") return a.id === b.id;
  if (a.type === "gps" && b.type === "gps") {
    return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Recent destinations (device-local, no account sync needed)          */
/* ------------------------------------------------------------------ */

export interface RecentPlace {
  id: number;
  name: string;
  category: LocationCategory;
  shortCode?: string | null;
}

const RECENTS_KEY = "mapoly-recent-places";
const RECENTS_LIMIT = 6;

const EMPTY_RECENTS: RecentPlace[] = [];

function parseRecents(raw: string | null): RecentPlace[] {
  if (!raw) return EMPTY_RECENTS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY_RECENTS;
    const items = parsed.filter(
      (item): item is RecentPlace =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as RecentPlace).id === "number" &&
        typeof (item as RecentPlace).name === "string",
    );
    return items;
  } catch {
    return EMPTY_RECENTS;
  }
}

/* Cached so `useSyncExternalStore` sees a stable reference between renders. */
let cachedRaw: string | null = null;
let cachedRecents: RecentPlace[] = EMPTY_RECENTS;

function readCachedRecents(): RecentPlace[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(RECENTS_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedRecents = parseRecents(raw);
  }
  return cachedRecents;
}

function notifyRecentsChanged() {
  cachedRaw = null;
  window.dispatchEvent(new Event(RECENTS_KEY));
}

/** Subscribe for `useSyncExternalStore` (storage events + our own writes). */
export function subscribeRecents(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(RECENTS_KEY, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(RECENTS_KEY, onChange);
  };
}

/** Client snapshot; SSR always renders the empty list. */
export function getRecentsSnapshot(): RecentPlace[] {
  return readCachedRecents();
}

export function getServerRecentsSnapshot(): RecentPlace[] {
  return EMPTY_RECENTS;
}

export function readRecents(): RecentPlace[] {
  return readCachedRecents();
}

export function pushRecent(place: RecentPlace): RecentPlace[] {
  const next = [
    place,
    ...readCachedRecents().filter((item) => item.id !== place.id),
  ].slice(0, RECENTS_LIMIT);
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* storage disabled - recents last for this tab only */
  }
  notifyRecentsChanged();
  return next;
}
