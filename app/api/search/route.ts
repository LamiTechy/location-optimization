import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { handleRoute } from "@/lib/services/handle-route";
import { searchLocations, toPublicLocation } from "@/lib/services/locations";
import { badRequest, jsonOk, unauthorized } from "@/lib/services/response";
import { searchQuerySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/** GET /api/search?q=lib&category=library&limit=10 */
export async function GET(req: NextRequest): Promise<Response> {
  return handleRoute(async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const parsed = searchQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    if (!parsed.success) {
      return badRequest("Type at least one character to search", parsed.error.issues);
    }

    const db = await getDb();
    const { results, suggestions } = await searchLocations(db, parsed.data);

    return jsonOk({
      results: results.map(toPublicLocation),
      suggestions: suggestions.map(toPublicLocation),
    });
  });
}
