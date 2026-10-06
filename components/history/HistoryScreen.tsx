"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, MapPin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState, Spinner } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, ApiError } from "@/lib/client/api";
import { formatDistance } from "@/lib/geo/eta";
import { timeAgo } from "@/lib/format";
import type { PlaceRef } from "@/components/navigate/types";

interface HistoryItem {
  id: number;
  distanceM: number;
  durationMin: number;
  createdAt: string;
  from: PlaceRef | null;
  to: PlaceRef | null;
}

function endpointName(place: PlaceRef | null): string {
  if (!place) return "Unknown";
  if (place.type === "gps") return place.name ?? "My location";
  return place.name;
}

function endpointParam(place: PlaceRef | null): string | undefined {
  if (!place) return undefined;
  if (place.type === "gps") return `gps:${place.lat.toFixed(6)},${place.lng.toFixed(6)}`;
  return String(place.id);
}

export function HistoryScreen() {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ history: HistoryItem[] }>("/api/history")
      .then((data) => {
        if (!cancelled) setItems(data.history ?? []);
      })
      .catch((error: unknown) => {
        if (!cancelled && error instanceof ApiError) {
          toast.push(error.message, "error");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  function open(item: HistoryItem) {
    const params = new URLSearchParams();
    const from = endpointParam(item.from);
    const to = endpointParam(item.to);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    router.push(`/navigate?${params.toString()}`);
  }

  async function clearAll() {
    setClearing(true);
    try {
      await apiFetch("/api/history", { method: "DELETE" });
      setItems([]);
      toast.success("Route history cleared");
    } catch {
      toast.error("Could not clear history");
    } finally {
      setClearing(false);
    }
  }

  if (loading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner label="Loading your route history..." />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-ink">Route history</h1>
            <p className="text-sm text-ink-muted">
              Every route you have planned, newest first.
            </p>
          </div>
          {items.length > 0 && (
            <Button size="sm" variant="ghost" onClick={clearAll} loading={clearing}>
              <Trash2 className="size-4" aria-hidden />
              Clear
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="No routes yet"
              description="Plan a route from the Navigate tab and it will appear here for quick access."
              action={
                <Button size="sm" onClick={() => router.push("/navigate")}>
                  Plan a route
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => open(item)}
                  className="card tap flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:border-primary-300"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-600">
                    <MapPin className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink">
                      {endpointName(item.from)} → {endpointName(item.to)}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-muted">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" aria-hidden />
                        {timeAgo(item.createdAt)}
                      </span>
                      <span>{formatDistance(item.distanceM)}</span>
                      <span>{item.durationMin} min walk</span>
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
