import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { handleRoute } from "@/lib/services/handle-route";
import { listLocations, toPublicLocation } from "@/lib/services/locations";
import { badRequest, jsonOk, unauthorized } from "@/lib/services/response";
import { locationsQuerySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/** GET /api/locations?category=hostel&q=boy&limit=50 */
export async function GET(req: NextRequest): Promise<Response> {
  return handleRoute(async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const parsed = locationsQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    if (!parsed.success) {
      return badRequest("Invalid query parameters", parsed.error.issues);
    }

    const db = await getDb();
    const { ids, ...rest } = parsed.data;
    const rows = await listLocations(db, {
      ...rest,
      ids: ids
        ? ids
            .split(",")
            .map((value) => Number.parseInt(value, 10))
            .filter((value) => Number.isInteger(value) && value > 0)
            .slice(0, 50)
        : undefined,
    });

    return jsonOk({ locations: rows.map(toPublicLocation) });
  });
}
