import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { handleRoute } from "@/lib/services/handle-route";
import { badRequest, jsonOk, unauthorized } from "@/lib/services/response";
import { getPreferences, updatePreferences } from "@/lib/services/users";
import { preferencesSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/** GET /api/preferences */
export async function GET(): Promise<Response> {
  return handleRoute(async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const db = await getDb();
    const preferences = await getPreferences(db, Number(session.sub));
    return jsonOk({ preferences });
  });
}

/** PATCH /api/preferences - partial update of walking settings and theme. */
export async function PATCH(req: NextRequest): Promise<Response> {
  return handleRoute(async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const parsed = preferencesSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return badRequest("Invalid preference values", parsed.error.issues);
    }

    const db = await getDb();
    const preferences = await updatePreferences(
      db,
      Number(session.sub),
      parsed.data,
    );
    return jsonOk({ preferences });
  });
}
