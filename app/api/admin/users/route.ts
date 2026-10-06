import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireAdminRole } from "@/lib/services/admin";
import { handleRoute } from "@/lib/services/handle-route";
import { badRequest, forbidden, jsonOk, notFound } from "@/lib/services/response";
import { adminUserUpdateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/** GET /api/admin/users - full roster for the admin user table. */
export async function GET(): Promise<Response> {
  return handleRoute(async () => {
    const admin = await requireAdminRole();
    if (!admin) return forbidden();

    const db = await getDb();
    const rows = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(sql`${users.createdAt} asc`);

    return jsonOk({ users: rows, count: rows.length });
  });
}

/** PATCH /api/admin/users { id, role } */
export async function PATCH(req: NextRequest): Promise<Response> {
  return handleRoute(async () => {
    const admin = await requireAdminRole();
    if (!admin) return forbidden();

    const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const id = Number(raw?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return badRequest("id must be a positive integer");
    }

    const parsed = adminUserUpdateSchema.safeParse({ role: raw?.role });
    if (!parsed.success) {
      return badRequest("role must be student, staff, visitor or admin", parsed.error.issues);
    }

    if (id === admin.id && parsed.data.role !== "admin") {
      return badRequest("You cannot remove your own admin role");
    }

    const db = await getDb();
    const updated = await db
      .update(users)
      .set({ role: parsed.data.role })
      .where(sql`${users.id} = ${id}`)
      .returning({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
      });
    if (!updated[0]) return notFound("User not found");

    return jsonOk({ user: updated[0] });
  });
}
