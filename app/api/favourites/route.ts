import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { favourites } from "@/db/schema";
import { handleRoute } from "@/lib/services/handle-route";
import { badRequest, jsonOk, unauthorized } from "@/lib/services/response";

export const dynamic = "force-dynamic";

/** GET /api/favourites - ids the signed-in user saved. */
export async function GET(): Promise<Response> {
  return handleRoute(async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const db = await getDb();
    const rows = await db
      .select({ locationId: favourites.locationId })
      .from(favourites)
      .where(eq(favourites.userId, Number(session.sub)));

    return jsonOk({ favouriteLocationIds: rows.map((row) => row.locationId) });
  });
}

function readLocationId(body: unknown): number | null {
  if (typeof body !== "object" || body === null) return null;
  const raw = (body as { locationId?: unknown }).locationId;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

/** POST /api/favourites { locationId } - save a place. */
export async function POST(req: NextRequest): Promise<Response> {
  return handleRoute(async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const locationId = readLocationId(await req.json().catch(() => null));
    if (!locationId) return badRequest("locationId must be a positive integer");

    const db = await getDb();
    await db
      .insert(favourites)
      .values({ userId: Number(session.sub), locationId })
      .onConflictDoNothing();

    return jsonOk({ saved: true, locationId });
  });
}

/** DELETE /api/favourites { locationId } - remove a saved place. */
export async function DELETE(req: NextRequest): Promise<Response> {
  return handleRoute(async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await req.json().catch(() => null);
    const raw =
      readLocationId(body) ??
      ((): number | null => {
        const value = Number(req.nextUrl.searchParams.get("locationId"));
        return Number.isInteger(value) && value > 0 ? value : null;
      })();
    if (!raw) return badRequest("locationId must be a positive integer");

    const db = await getDb();
    await db
      .delete(favourites)
      .where(
        and(
          eq(favourites.userId, Number(session.sub)),
          eq(favourites.locationId, raw),
        ),
      );

    return jsonOk({ saved: false, locationId: raw });
  });
}
