import { asc } from "drizzle-orm";
import type { Db } from "@/db";
import { edges, graphMeta, nodes } from "@/db/schema";
import {
  buildGraph,
  type EdgeInput,
  type Graph,
  type NodeInput,
} from "@/lib/routing/graph";

interface GraphRows {
  version: number;
  nodes: NodeInput[];
  edges: EdgeInput[];
}

/**
 * Module-level graph cache keyed by `graph_meta.version`.
 *
 * Every node/edge edit (admin map editor) bumps the version, so the next route
 * request detects the change with a single cheap SELECT and rebuilds only then.
 * Serverless-safe: a cold start simply finds no cache and builds from the
 * database - correctness never depends on the cache existing.
 */
let cachedVersion: number | null = null;
let cachedRows: GraphRows | null = null;
const graphsByKey = new Map<string, Graph>();

async function readVersion(db: Db): Promise<number> {
  try {
    const rows = await db
      .select({ version: graphMeta.version })
      .from(graphMeta)
      .limit(1);
    return rows[0]?.version ?? 0;
  } catch {
    return 0;
  }
}

async function readRows(db: Db, version: number): Promise<GraphRows> {
  const [nodeRows, edgeRows] = await Promise.all([
    db.select().from(nodes).orderBy(asc(nodes.id)),
    db.select().from(edges).orderBy(asc(edges.id)),
  ]);
  return { version, nodes: nodeRows, edges: edgeRows };
}

export interface LoadedGraph {
  graph: Graph;
  version: number;
  cacheHit: boolean;
  nodeCount: number;
  edgeCount: number;
}

export async function loadGraph(
  db: Db,
  options: { avoidStairs?: boolean } = {},
): Promise<LoadedGraph> {
  const version = await readVersion(db);

  if (cachedVersion !== version) {
    cachedVersion = version;
    cachedRows = null;
    graphsByKey.clear();
  }

  if (!cachedRows) {
    cachedRows = await readRows(db, version);
  }

  const key = options.avoidStairs ? "v1:avoid-stairs" : "v1:allow-stairs";
  const cached = graphsByKey.get(key);
  const graph =
    cached ??
    buildGraph(cachedRows.nodes, cachedRows.edges, {
      avoidStairs: options.avoidStairs,
    });
  if (!cached) graphsByKey.set(key, graph);

  return {
    graph,
    version,
    cacheHit: Boolean(cached),
    nodeCount: cachedRows.nodes.length,
    edgeCount: cachedRows.edges.length,
  };
}

/** Drops every cached layer (used by the admin map editor after a write). */
export function invalidateGraphCache(): void {
  cachedVersion = null;
  cachedRows = null;
  graphsByKey.clear();
}
