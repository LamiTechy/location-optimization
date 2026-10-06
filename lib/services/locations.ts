import { and, asc, desc, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { locations, type Location, type LocationCategory } from "@/db/schema";

export interface PublicLocation {
  id: number;
  name: string;
  category: LocationCategory;
  description: string | null;
  latitude: number;
  longitude: number;
  shortCode: string | null;
  building: string | null;
  floorInfo: string | null;
  openingHours: string | null;
  isEntrance: boolean;
  photoUrl: string | null;
  isActive: boolean;
}

export function toPublicLocation(row: Location): PublicLocation {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    latitude: row.latitude,
    longitude: row.longitude,
    shortCode: row.shortCode,
    building: row.building,
    floorInfo: row.floorInfo,
    openingHours: row.openingHours,
    isEntrance: row.isEntrance,
    photoUrl: row.photoUrl,
    isActive: row.isActive,
  };
}

/** `%` and `_` are ILIKE wildcards - escape them so user input stays literal. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export interface ListLocationsOptions {
  category?: LocationCategory;
  q?: string;
  ids?: number[];
  limit?: number;
}

export async function listLocations(
  db: Db,
  options: ListLocationsOptions = {},
): Promise<Location[]> {
  const limit = options.limit ?? 50;
  const conditions = [sql`${locations.isActive} = true`];

  if (options.category) {
    conditions.push(sql`${locations.category} = ${options.category}`);
  }
  if (options.ids && options.ids.length > 0) {
    conditions.push(
      sql`${locations.id} in (${sql.join(
        options.ids.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );
  }
  if (options.q) {
    const pattern = `%${escapeLike(options.q.toLowerCase())}%`;
    conditions.push(sql`lower(${locations.searchText}) like ${pattern}`);
  }

  return db
    .select()
    .from(locations)
    .where(and(...conditions))
    .orderBy(asc(locations.name))
    .limit(limit);
}

export async function getLocation(
  db: Db,
  id: number,
): Promise<Location | null> {
  const rows = await db.select().from(locations).where(sql`${locations.id} = ${id}`).limit(1);
  return rows[0] ?? null;
}

export async function getLocationsByIds(
  db: Db,
  ids: number[],
): Promise<Location[]> {
  if (ids.length === 0) return [];
  return db.select().from(locations).where(sql`${locations.id} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);
}

export interface SearchResult {
  results: Location[];
  /** Populated only when nothing matched directly - typo suggestions. */
  suggestions: Location[];
}

/**
 * Location search for the autocomplete box.
 *
 * 1. Direct match: ILIKE over `search_text` (name, short code, building,
 *    category and description) - this is what makes "lib" find the Library.
 * 2. When nothing matches, fall back to pg_trgm `similarity()` so typos such
 *    as "lbrary" still return suggestions. The extension exists on Neon and is
 *    enabled for the embedded dev database; if it is missing the query is
 *    caught and the client simply shows "no results".
 */
export async function searchLocations(
  db: Db,
  query: { q: string; category?: LocationCategory; limit?: number },
): Promise<SearchResult> {
  const limit = query.limit ?? 10;
  const pattern = `%${escapeLike(query.q.toLowerCase())}%`;
  const categoryFilter = query.category
    ? and(sql`${locations.category} = ${query.category}`)
    : undefined;

  const conditions = [
    sql`lower(${locations.searchText}) like ${pattern} or lower(${locations.name}) like ${pattern}`,
    sql`${locations.isActive} = true`,
  ];
  if (categoryFilter) conditions.push(categoryFilter);

  // Prefix matches rank above mid-word matches; shorter names above longer.
  const results = await db
    .select()
    .from(locations)
    .where(and(...conditions))
    .orderBy(
      sql`case when lower(${locations.name}) like ${query.q.toLowerCase()} || '%' then 0 else 1 end`,
      sql`length(${locations.name})`,
      asc(locations.name),
    )
    .limit(limit);

  if (results.length > 0) return { results, suggestions: [] };

  // Typo-tolerant suggestions (requires pg_trgm).
  // `word_similarity` compares the query's trigrams against any part of the
  // stored text, so "lbrary" still finds "Polytechnic Library".
  const needle = query.q.toLowerCase();
  try {
    const rank = sql`greatest(
        word_similarity(${needle}, lower(${locations.name})),
        word_similarity(${needle}, lower(${locations.searchText}))
      )`;
    const suggestions = await db
      .select()
      .from(locations)
      .where(
        and(
          categoryFilter ?? sql`true`,
          sql`${locations.isActive} = true`,
          sql`${rank} > 0.25`,
        ),
      )
      .orderBy(desc(rank))
      .limit(limit);
    return { results: [], suggestions };
  } catch {
    return { results: [], suggestions: [] };
  }
}

/** Builds the stored `search_text` column from the other fields. */
export function buildSearchText(input: {
  name: string;
  shortCode?: string | null;
  building?: string | null;
  category: LocationCategory;
  description?: string | null;
}): string {
  return [
    input.name,
    input.shortCode,
    input.building,
    input.category.replace("_", " "),
    input.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
