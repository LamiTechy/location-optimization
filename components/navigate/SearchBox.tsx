"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Clock,
  Crosshair,
  CornerDownLeft,
  MapPin,
  Search,
  X,
} from "lucide-react";
import type { LocationCategory } from "@/db/schema";
import { categoryLabel } from "@/lib/categories";
import { apiFetch, ApiError } from "@/lib/client/api";
import { Spinner } from "@/components/ui/Feedback";
import {
  getRecentsSnapshot,
  getServerRecentsSnapshot,
  pushRecent,
  subscribeRecents,
  type PlaceRef,
  type RecentPlace,
} from "./types";

interface SearchHit {
  id: number;
  name: string;
  category: LocationCategory;
  shortCode: string | null;
  building: string | null;
}

interface SearchResponse {
  ok: boolean;
  results: SearchHit[];
  suggestions: SearchHit[];
}

type Row =
  | { kind: "gps" }
  | { kind: "recent"; place: RecentPlace }
  | { kind: "hit"; hit: SearchHit; suggestion: boolean };

interface SearchBoxProps {
  label: string;
  /** Currently selected place (drives the request payload, not the text). */
  value: PlaceRef | null;
  onChange: (place: PlaceRef | null) => void;
  /** Input text - owned by the screen so external swaps update instantly. */
  text: string;
  onTextChange: (text: string) => void;
  placeholder?: string;
  allowGps?: boolean;
  autoFocus?: boolean;
  onGpsStateChange?: (state: "idle" | "locating" | "denied") => void;
}

function hitToPlace(hit: SearchHit): PlaceRef {
  return {
    type: "location",
    id: hit.id,
    name: hit.name,
    category: hit.category,
    shortCode: hit.shortCode,
    building: hit.building,
  };
}

/**
 * Autocomplete combobox for campus places.
 *
 * ARIA: combobox + listbox pattern (ARIA 1.2) - arrow keys move
 * `aria-activedescendant`, Enter selects, Escape closes.
 */
