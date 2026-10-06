"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  Gauge,
  Heart,
  Mail,
  Palette,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Feedback";
import { applyDocumentTheme } from "@/components/ui/ThemeToggle";
import { useToast } from "@/components/ui/Toast";
import type { Role, Theme } from "@/db/schema";
import { apiFetch } from "@/lib/client/api";

interface MeResponse {
  user: {
    id: number;
    fullName: string;
    email: string;
    role: Role;
    createdAt: string;
    lastLoginAt: string | null;
  };
  preferences: {
    avoidStairs: boolean;
    walkingSpeedMps: number;
    defaultStartLocationId: number | null;
    theme: Theme;
  };
  favouriteLocationIds: number[];
}

const SPEEDS: { value: number; label: string; hint: string }[] = [
  { value: 1.0, label: "Relaxed", hint: "1.0 m/s" },
  { value: 1.4, label: "Normal", hint: "1.4 m/s" },
  { value: 1.8, label: "Brisk", hint: "1.8 m/s" },
];

const THEMES: Theme[] = ["light", "dark", "system"];

export function ProfileScreen() {
  const toast = useToast();
  const [data, setData] = useState<MeResponse | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<MeResponse>("/api/auth/me")
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) toast.push("Could not load your profile", "error");
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  function update(patch: Partial<MeResponse["preferences"]>) {
    if (!data) return;
    const next = { ...data.preferences, ...patch };
    setData({ ...data, preferences: next });

    if (patch.theme) applyDocumentTheme(patch.theme);

    setSaving(true);
    apiFetch<{ preferences: MeResponse["preferences"] }>("/api/preferences", {
      method: "PATCH",
      json: patch,
    })
      .then(() => toast.success("Preference saved"))
      .catch(() => toast.error("Could not save that preference"))
      .finally(() => setSaving(false));
  }

  if (!data) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner label="Loading your profile..." />
      </div>
    );
  }

  const { user, preferences, favouriteLocationIds } = data;
  const joined = new Date(user.createdAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-6 sm:px-6">
        <h1 className="text-xl font-extrabold text-ink">Profile</h1>
        <p className="text-sm text-ink-muted">
          Your account and walking preferences.
        </p>

        {/* Identity */}
        <section className="card mt-4 flex items-center gap-4 p-5">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary-950 text-accent-400">
            <UserRound className="size-7" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold text-ink">{user.fullName}</p>
            <p className="flex items-center gap-1.5 truncate text-sm text-ink-muted">
              <Mail className="size-3.5" aria-hidden /> {user.email}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 font-bold uppercase tracking-wide text-primary-700">
                <ShieldCheck className="size-3" aria-hidden /> {user.role}
              </span>
              <span>Joined {joined}</span>
              {user.lastLoginAt && (
                <span>
                  Last login {new Date(user.lastLoginAt).toLocaleDateString()}
                </span>
              )}
            </p>
          </div>
        </section>

        {/* Walking preferences */}
        <section className="card mt-4 p-5">
          <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-ink-muted">
            <Gauge className="size-4" aria-hidden /> Walking preferences
          </h2>

          <label className="mt-4 flex items-start justify-between gap-4">
            <span>
              <span className="block text-sm font-semibold text-ink">
                Avoid stairs
              </span>
              <span className="block text-xs text-ink-muted">
                Prefer ramps and level paths when a route exists.
              </span>
            </span>
            <input
              type="checkbox"
              checked={preferences.avoidStairs}
              onChange={(event) => update({ avoidStairs: event.target.checked })}
              className="mt-1 size-5 shrink-0 accent-[var(--color-primary-600)]"
            />
          </label>

          <div className="mt-5">
            <span className="block text-sm font-semibold text-ink">Walking speed</span>
            <span className="block text-xs text-ink-muted">
              Used for the arrival estimate on every route.
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {SPEEDS.map((speed) => (
                <button
                  key={speed.value}
                  type="button"
                  className="chip"
                  data-active={Math.abs(preferences.walkingSpeedMps - speed.value) < 0.01}
                  onClick={() => update({ walkingSpeedMps: speed.value })}
                >
                  {speed.label}
                  <span className="text-[10px] opacity-70">{speed.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="card mt-4 p-5">
          <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-ink-muted">
            <Palette className="size-4" aria-hidden /> Appearance
          </h2>
          <div className="mt-3 flex gap-2">
            {THEMES.map((theme) => (
              <button
                key={theme}
                type="button"
                className="chip capitalize"
                data-active={preferences.theme === theme}
                onClick={() => update({ theme })}
              >
                {theme}
              </button>
            ))}
          </div>
        </section>

        {/* Quick stats */}
        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="card flex items-center gap-3 p-4">
            <span className="grid size-10 place-items-center rounded-xl bg-accent-100 text-accent-700">
              <Heart className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block text-lg font-extrabold text-ink">
                {favouriteLocationIds.length}
              </span>
              <span className="block text-xs text-ink-muted">Saved places</span>
            </span>
          </div>
          <div className="card flex items-center gap-3 p-4">
            <span className="grid size-10 place-items-center rounded-xl bg-primary-50 text-primary-600">
              <Clock className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">
                Preferences sync to your account
              </span>
              <span className="block text-xs text-ink-muted">
                {saving ? "Saving..." : "Saved automatically"}
              </span>
            </span>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-ink-muted">
          Password changes and account deletion are handled by the department
          office during the pilot.
        </p>

        <div className="mt-4 flex justify-center">
          <Button variant="ghost" size="sm" disabled>
            {saving ? "Saving..." : "All changes saved"}
          </Button>
        </div>
      </div>
    </div>
  );
}
