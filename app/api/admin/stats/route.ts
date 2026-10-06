import { handleRoute } from "@/lib/services/handle-route";
import { adminStats, requireAdminRole } from "@/lib/services/admin";
import { forbidden, jsonOk } from "@/lib/services/response";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";

/** GET /api/admin/stats - overview numbers for the admin dashboard. */
export async function GET(): Promise<Response> {
  return handleRoute(async () => {
    const admin = await requireAdminRole();
    if (!admin) return forbidden();

    const db = await getDb();
    return jsonOk(await adminStats(db));
  });
}
