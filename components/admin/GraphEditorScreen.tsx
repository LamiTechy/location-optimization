"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GitBranch, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState, Spinner } from "@/components/ui/Feedback";
import { Field, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, ApiError } from "@/lib/client/api";
import type { LatLng } from "@/lib/geo/types";
import type { MarkerDef, PolylineDef } from "@/components/map/adapter";

const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
});

interface GraphNode {
  id: number;
  latitude: number;
  longitude: number;
  label: string | null;
  locationId: number | null;
  locationName: string | null;
}

interface GraphEdge {
  id: number;
  fromNode: number;
  toNode: number;
  distanceM: number | null;
  pathType: "road" | "footpath" | "stairs" | "shortcut";
  isBidirectional: boolean;
  isActive: boolean;
}

interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
  version: number;
}

interface PlaceOption {
  id: number;
  name: string;
  category: string;
}

const CAMPUS_CENTER: LatLng = { lat: 7.1566, lng: 3.3408 };
const PATH_TYPES: GraphEdge["pathType"][] = ["footpath", "road", "stairs", "shortcut"];

type Panel = "node" | "edge";

/** Loads the graph and the place list together (no state updates inside). */
function fetchGraphData(): Promise<{
  graph: GraphPayload;
  places: PlaceOption[];
}> {
  return Promise.all([
    apiFetch<GraphPayload>("/api/admin/graph"),
    apiFetch<{ locations: PlaceOption[] }>("/api/admin/locations"),
  ]).then(([graph, placeData]) => ({
    graph,
    places: placeData.locations ?? [],
  }));
}

