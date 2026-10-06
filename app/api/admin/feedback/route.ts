import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { feedback, users } from "@/db/schema";
import { requireAdminRole } from "@/lib/services/admin";
import { handleRoute } from "@/lib/services/handle-route";
import { forbidden, jsonOk } from "@/lib/services/response";

export const dynamic = "force-dynamic";

/** GET /api/admin/feedback - every submission with the author's name. */
export async function GET(): Promise<Response> {
  return handleRoute(async () => {
    const admin = await requireAdminRole();
    if (!admin) return forbidden();

    const db = await getDb();
    const rows = await db
      .select({
        id: feedback.id,
        rating: feedback.rating,
        message: feedback.message,
        createdAt: feedback.createdAt,
        author: users.fullName,
        email: users.email,
      })
      .from(feedback)
      .leftJoin(users, sql`${users.id} = ${feedback.userId}`)
      .orderBy(sql`${feedback.createdAt} desc`)
      .limit(200);

    const ratings = rows.map((row) => row.rating);
    return jsonOk({
      feedback: rows,
      count: rows.length,
      averageRating:
        ratings.length > 0
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
          : null,
    });
  });
}
