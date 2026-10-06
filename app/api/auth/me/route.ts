import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { favourites } from "@/db/schema";
import { handleRoute } from "@/lib/services/handle-route";
import { jsonOk, unauthorized } from "@/lib/services/response";
import { findUserById, getPreferences, toPublicUser } from "@/lib/services/users";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return handleRoute(async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const db = await getDb();
    const user = await findUserById(db, Number(session.sub));
    if (!user) return unauthorized();

    const [preferences, favouriteRows] = await Promise.all([
      getPreferences(db, user.id),
      db
        .select({ locationId: favourites.locationId })
        .from(favourites)
        .where(eq(favourites.userId, user.id)),
    ]);

    return jsonOk({
      user: toPublicUser(user),
      preferences,
      favouriteLocationIds: favouriteRows.map((f) => f.locationId),
    });
  });
}
