import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const roleEnum = pgEnum("user_role", [
  "student",
  "staff",
  "visitor",
  "admin",
]);

export const locationCategoryEnum = pgEnum("location_category", [
  "department",
  "hostel",
  "office",
  "lecture_hall",
  "laboratory",
  "library",
  "gate",
  "landmark",
  "cafeteria",
  "sports",
  "worship",
  "health",
  "other",
]);

export const pathTypeEnum = pgEnum("path_type", [
  "road",
  "footpath",
  "stairs",
  "shortcut",
]);

export const themeEnum = pgEnum("user_theme", ["light", "dark", "system"]);

/* ------------------------------------------------------------------ */
/* Users (report entity 3.10: User_ID, Full_Name, Email, Password)      */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    fullName: varchar("full_name", { length: 120 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull().default("student"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email)],
);

/* ------------------------------------------------------------------ */
/* Locations (report entity 3.10: Location_ID, Name, Category, ...)     */
/* ------------------------------------------------------------------ */

export const locations = pgTable(
  "locations",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    category: locationCategoryEnum("category").notNull(),
    description: text("description"),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    shortCode: varchar("short_code", { length: 16 }),
    building: varchar("building", { length: 120 }),
    floorInfo: varchar("floor_info", { length: 60 }),
    openingHours: varchar("opening_hours", { length: 120 }),
    isEntrance: boolean("is_entrance").notNull().default(false),
    photoUrl: text("photo_url"),
    isActive: boolean("is_active").notNull().default(true),
    searchText: text("search_text").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("locations_category_idx").on(t.category),
    index("locations_name_idx").on(t.name),
    index("locations_search_text_idx").on(t.searchText),
  ],
);

/* ------------------------------------------------------------------ */
/* Routing graph (backend layer - required for Dijkstra)               */
/* ------------------------------------------------------------------ */

export const nodes = pgTable(
  "nodes",
  {
    id: serial("id").primaryKey(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    // Junction nodes belong to no location; entrance nodes do.
    locationId: integer("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    label: varchar("label", { length: 120 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("nodes_location_idx").on(t.locationId)],
);

export const edges = pgTable(
  "edges",
  {
    id: serial("id").primaryKey(),
    fromNode: integer("from_node")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    toNode: integer("to_node")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    distanceM: doublePrecision("distance_m"),
    pathType: pathTypeEnum("path_type").notNull().default("road"),
    isBidirectional: boolean("is_bidirectional").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    // Optional curved geometry: [[lat, lng], ...] excluding endpoints.
    geometry: jsonb("geometry").$type<Array<[number, number]>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("edges_from_idx").on(t.fromNode),
    index("edges_to_idx").on(t.toNode),
    check(
      "edges_distance_positive",
      sql`${t.distanceM} is null or ${t.distanceM} > 0`,
    ),
  ],
);

/** Single row; `version` is bumped whenever the graph changes. */
export const graphMeta = pgTable("graph_meta", {
  id: serial("id").primaryKey(),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/* ------------------------------------------------------------------ */
/* User database (profiles, preferences, history, feedback)            */
/* ------------------------------------------------------------------ */

export const routeHistory = pgTable(
  "route_history",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fromLocationId: integer("from_location_id").references(
      () => locations.id,
      { onDelete: "set null" },
    ),
    fromLat: doublePrecision("from_lat"),
    fromLng: doublePrecision("from_lng"),
    toLocationId: integer("to_location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    distanceM: doublePrecision("distance_m").notNull(),
    durationMin: integer("duration_min").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("route_history_user_idx").on(t.userId, t.createdAt)],
);

export const favourites = pgTable(
  "favourites",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    locationId: integer("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.locationId] })],
);

export const preferences = pgTable("preferences", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  avoidStairs: boolean("avoid_stairs").notNull().default(false),
  walkingSpeedMps: doublePrecision("walking_speed_mps")
    .notNull()
    .default(1.4),
  defaultStartLocationId: integer("default_start_location_id").references(
    () => locations.id,
    { onDelete: "set null" },
  ),
  theme: themeEnum("theme").notNull().default("system"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const feedback = pgTable(
  "feedback",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(),
    message: text("message"),
    routeHistoryId: integer("route_history_id").references(
      () => routeHistory.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("feedback_user_idx").on(t.userId),
    check("feedback_rating_range", sql`${t.rating} between 1 and 5`),
  ],
);

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type Role = (typeof roleEnum.enumValues)[number];
export type LocationCategory = (typeof locationCategoryEnum.enumValues)[number];
export type PathType = (typeof pathTypeEnum.enumValues)[number];
export type Theme = (typeof themeEnum.enumValues)[number];

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
export type GraphNode = typeof nodes.$inferSelect;
export type GraphEdge = typeof edges.$inferSelect;
export type RouteHistory = typeof routeHistory.$inferSelect;
export type Preference = typeof preferences.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
