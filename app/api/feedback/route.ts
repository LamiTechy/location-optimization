import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { feedback } from "@/db/schema";
import { handleRoute } from "@/lib/services/handle-route";
import { badRequest, jsonOk, unauthorized } from "@/lib/services/response";
import { feedbackSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/** POST /api/feedback { rating, message? } */
export async function POST(req: NextRequest): Promise<Response> {
  return handleRoute(async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const parsed = feedbackSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return badRequest("Check the rating and message", parsed.error.issues);
    }

    const db = await getDb();
    const rows = await db
      .insert(feedback)
      .values({
        userId: Number(session.sub),
        rating: parsed.data.rating,
        message: parsed.data.message ?? null,
        routeHistoryId: parsed.data.routeHistoryId ?? null,
      })
      .returning({ id: feedback.id });

    return jsonOk({ id: rows[0]?.id, saved: true }, { status: 201 });
  });
}

/** GET /api/feedback - the signed-in user's previous submissions. */
export async function GET(): Promise<Response> {
  return handleRoute(async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const db = await getDb();
    const rows = await db
      .select({
        id: feedback.id,
        rating: feedback.rating,
        message: feedback.message,
        createdAt: feedback.createdAt,
      })
      .from(feedback)
      .where(eq(feedback.userId, Number(session.sub)))
      .orderBy(desc(feedback.createdAt))
      .limit(20);

    return jsonOk({ feedback: rows });
  });
}
