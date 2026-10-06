"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState, Spinner } from "@/components/ui/Feedback";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, ApiError } from "@/lib/client/api";
import { CATEGORY_ORDER, categoryLabel } from "@/lib/categories";
import type { LocationCategory } from "@/db/schema";

interface AdminLocation {
  id: number;
  name: string;
  category: LocationCategory;
  description: string | null;
  latitude: number;
  longitude: number;
  shortCode: string | null;
  building: string | null;
  isActive: boolean;
}

interface FormState {
  name: string;
  category: LocationCategory;
  latitude: string;
  longitude: string;
  shortCode: string;
  building: string;
  description: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  category: "other",
  latitude: "",
  longitude: "",
  shortCode: "",
  building: "",
  description: "",
  isActive: true,
};

/** Loads the admin place list (no state updates inside - safe in effects). */
function fetchAdminPlaces(): Promise<AdminLocation[]> {
  return apiFetch<{ locations: AdminLocation[] }>("/api/admin/locations").then(
    (data) => data.locations ?? [],
  );
}

export function LocationsAdminScreen() {
  const toast = useToast();
  const [items, setItems] = useState<AdminLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [connect, setConnect] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await fetchAdminPlaces());
    } catch (error: unknown) {
      if (error instanceof ApiError) toast.push(error.message, "error");
    }
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    fetchAdminPlaces()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((error: unknown) => {
        if (!cancelled && error instanceof ApiError) toast.push(error.message, "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(needle) ||
        item.building?.toLowerCase().includes(needle) ||
        item.shortCode?.toLowerCase().includes(needle),
    );
  }, [items, filter]);

  function edit(item: AdminLocation) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      category: item.category,
      latitude: String(item.latitude),
      longitude: String(item.longitude),
      shortCode: item.shortCode ?? "",
      building: item.building ?? "",
      description: item.description ?? "",
      isActive: item.isActive,
    });
    setConnect(false);
  }

  function reset() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setConnect(true);
  }

  async function save() {
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!form.name.trim()) {
      toast.error("Enter a place name");
      return;
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      toast.error("Latitude and longitude must be numbers");
      return;
    }

    const body = {
      name: form.name.trim(),
      category: form.category,
      latitude,
      longitude,
      shortCode: form.shortCode.trim() || null,
      building: form.building.trim() || null,
      description: form.description.trim() || null,
      isActive: form.isActive,
    };

    setSaving(true);
    try {
      if (editingId === null) {
        await apiFetch("/api/admin/locations", {
          method: "POST",
          json: { location: body, connect },
        });
        toast.success(connect ? "Place added and connected" : "Place added");
      } else {
        await apiFetch("/api/admin/locations", {
          method: "PATCH",
          json: { id: editingId, ...body },
        });
        toast.success("Place updated");
      }
      reset();
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof ApiError ? error.message : "Could not save the place");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: AdminLocation) {
    setBusyId(item.id);
    try {
      await apiFetch("/api/admin/locations", {
        method: "PATCH",
        json: { id: item.id, isActive: !item.isActive },
      });
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, isActive: !row.isActive } : row,
        ),
      );
      toast.success(item.isActive ? "Place retired" : "Place restored");
    } catch (error: unknown) {
      toast.error(error instanceof ApiError ? error.message : "Could not update");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: number) {
    setBusyId(id);
    try {
      await apiFetch(`/api/admin/locations?id=${id}`, { method: "DELETE" });
      if (editingId === id) reset();
      setItems((prev) => prev.filter((row) => row.id !== id));
      toast.success("Place deleted");
    } catch (error: unknown) {
      toast.error(error instanceof ApiError ? error.message : "Could not delete");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="grid h-48 place-items-center">
        <Spinner label="Loading places..." />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      {/* List */}
      <section aria-labelledby="places-list">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 id="places-list" className="text-sm font-bold text-ink">
            Places <span className="text-ink-muted">({visible.length})</span>
          </h2>
          <div className="relative ml-auto w-full sm:w-56">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <Input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter places"
              aria-label="Filter places"
              className="pl-9"
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="No places match"
            description="Clear the filter or add a new campus location."
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-3 py-2.5 font-bold">Name</th>
                  <th className="px-3 py-2.5 font-bold">Category</th>
                  <th className="px-3 py-2.5 font-bold">Coordinates</th>
                  <th className="px-3 py-2.5 font-bold">Status</th>
                  <th className="px-3 py-2.5 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-ink">{item.name}</p>
                      <p className="text-xs text-ink-muted">
                        {item.shortCode ? `${item.shortCode} · ` : ""}
                        {item.building ?? "No building"}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-ink-muted">
                      {categoryLabel(item.category)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-ink-muted">
                      {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleActive(item)}
                        disabled={busyId === item.id}
                        className={`tap rounded-full px-2.5 py-1 text-xs font-bold transition ${
                          item.isActive
                            ? "bg-success-50 text-success-700"
                            : "bg-surface-3 text-ink-muted"
                        }`}
                        title="Toggle active"
                      >
                        {item.isActive ? "Active" : "Retired"}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => edit(item)}
                          aria-label={`Edit ${item.name}`}
                          className="tap grid size-8 place-items-center rounded-lg text-ink-muted transition hover:bg-surface-3 hover:text-primary-600"
                        >
                          <Pencil className="size-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(item.id)}
                          disabled={busyId === item.id}
                          aria-label={`Delete ${item.name}`}
                          className="tap grid size-8 place-items-center rounded-lg text-ink-muted transition hover:bg-surface-3 hover:text-danger-500"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Form */}
      <section aria-labelledby="place-form" className="card h-fit px-4 py-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 id="place-form" className="text-sm font-bold text-ink">
            {editingId === null ? "Add a place" : `Editing #${editingId}`}
          </h2>
          {editingId !== null && (
            <Button size="sm" variant="ghost" onClick={reset}>
              <RotateCcw className="size-4" aria-hidden /> New
            </Button>
          )}
        </div>

        <div className="space-y-3">
          <Field label="Name">
            {(props) => (
              <Input
                {...props}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="e.g. Polytechnic Library"
              />
            )}
          </Field>

          <Field label="Category">
            {(props) => (
              <select
                {...props}
                className="input"
                value={form.category}
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value as LocationCategory })
                }
              >
                {CATEGORY_ORDER.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabel(category)}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude">
              {(props) => (
                <Input
                  {...props}
                  inputMode="decimal"
                  value={form.latitude}
                  onChange={(event) =>
                    setForm({ ...form, latitude: event.target.value })
                  }
                  placeholder="7.15660"
                />
              )}
            </Field>
            <Field label="Longitude">
              {(props) => (
                <Input
                  {...props}
                  inputMode="decimal"
                  value={form.longitude}
                  onChange={(event) =>
                    setForm({ ...form, longitude: event.target.value })
                  }
                  placeholder="3.34080"
                />
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Short code">
              {(props) => (
                <Input
                  {...props}
                  value={form.shortCode}
                  onChange={(event) =>
                    setForm({ ...form, shortCode: event.target.value })
                  }
                  placeholder="LIB"
                />
              )}
            </Field>
            <Field label="Building">
              {(props) => (
                <Input
                  {...props}
                  value={form.building}
                  onChange={(event) =>
                    setForm({ ...form, building: event.target.value })
                  }
                  placeholder="Main campus"
                />
              )}
            </Field>
          </div>

          <Field label="Description">
            {(props) => (
              <Textarea
                {...props}
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                placeholder="What is this place?"
              />
            )}
          </Field>

          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              className="size-4 accent-primary-600"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />
            Active (show in search and routing)
          </label>

          {editingId === null && (
            <label className="flex items-center gap-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                className="size-4 accent-primary-600"
                checked={connect}
                onChange={(event) => setConnect(event.target.checked)}
              />
              Connect to the nearest walkway node
            </label>
          )}

          <Button onClick={save} loading={saving} className="w-full">
            <Plus className="size-4" aria-hidden />
            {editingId === null ? "Add place" : "Save changes"}
          </Button>
        </div>
      </section>
    </div>
  );
}