export function GraphEditorScreen() {
  const toast = useToast();
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [places, setPlaces] = useState<PlaceOption[]>([]);
  const [panel, setPanel] = useState<Panel>("node");
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<number | null>(null);
  const [pendingNode, setPendingNode] = useState<LatLng | null>(null);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [locationId, setLocationId] = useState<string>("none");
  const [edgeFrom, setEdgeFrom] = useState<string>("");
  const [edgeTo, setEdgeTo] = useState<string>("");
  const [edgePathType, setEdgePathType] = useState<GraphEdge["pathType"]>("footpath");
  const [edgeActive, setEdgeActive] = useState(true);
  const [edgeBidirectional, setEdgeBidirectional] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchGraphData();
      setGraph(data.graph);
      setPlaces(data.places);
    } catch (error: unknown) {
      if (error instanceof ApiError) toast.push(error.message, "error");
    }
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    fetchGraphData()
      .then((data) => {
        if (cancelled) return;
        setGraph(data.graph);
        setPlaces(data.places);
      })
      .catch((error: unknown) => {
        if (!cancelled && error instanceof ApiError) toast.push(error.message, "error");
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const nodeById = useMemo(() => {
    const map = new Map<number, GraphNode>();
    for (const node of graph?.nodes ?? []) map.set(node.id, node);
    return map;
  }, [graph]);

  const nodeOptions = useMemo(
    () =>
      (graph?.nodes ?? [])
        .slice()
        .sort((a, b) => a.id - b.id)
        .map((node) => ({
          id: node.id,
          text: `#${node.id} · ${node.label ?? node.locationName ?? "junction"}`,
        })),
    [graph],
  );

  const markers: MarkerDef[] = useMemo(() => {
    const list: MarkerDef[] = (graph?.nodes ?? []).map((node) => ({
      id: `n${node.id}`,
      position: { lat: node.latitude, lng: node.longitude },
      label: node.label ?? node.locationName ?? `Node ${node.id}`,
      kind: selectedNode === node.id ? "end" : "location",
      badge: String(node.id),
    }));
    if (pendingNode) {
      list.push({
        id: "pending",
        position: pendingNode,
        label: "New node (not saved yet)",
        kind: "start",
        badge: "+",
      });
    }
    return list;
  }, [graph, selectedNode, pendingNode]);

  const overlays: PolylineDef[] = useMemo(() => {
    const layers: PolylineDef[] = (graph?.edges ?? []).map((edge) => {
      const from = nodeById.get(edge.fromNode);
      const to = nodeById.get(edge.toNode);
      const positions =
        from && to
          ? [
              { lat: from.latitude, lng: from.longitude },
              { lat: to.latitude, lng: to.longitude },
            ]
          : [];
      const isSelected = selectedEdge === edge.id;
      return {
        id: `e${edge.id}`,
        positions,
        color: isSelected
          ? "#2044d8"
          : edge.pathType === "stairs"
            ? "#d97706"
            : "#64748b",
        weight: isSelected ? 7 : 4,
        dashed: !edge.isActive,
      };
    });
    return layers;
  }, [graph, nodeById, selectedEdge]);

  const fitPoints = useMemo(
    () =>
      (graph?.nodes ?? []).map((node) => ({
        lat: node.latitude,
        lng: node.longitude,
      })),
    [graph],
  );

  function selectNode(node: GraphNode) {
    setPanel("node");
    setSelectedNode(node.id);
    setSelectedEdge(null);
    setLabel(node.label ?? "");
    setLocationId(node.locationId ? String(node.locationId) : "none");
    setPendingNode(null);
  }

  function resetNodeForm() {
    setSelectedNode(null);
    setLabel("");
    setLocationId("none");
    setPendingNode(null);
  }

  function onMapClick(point: LatLng) {
    setPanel("node");
    setSelectedNode(null);
    setPendingNode(point);
  }

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof ApiError ? error.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function createNode() {
    if (!pendingNode) {
      toast.error("Click the map to choose where the node goes");
      return;
    }
    await run(async () => {
      await apiFetch("/api/admin/nodes", {
        method: "POST",
        json: {
          latitude: Number(pendingNode.lat.toFixed(6)),
          longitude: Number(pendingNode.lng.toFixed(6)),
          label: label.trim() || null,
          locationId: locationId === "none" ? null : Number(locationId),
        },
      });
      setPendingNode(null);
      setLabel("");
    }, "Node added to the graph");
  }

  async function saveNode() {
    if (!selectedNode) return;
    const node = nodeById.get(selectedNode);
    if (!node) return;
    await run(async () => {
      await apiFetch("/api/admin/nodes", {
        method: "PATCH",
        json: {
          id: selectedNode,
          latitude: node.latitude,
          longitude: node.longitude,
          label: label.trim() || null,
          locationId: locationId === "none" ? null : Number(locationId),
        },
      });
    }, "Node saved");
  }

  async function deleteNode() {
    if (!selectedNode) return;
    await run(async () => {
      await apiFetch(`/api/admin/nodes?id=${selectedNode}`, { method: "DELETE" });
      resetNodeForm();
    }, "Node removed (connected edges cascade)");
  }

  async function createEdge() {
    if (!edgeFrom || !edgeTo) {
      toast.error("Pick both nodes");
      return;
    }
    if (edgeFrom === edgeTo) {
      toast.error("Choose two different nodes");
      return;
    }
    await run(async () => {
      await apiFetch("/api/admin/edges", {
        method: "POST",
        json: {
          fromNode: Number(edgeFrom),
          toNode: Number(edgeTo),
          pathType: edgePathType,
          isBidirectional: edgeBidirectional,
          isActive: edgeActive,
        },
      });
      setEdgeFrom("");
      setEdgeTo("");
    }, "Edge added");
  }

  async function saveEdge() {
    if (!selectedEdge) return;
    await run(async () => {
      await apiFetch("/api/admin/edges", {
        method: "PATCH",
        json: {
          id: selectedEdge,
          pathType: edgePathType,
          isBidirectional: edgeBidirectional,
          isActive: edgeActive,
        },
      });
    }, "Edge saved");
  }

  async function deleteEdge() {
    if (!selectedEdge) return;
    await run(async () => {
      await apiFetch(`/api/admin/edges?id=${selectedEdge}`, { method: "DELETE" });
      setSelectedEdge(null);
    }, "Edge removed");
  }

  if (!graph) {
    return (
      <div className="grid h-48 place-items-center">
        <Spinner label="Loading the campus graph..." />
      </div>
    );
  }

  const activeEdges = graph.edges.filter((edge) => edge.isActive).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
          <GitBranch className="size-4 text-primary-600" aria-hidden />
          v{graph.version}
        </span>
        <span>
          {graph.nodes.length} nodes · {graph.edges.length} edges ({activeEdges}{" "}
          active)
        </span>
        <span className="ml-auto hidden text-xs sm:block">
          Click the map to drop a node, click a marker or line to edit it.
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Map */}
        <div className="h-[20rem] overflow-hidden rounded-2xl border border-line lg:h-[34rem]">
          <MapView
            center={CAMPUS_CENTER}
            zoom={16}
            markers={markers}
            overlays={overlays}
            fitPoints={fitPoints}
            onMapClick={onMapClick}
            onOverlayClick={(id) => {
              const edgeId = Number(id.replace(/^e/, ""));
              setPanel("edge");
              setSelectedEdge(edgeId);
              setSelectedNode(null);
              const edge = graph.edges.find((row) => row.id === edgeId);
              if (edge) {
                setEdgePathType(edge.pathType);
                setEdgeActive(edge.isActive);
                setEdgeBidirectional(edge.isBidirectional);
              }
            }}
            onMarkerClick={(marker) => {
              const id = Number(marker.id.replace(/^n/, ""));
              const node = nodeById.get(id);
              if (node) selectNode(node);
            }}
          />
        </div>

        {/* Panel */}
        <div className="card px-4 py-4">
          <div className="mb-4 flex gap-1 rounded-xl bg-surface-3 p-1">
            {(["node", "edge"] as Panel[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setPanel(tab)}
                className={`tap flex-1 rounded-lg px-3 py-1.5 text-sm font-bold capitalize transition ${
                  panel === tab
                    ? "bg-surface text-ink shadow-card"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {tab} editor
              </button>
            ))}
          </div>

          {panel === "node" ? (
            <div className="space-y-3">
              <p className="text-xs text-ink-muted">
                {selectedNode
                  ? `Editing node #${selectedNode}`
                  : pendingNode
                    ? `New node at ${pendingNode.lat.toFixed(5)}, ${pendingNode.lng.toFixed(5)}`
                    : "Select a node on the map, or click the map to add one."}
              </p>

              <Field label="Label">
                {(props) => (
                  <Input
                    {...props}
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder="e.g. Library junction"
                  />
                )}
              </Field>

              <Field label="Attached place" hint="Leave empty for a plain junction.">
                {(props) => (
                  <select
                    {...props}
                    className="input"
                    value={locationId}
                    onChange={(event) => setLocationId(event.target.value)}
                  >
                    <option value="none">None (junction)</option>
                    {places.map((place) => (
                      <option key={place.id} value={place.id}>
                        {place.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              <div className="flex flex-wrap gap-2">
                {selectedNode ? (
                  <>
                    <Button size="sm" onClick={saveNode} loading={busy}>
                      <Save className="size-4" aria-hidden /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={deleteNode} loading={busy}>
                      <Trash2 className="size-4" aria-hidden /> Delete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={resetNodeForm}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={createNode} loading={busy}>
                    <Plus className="size-4" aria-hidden /> Add node here
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-ink-muted">
                {selectedEdge
                  ? `Editing edge #${selectedEdge}`
                  : "Click a line on the map or a row in the list below, or connect two nodes here."}
              </p>

              {selectedEdge ? (
                (() => {
                  const edge = graph.edges.find((row) => row.id === selectedEdge);
                  const from = edge ? nodeById.get(edge.fromNode) : undefined;
                  const to = edge ? nodeById.get(edge.toNode) : undefined;
                  return (
                    <p className="text-sm font-semibold text-ink">
                      #{from?.label ?? edge?.fromNode} → #{to?.label ?? edge?.toNode}
                      {edge?.distanceM ? ` · ${Math.round(edge.distanceM)} m` : ""}
                    </p>
                  );
                })()
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="From">
                    {(props) => (
                      <select
                        {...props}
                        className="input"
                        value={edgeFrom}
                        onChange={(event) => setEdgeFrom(event.target.value)}
                      >
                        <option value="">Node</option>
                        {nodeOptions.map((node) => (
                          <option key={node.id} value={node.id}>
                            {node.text}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                  <Field label="To">
                    {(props) => (
                      <select
                        {...props}
                        className="input"
                        value={edgeTo}
                        onChange={(event) => setEdgeTo(event.target.value)}
                      >
                        <option value="">Node</option>
                        {nodeOptions.map((node) => (
                          <option key={node.id} value={node.id}>
                            {node.text}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                </div>
              )}

              <Field
                label="Surface"
                hint={
                  selectedEdge
                    ? "Stairs are skipped when avoid-stairs is on."
                    : "Distance is measured automatically from the two nodes."
                }
              >
                {(props) => (
                  <select
                    {...props}
                    className="input"
                    value={edgePathType}
                    onChange={(event) =>
                      setEdgePathType(event.target.value as GraphEdge["pathType"])
                    }
                  >
                    {PATH_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              <div className="flex flex-wrap gap-4 text-sm font-semibold text-ink">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary-600"
                    checked={edgeBidirectional}
                    onChange={(event) => setEdgeBidirectional(event.target.checked)}
                  />
                  Two-way
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary-600"
                    checked={edgeActive}
                    onChange={(event) => setEdgeActive(event.target.checked)}
                  />
                  Walkable
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedEdge ? (
                  <>
                    <Button size="sm" onClick={saveEdge} loading={busy}>
                      <Save className="size-4" aria-hidden /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={deleteEdge} loading={busy}>
                      <Trash2 className="size-4" aria-hidden /> Delete
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedEdge(null)}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={createEdge} loading={busy}>
                    <Plus className="size-4" aria-hidden /> Connect nodes
                  </Button>
                )}
              </div>
            </div>
          )}

          {graph.edges.length === 0 && (
            <div className="mt-4">
              <EmptyState
                title="No walkways yet"
                description="Add nodes on the map, then connect them in the edge editor."
              />
            </div>
          )}
        </div>
      </div>

      {/* Clicking an edge on the map: overlay lines are thin, so expose a list */}
      <section aria-labelledby="edge-list-title">
        <h3 id="edge-list-title" className="mb-2 text-sm font-bold text-ink">
          Edges
        </h3>
        <div className="max-h-56 overflow-y-auto rounded-2xl border border-line bg-surface">
          <ul className="divide-y divide-line">
            {graph.edges.map((edge) => (
              <li key={edge.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPanel("edge");
                    setSelectedEdge(edge.id);
                    setSelectedNode(null);
                    setEdgePathType(edge.pathType);
                    setEdgeActive(edge.isActive);
                    setEdgeBidirectional(edge.isBidirectional);
                  }}
                  className={`tap flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-surface-3 ${
                    selectedEdge === edge.id ? "bg-primary-50" : ""
                  }`}
                >
                  <span className="font-mono text-xs text-ink-muted">#{edge.id}</span>
                  <span className="font-semibold text-ink">
                    {edge.fromNode} → {edge.toNode}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {edge.distanceM ? `${Math.round(edge.distanceM)} m` : "auto"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
                      edge.pathType === "stairs"
                        ? "bg-warning-50 text-warning-700"
                        : "bg-surface-3 text-ink-muted"
                    }`}
                  >
                    {edge.pathType}
                  </span>
                  {!edge.isActive && (
                    <span className="rounded-full bg-danger-50 px-2 py-0.5 text-[11px] font-bold text-danger-600">
                      closed
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <p className="text-xs text-ink-muted">
        Every save bumps graph version {graph.version + 1}, which invalidates the
        routing cache so the next route request rebuilds from the database.
      </p>
    </div>
  );
}
