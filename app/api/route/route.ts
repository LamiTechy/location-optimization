import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { handleRoute } from "@/lib/services/handle-route";
import { computeRoute } from "@/lib/services/routing";
import { getPreferences } from "@/lib/services/users";
import { badRequest, jsonError, jsonOk, unauthorized } from "@/lib/services/response";
import { routeRequestSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/**
 * POST /api/route
 *
 * Body: { from: {type:'location',id} | {type:'gps',lat,lng}, to: {...} }
 * Returns the shortest walking path, distance, duration, polyline and
 * turn-by-turn steps - or a typed error with the right HTTP status.
 */
export async function POST(req: NextRequest): Promise<Response> {
  return handleRoute(async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const parsed = routeRequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return badRequest("Check the start and destination", parsed.error.issues);
    }

    const db = await getDb();
    const userId = Number(session.sub);

    // Account preferences fill in anything the client did not send.
    const preferences = await getPreferences(db, userId);
    const request = {
      ...parsed.data,
      avoidStairs: parsed.data.avoidStairs ?? preferences.avoidStairs,
      walkingSpeedMps:
        parsed.data.walkingSpeedMps ?? preferences.walkingSpeedMps,
    };

    const outcome = await computeRoute(db, request, {
      userId,
      recordHistory: request.recordHistory ?? true,
    });

    if (!outcome.ok) {
      return jsonError(outcome.status, outcome.code, outcome.message);
    }

    return jsonOk({
      distanceM: outcome.distanceM,
      durationMin: outcome.durationMin,
      durationSec: outcome.durationSec,
      path: outcome.path,
      steps: outcome.steps,
      from: outcome.from,
      to: outcome.to,
      warnings: outcome.warnings,
    });
  });
}
