"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Boxes, CheckCircle2, MapPin, Navigation, Route, Users } from "lucide-react";
import { Spinner } from "@/components/ui/Feedback";
import { apiFetch, ApiError } from "@/lib/client/api";
import { formatDistance } from "@/lib/geo/eta";

interface AdminStats {
  users: number;
  admins: number;
  locations: number;
  activeLocations: number;
  nodes: number;
  edges: number;
  activeEdges: number;
  routes: number;
  averageDistanceM: number | null;
  averageRating: number | null;
  feedbackCount: number;
  graphVersion: number;
  reachableNodes: number;
  connected: boolean;
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon: typeof Users;
}) {
  return (
    <div className="card px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
          {label}
        </p>
        <Icon className="size-4 text-primary-600" aria-hidden />
      </div>
      <p className="mt-1.5 text-2xl font-extrabold text-ink">{value}</p>
      {detail && <p className="mt-0.5 text-xs text-ink-muted">{detail}</p>}
    </div>
  );
}

export function OverviewScreen() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<AdminStats>("/api/admin/stats")
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err: unknown) => {
        if (!cancelled && err instanceof ApiError) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm font-medium text-danger-600">
        {error}
      </p>
    );
  }

  if (!stats) {
    return (
      <div className="grid h-48 place-items-center">
        <Spinner label="Loading campus statistics..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="overview-health">
        <h2 id="overview-health" className="mb-2 text-sm font-bold text-ink">
          Graph health
        </h2>
        <div
          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
            stats.connected
              ? "border-success-200 bg-success-50"
              : "border-warning-200 bg-warning-50"
          }`}
        >
          {stats.connected ? (
            <CheckCircle2 className="size-5 text-success-600" aria-hidden />
          ) : (
            <Route className="size-5 text-warning-600" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">
              {stats.connected
                ? "Every node is reachable"
                : `${stats.reachableNodes} of ${stats.nodes} nodes reachable`}
            </p>
            <p className="text-xs text-ink-muted">
              Graph version {stats.graphVersion} · {stats.activeEdges} of{" "}
              {stats.edges} walkway segments active
            </p>
          </div>
          <Link href="/admin/graph" className="tap ml-auto btn btn-ghost text-sm">
            Open editor
          </Link>
        </div>
      </section>

      <section aria-labelledby="overview-counts">
        <h2 id="overview-counts" className="mb-2 text-sm font-bold text-ink">
          Counts
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="Users"
            value={stats.users}
            detail={`${stats.admins} admin`}
            icon={Users}
          />
          <StatCard
            label="Places"
            value={stats.locations}
            detail={`${stats.activeLocations} active`}
            icon={MapPin}
          />
          <StatCard label="Nodes" value={stats.nodes} icon={Boxes} />
          <StatCard
            label="Edges"
            value={stats.edges}
            detail={`${stats.activeEdges} active`}
            icon={Route}
          />
          <StatCard
            label="Routes"
            value={stats.routes}
            detail={
              stats.averageDistanceM !== null
                ? `avg ${formatDistance(stats.averageDistanceM)}`
                : "no routes yet"
            }
            icon={Navigation}
          />
          <StatCard
            label="Rating"
            value={stats.averageRating ?? "—"}
            detail={`${stats.feedbackCount} reviews`}
            icon={CheckCircle2}
          />
        </div>
      </section>

      <section aria-labelledby="overview-actions">
        <h2 id="overview-actions" className="mb-2 text-sm font-bold text-ink">
          Manage
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link href="/admin/locations" className="card tap px-4 py-3.5 transition hover:border-primary-300">
            <p className="font-bold text-ink">Places</p>
            <p className="text-xs text-ink-muted">
              Add, rename or retire campus locations.
            </p>
          </Link>
          <Link href="/admin/graph" className="card tap px-4 py-3.5 transition hover:border-primary-300">
            <p className="font-bold text-ink">Map editor</p>
            <p className="text-xs text-ink-muted">
              Calibrate coordinates and edit walkway edges.
            </p>
          </Link>
          <Link href="/admin/users" className="card tap px-4 py-3.5 transition hover:border-primary-300">
            <p className="font-bold text-ink">Users &amp; feedback</p>
            <p className="text-xs text-ink-muted">
              Change roles and read submitted ratings.
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
