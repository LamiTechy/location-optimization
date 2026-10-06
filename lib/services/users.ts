import { asc, eq, sql } from "drizzle-orm";
import {
  preferences,
  users,
  type NewUser,
  type Preference,
  type Role,
  type User,
} from "@/db/schema";
import type { Db } from "@/db";

export async function findUserByEmail(
  db: Db,
  email: string,
): Promise<User | null> {
  const rows = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);
  return rows[0] ?? null;
}

export async function findUserById(db: Db, id: number): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * Creates a user. Returns null when the email already exists (the unique
 * index is the source of truth, so concurrent registrations cannot race).
 */
export async function createUser(db: Db, input: NewUser): Promise<User | null> {
  const rows = await db
    .insert(users)
    .values({ ...input, email: input.email.toLowerCase() })
    .onConflictDoNothing({ target: users.email })
    .returning();
  return rows[0] ?? null;
}

export async function recordLogin(db: Db, userId: number): Promise<void> {
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, userId));
}

export async function listUsers(db: Db): Promise<User[]> {
  return db.select().from(users).orderBy(asc(users.createdAt));
}

export async function countUsers(db: Db): Promise<number> {
  const rows = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(users);
  return rows[0]?.value ?? 0;
}

export async function updateUserRole(
  db: Db,
  userId: number,
  role: Role,
): Promise<User | null> {
  const rows = await db
    .update(users)
    .set({ role })
    .where(eq(users.id, userId))
    .returning();
  return rows[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Preferences                                                         */
/* ------------------------------------------------------------------ */

export async function getPreferences(db: Db, userId: number): Promise<Preference> {
  const rows = await db
    .select()
    .from(preferences)
    .where(eq(preferences.userId, userId))
    .limit(1);
  if (rows[0]) return rows[0];

  const created = await db
    .insert(preferences)
    .values({ userId })
    .onConflictDoNothing({ target: preferences.userId })
    .returning();
  if (created[0]) return created[0];

  const again = await db
    .select()
    .from(preferences)
    .where(eq(preferences.userId, userId))
    .limit(1);
  if (!again[0]) throw new Error("Preferences row could not be created");
  return again[0];
}

export async function updatePreferences(
  db: Db,
  userId: number,
  patch: Partial<{
    avoidStairs: boolean;
    walkingSpeedMps: number;
    defaultStartLocationId: number | null;
    theme: Preference["theme"];
  }>,
): Promise<Preference> {
  await getPreferences(db, userId);
  const rows = await db
    .update(preferences)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(preferences.userId, userId))
    .returning();
  return rows[0];
}

/** Strips sensitive fields before a user object crosses the API boundary. */
export function toPublicUser(user: User) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}
