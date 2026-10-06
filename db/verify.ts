/**
 * Seed verification (Chapter 3, test goal 3: "the database stores and
 * retrieves data accurately").
 *
 * Run: npm run db:verify
 */
import { sql } from "drizzle-orm";
import { getDb } from "./index";
import { edges, locations, nodes, users } from "./schema";
import { loadEnvFiles } from "@/lib/load-env";

loadEnvFiles();

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

async function main() {
  const db = await getDb();
  const checks: Check[] = [];

  const locationRows = await db.select().from(locations);
  const nodeRows = await db.select().from(nodes);
  const edgeRows = await db.select().from(edges);
  const adminRows = await db
    .select({ email: users.email, role: users.role })
    .from(users);

  checks.push({
    name: "At least 25 seeded locations",
    ok: locationRows.length >= 25,
    detail: `${locationRows.length} locations`,
  });
  checks.push({
    name: "Every location has plausible coordinates near the campus centre",
    ok: locationRows.every(
      (l) => l.latitude > 7.1 && l.latitude < 7.2 && l.longitude > 3.3 && l.longitude < 3.4,
    ),
    detail: `lat ${locationRows[0]?.latitude.toFixed(4)}, lng ${locationRows[0]?.longitude.toFixed(4)}`,
  });
  checks.push({
    name: "Every location has searchable text",
    ok: locationRows.every((l) => l.searchText.length > 0),
    detail: `${locationRows.filter((l) => l.searchText.length > 0).length}/${locationRows.length}`,
  });
  checks.push({
    name: "Every location has its own graph node",
    ok: nodeRows.filter((n) => n.locationId !== null).length === locationRows.length,
    detail: `${nodeRows.filter((n) => n.locationId !== null).length} location nodes`,
  });
  checks.push({
    name: "All edges reference existing nodes",
    ok: edgeRows.every(
      (e) =>
        nodeRows.some((n) => n.id === e.fromNode) &&
        nodeRows.some((n) => n.id === e.toNode),
    ),
    detail: `${edgeRows.length} edges`,
  });
  checks.push({
    name: "All edges have a positive distance",
    ok: edgeRows.every((e) => typeof e.distanceM === "number" && e.distanceM > 0),
    detail: "distance_m > 0",
  });

  // Connectivity: every node must be reachable from the first node (undirected).
  const adjacency = new Map<number, number[]>();
  for (const e of edgeRows) {
    if (!e.isActive) continue;
    const a = adjacency.get(e.fromNode) ?? [];
    a.push(e.toNode);
    adjacency.set(e.fromNode, a);
    if (e.isBidirectional) {
      const b = adjacency.get(e.toNode) ?? [];
      b.push(e.fromNode);
      adjacency.set(e.toNode, b);
    }
  }
  const start = nodeRows[0].id;
  const seen = new Set<number>(start ? [start] : []);
  const queue = [start];
  while (queue.length) {
    const current = queue.pop()!;
    for (const next of adjacency.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  checks.push({
    name: "Graph is fully connected (single component)",
    ok: seen.size === nodeRows.length,
    detail: `${seen.size}/${nodeRows.length} nodes reachable`,
  });

  const admin = adminRows.find((u) => u.role === "admin");
  checks.push({
    name: "An admin account exists",
    ok: Boolean(admin),
    detail: admin?.email ?? "none",
  });

  const searchResult = await db.execute(
    sql`select name from locations where search_text ilike '%lib%' limit 5`,
  );
  const searchRows =
    (
      searchResult as unknown as { rows?: Array<{ name: string }> }
    ).rows ?? [];
  checks.push({
    name: "Search text finds the Library for 'lib'",
    ok: searchRows.some((r) => r.name.toLowerCase().includes("library")),
    detail: searchRows.map((r) => r.name).join(", ") || "no rows",
  });

  let failed = 0;
  for (const check of checks) {
    if (!check.ok) failed += 1;
    console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.name} (${check.detail})`);
  }
  console.log(`\n${checks.length - failed}/${checks.length} checks passed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
