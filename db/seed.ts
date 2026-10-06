/**
 * Seeds the database with a placeholder MAPOLY campus layout:
 * 26 locations, 14 junction nodes, ~70 edges, graph metadata and the admin
 * account.
 *
 * Usage:
 *   npm run db:seed            # only fills empty tables
 *   npm run db:seed -- --force # wipes locations/nodes/edges first
 */
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./index";
import { edges, graphMeta, locations, nodes, users } from "./schema";
import { edges as seedEdges, junctions, places } from "./seed-data";
import { hashPassword } from "@/lib/auth/password";
import { CAMPUS_CENTER } from "@/lib/config";
import { haversineMeters, offsetMetersToLatLng } from "@/lib/geo/haversine";
import { loadEnvFiles } from "@/lib/load-env";

loadEnvFiles();

const seedEnv = z.object({
  DATABASE_URL: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
});

function loadEnv() {
  const parsed = seedEnv.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  });
  if (!parsed.success) {
    console.error(
      "\nCannot seed - environment problem:\n" +
        parsed.error.issues.map((i) => `  - ${i.message}`).join("\n") +
        "\n\nCopy .env.example to .env and fill in the values.\n",
    );
    process.exit(1);
  }
  if (!parsed.data.DATABASE_URL && process.env.DB_DRIVER !== "pglite") {
    console.error(
      "\nCannot seed - DATABASE_URL is missing.\n" +
        "Copy .env.example to .env and fill in the values,\n" +
        "or set DB_DRIVER=pglite to use the embedded local database.\n",
    );
    process.exit(1);
  }
  return parsed.data;
}