export function SearchBox({
  label,
  value,
  onChange,
  text,
  onTextChange,
  placeholder = "Search a place...",
  allowGps = false,
  autoFocus = false,
  onGpsStateChange,
}: SearchBoxProps) {
  const listId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [suggestions, setSuggestions] = useState<SearchHit[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [gpsState, setGpsState] = useState<"idle" | "locating" | "denied">("idle");

  const recents = useSyncExternalStore(
    subscribeRecents,
    getRecentsSnapshot,
    getServerRecentsSnapshot,
  );

  const trimmed = text.trim();
  const selectedLabel = value ? labelOf(value) : "";
  const searching = trimmed.length > 0 && trimmed !== selectedLabel;

  /* Debounced search (250 ms feels instant without hammering the API). */
  useEffect(() => {
    if (!open || !searching) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiFetch<SearchResponse>(
          `/api/search?q=${encodeURIComponent(trimmed)}&limit=8`,
          { signal: controller.signal },
        );
        setResults(data.results ?? []);
        setSuggestions(data.suggestions ?? []);
        setActiveIndex(-1);
      } catch (error) {
        if (error instanceof ApiError && error.code === "UNAUTHENTICATED") return;
        if ((error as Error).name === "AbortError") return;
        setResults([]);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, searching, open]);

  /* Close when clicking outside the combobox. */
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];
    if (!searching) {
      for (const place of recents) list.push({ kind: "recent", place });
      for (const hit of results) list.push({ kind: "hit", hit, suggestion: false });
      for (const hit of suggestions) list.push({ kind: "hit", hit, suggestion: true });
    } else {
      for (const hit of results) list.push({ kind: "hit", hit, suggestion: false });
      for (const hit of suggestions) list.push({ kind: "hit", hit, suggestion: true });
    }
    if (allowGps) list.push({ kind: "gps" });
    return list;
  }, [searching, recents, results, suggestions, allowGps]);

  /* Clamp so a shrinking list never leaves a dangling highlight. */
  const safeIndex =
    rows.length === 0 ? -1 : Math.min(Math.max(activeIndex, -1), rows.length - 1);

  function select(row: Row) {
    if (row.kind === "gps") {
      requestGps();
      return;
    }
    if (row.kind === "recent") {
      onChange({
        type: "location",
        id: row.place.id,
        name: row.place.name,
        category: row.place.category,
        shortCode: row.place.shortCode,
      });
      onTextChange(row.place.name);
      setOpen(false);
      return;
    }
    onChange(hitToPlace(row.hit));
    onTextChange(row.hit.name);
    setOpen(false);
    pushRecent({
      id: row.hit.id,
      name: row.hit.name,
      category: row.hit.category,
      shortCode: row.hit.shortCode,
    });
  }

  function requestGps() {
    if (!navigator.geolocation) {
      setGpsState("denied");
      onGpsStateChange?.("denied");
      return;
    }
    setGpsState("locating");
    onGpsStateChange?.("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsState("idle");
        onGpsStateChange?.("idle");
        onChange({
          type: "gps",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          name: "My location",
        });
        onTextChange("My location");
        setOpen(false);
      },
      () => {
        setGpsState("denied");
        onGpsStateChange?.("denied");
        setOpen(true);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((current) => (current + 1) % Math.max(rows.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (rows.length === 0) return;
      setActiveIndex((current) => (current <= 0 ? rows.length - 1 : current - 1));
    } else if (event.key === "Enter") {
      if (open && safeIndex >= 0 && rows[safeIndex]) {
        event.preventDefault();
        select(rows[safeIndex]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const showList = open;
  const showSuggestionsHeading = results.length === 0 && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>

      <div className="relative flex items-center">
        <Search
          className="pointer-events-none absolute left-3 size-4 text-ink-muted"
          aria-hidden
        />
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            safeIndex >= 0 && rows[safeIndex] ? `${listId}-${safeIndex}` : undefined
          }
          autoComplete="off"
          spellCheck={false}
          className="input pl-9 pr-20"
          placeholder={placeholder}
          value={text}
          autoFocus={autoFocus}
          onChange={(event) => {
            onTextChange(event.target.value);
            setOpen(true);
            if (value) onChange(null);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />

        <div className="absolute right-1.5 flex items-center gap-1">
          {loading && <Spinner label="" />}
          {text && !loading && (
            <button
              type="button"
              onClick={() => {
                onTextChange("");
                onChange(null);
                setResults([]);
                setSuggestions([]);
                inputRef.current?.focus();
                setOpen(true);
              }}
              className="tap grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-surface-3 hover:text-ink"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
          {allowGps && !text && (
            <button
              type="button"
              onClick={requestGps}
              className="tap grid size-8 place-items-center rounded-lg text-primary-600 hover:bg-primary-50"
              aria-label="Use my current location"
              title="Use my current location"
            >
              <Crosshair
                className={`size-4 ${gpsState === "locating" ? "animate-pulse" : ""}`}
              />
            </button>
          )}
        </div>
      </div>

      {showList && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[600] overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <ul
            id={listId}
            role="listbox"
            aria-label={`${label} suggestions`}
            className="max-h-72 overflow-y-auto py-1"
          >
            {!searching && recents.length > 0 && (
              <li className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                Recent
              </li>
            )}

            {showSuggestionsHeading && (
              <li className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                Did you mean
              </li>
            )}

            {rows.map((row, index) => {
              const id = `${listId}-${index}`;
              const active = index === safeIndex;
              const common = {
                id,
                role: "option" as const,
                "aria-selected": active,
                onMouseEnter: () => setActiveIndex(index),
                onClick: () => select(row),
              };

              if (row.kind === "gps") {
                return (
                  <li key={id} {...common} className="cursor-pointer">
                    <span
                      className={`flex items-center gap-3 px-3 py-2.5 text-sm font-semibold ${
                        active ? "bg-primary-50 text-primary-700" : "text-primary-600"
                      }`}
                    >
                      <span className="grid size-8 place-items-center rounded-full bg-primary-50">
                        <Crosshair className="size-4" aria-hidden />
                      </span>
                      Use my current location
                    </span>
                  </li>
                );
              }

              if (row.kind === "recent") {
                return (
                  <li
                    key={`recent-${row.place.id}`}
                    {...common}
                    className="cursor-pointer"
                  >
                    <span
                      className={`flex items-center gap-3 px-3 py-2.5 text-sm ${
                        active ? "bg-primary-50" : ""
                      }`}
                    >
                      <span className="grid size-8 place-items-center rounded-full bg-surface-3 text-ink-muted">
                        <Clock className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink">
                          {row.place.name}
                        </span>
                        <span className="block text-xs text-ink-muted">
                          {categoryLabel(row.place.category)}
                        </span>
                      </span>
                    </span>
                  </li>
                );
              }

              return (
                <li key={`hit-${row.hit.id}`} {...common} className="cursor-pointer">
                  <span
                    className={`flex items-center gap-3 px-3 py-2.5 text-sm ${
                      active ? "bg-primary-50" : ""
                    }`}
                  >
                    <span className="grid size-8 place-items-center rounded-full bg-surface-3 text-ink-muted">
                      <MapPin className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">
                        {row.hit.name}
                      </span>
                      <span className="block truncate text-xs text-ink-muted">
                        {categoryLabel(row.hit.category)}
                        {row.hit.building ? ` · ${row.hit.building}` : ""}
                      </span>
                    </span>
                    {row.suggestion && (
                      <span className="ml-auto rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-700">
                        similar
                      </span>
                    )}
                  </span>
                </li>
              );
            })}

            {rows.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-ink-muted">
                {loading ? (
                  <Spinner label="Searching..." />
                ) : trimmed ? (
                  <>
                    No places match “{trimmed}”
                    <span className="mt-1 block text-xs">
                      Try a shorter word - typos are tolerated.
                    </span>
                  </>
                ) : (
                  "Start typing to search the campus directory."
                )}
              </li>
            )}
          </ul>

          <div className="flex items-center justify-between border-t border-line bg-surface-2 px-3 py-1.5 text-[11px] text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <CornerDownLeft className="size-3" aria-hidden /> select
            </span>
            <span>
              {rows.length} {rows.length === 1 ? "place" : "places"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function labelOf(place: PlaceRef): string {
  if (place.type === "gps") return place.name ?? "My location";
  return place.name;
}