function searchTextFor(p: (typeof places)[number]): string {
  return [p.name, p.shortCode, p.building, p.category, p.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

async function main() {
  const force = process.argv.includes("--force");
  loadEnv();
  const db = await getDb();

  // pg_trgm powers typo-tolerant search ("lib" / "lbrary" -> Library).
  // Embedded PGlite builds without contrib extensions, so this is best effort.
  try {
    await db.execute(sql`create extension if not exists pg_trgm`);
  } catch (error) {
    console.warn(
      "pg_trgm unavailable - falling back to plain ILIKE search:",
      error instanceof Error ? error.message : error,
    );
  }

  const existing = await db
    .select({ id: locations.id })
    .from(locations)
    .limit(1);

  if (existing.length > 0 && !force) {
    console.log("Locations already present - skipping place/graph seed.");
    console.log("Run `npm run db:seed -- --force` to rebuild them.");
  } else {
    if (force) {
      console.log("Removing existing locations, nodes and edges...");
      await db.execute(sql`delete from edges`);
      await db.execute(sql`delete from nodes`);
      await db.execute(sql`delete from locations`);
    }

    console.log(`Inserting ${places.length} locations...`);
    const insertedLocations = await db
      .insert(locations)
      .values(
        places.map((p) => {
          const point = offsetMetersToLatLng(CAMPUS_CENTER, p.x, p.y);
          return {
            name: p.name,
            category: p.category,
            description: p.description,
            latitude: point.lat,
            longitude: point.lng,
            shortCode: p.shortCode ?? null,
            building: p.building ?? null,
            floorInfo: p.floorInfo ?? null,
            openingHours: p.openingHours ?? null,
            searchText: searchTextFor(p),
          };
        }),
      )
      .returning({ id: locations.id, name: locations.name });

    const locationIdByKey = new Map<string, number>();
    places.forEach((p, i) => locationIdByKey.set(p.key, insertedLocations[i].id));

    console.log(`Inserting ${junctions.length} junction nodes...`);
    const junctionRows = await db
      .insert(nodes)
      .values(
        junctions.map((j) => {
          const point = offsetMetersToLatLng(CAMPUS_CENTER, j.x, j.y);
          return {
            latitude: point.lat,
            longitude: point.lng,
            locationId: null,
            label: j.label,
          };
        }),
      )
      .returning({ id: nodes.id });
    const nodeIdByKey = new Map<string, number>();
    junctions.forEach((j, i) => nodeIdByKey.set(j.key, junctionRows[i].id));

    console.log(`Inserting ${places.length} location nodes...`);
    const locationNodes = await db
      .insert(nodes)
      .values(
        places.map((p) => {
          const point = offsetMetersToLatLng(CAMPUS_CENTER, p.x, p.y);
          return {
            latitude: point.lat,
            longitude: point.lng,
            locationId: locationIdByKey.get(p.key) ?? null,
            label: p.name,
          };
        }),
      )
      .returning({ id: nodes.id, latitude: nodes.latitude, longitude: nodes.longitude });
    places.forEach((p, i) => nodeIdByKey.set(p.key, locationNodes[i].id));

    console.log(`Inserting ${seedEdges.length} edges...`);
    // Every seed key (junction or place) resolves to a coordinate and a node id.
    const pointByKey = new Map<string, { lat: number; lng: number }>();
    junctions.forEach((j) =>
      pointByKey.set(j.key, offsetMetersToLatLng(CAMPUS_CENTER, j.x, j.y)),
    );
    places.forEach((p) =>
      pointByKey.set(p.key, offsetMetersToLatLng(CAMPUS_CENTER, p.x, p.y)),
    );

    await db.insert(edges).values(
      seedEdges.map((e) => {
        const fromId = nodeIdByKey.get(e.from);
        const toId = nodeIdByKey.get(e.to);
        const fromPoint = pointByKey.get(e.from);
        const toPoint = pointByKey.get(e.to);
        if (!fromId || !toId || !fromPoint || !toPoint) {
          throw new Error(`Seed edge references unknown key: ${e.from} -> ${e.to}`);
        }
        return {
          fromNode: fromId,
          toNode: toId,
          distanceM: Math.round(haversineMeters(fromPoint, toPoint) * 10) / 10,
          pathType: e.pathType ?? "footpath",
          isBidirectional: e.isBidirectional ?? true,
        };
      }),
    );

    const meta = await db.select().from(graphMeta).limit(1);
    if (meta.length === 0) {
      await db.insert(graphMeta).values({ version: 1 });
    } else {
      await db
        .update(graphMeta)
        .set({ version: meta[0].version + 1, updatedAt: new Date() })
        .where(sql`${graphMeta.id} = ${meta[0].id}`);
    }
    console.log("Graph metadata version bumped (cache invalidation).");
  }

  // Typo-tolerant search index (needs pg_trgm, created above).
  try {
    await db.execute(sql`
      create index if not exists locations_search_text_trgm
      on locations using gin (search_text gin_trgm_ops)
    `);
  } catch {
    console.warn("Skipping trigram index - pg_trgm is not available here.");
  }

  const { ADMIN_EMAIL, ADMIN_PASSWORD } = loadEnv();
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const found = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = lower(${ADMIN_EMAIL})`)
      .limit(1);
    if (found.length === 0) {
      await db.insert(users).values({
        fullName: "Campus Administrator",
        email: ADMIN_EMAIL.toLowerCase(),
        passwordHash: await hashPassword(ADMIN_PASSWORD),
        role: "admin",
      });
      console.log(`Created admin account: ${ADMIN_EMAIL}`);
    } else {
      console.log(`Admin account already exists: ${ADMIN_EMAIL}`);
    }
  } else {
    console.warn(
      "ADMIN_EMAIL / ADMIN_PASSWORD not set - skipping admin account.",
    );
  }

  // Demo logins so a freshly seeded database is usable straight away.
  const demoAccounts = [
    {
      fullName: "Adeola Student",
      email: "student@mapoly.edu.ng",
      role: "student" as const,
    },
    {
      fullName: "Chika Visitor",
      email: "visitor@mapoly.edu.ng",
      role: "visitor" as const,
    },
  ];
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "Campus2026!";
  for (const account of demoAccounts) {
    const found = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = lower(${account.email})`)
      .limit(1);
    if (found.length === 0) {
      await db.insert(users).values({
        ...account,
        passwordHash: await hashPassword(demoPassword),
      });
      console.log(`Created demo account: ${account.email}`);
    }
  }

  console.log("\nSeed complete.");
  console.log(
    "NOTE: seeded coordinates are placeholders - calibrate them with the",
  );
  console.log("admin Map Editor (Admin > Map Editor) before demoing.");
}

main()
  // PGlite keeps its worker alive after the last query: exit explicitly so
  // `npm run db:seed` returns to the shell instead of hanging.
  .then(() => new Promise<void>((resolve) => setTimeout(resolve, 50)))
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nSeed failed:");
    console.error(error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) console.error(error.stack);
    process.exit(1);
  });
