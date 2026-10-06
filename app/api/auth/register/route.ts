import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth/jwt";
import { hashPassword } from "@/lib/auth/password";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { setSessionCookie } from "@/lib/auth/session";
import { getDb } from "@/db";
import { handleRoute } from "@/lib/services/handle-route";
import { badRequest, jsonError, jsonOk } from "@/lib/services/response";
import {
  createUser,
  getPreferences,
  toPublicUser,
} from "@/lib/services/users";
import { registerSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  return handleRoute(async () => {
    const parsed = registerSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return badRequest("Check the highlighted fields", parsed.error.issues);
    }

    const limit = rateLimit(
      `register:${clientIp(req.headers)}`,
      { limit: 10, windowMs: 60 * 60 * 1000 },
    );
    if (!limit.ok) {
      return jsonError(
        429,
        "RATE_LIMITED",
        `Too many attempts. Try again in ${limit.retryAfter}s`,
      );
    }

    const db = await getDb();
    const email = parsed.data.email;
    const user = await createUser(db, {
      fullName: parsed.data.fullName,
      email,
      passwordHash: await hashPassword(parsed.data.password),
      role: parsed.data.role,
    });

    if (!user) {
      return jsonError(
        409,
        "EMAIL_TAKEN",
        "An account with this email already exists",
      );
    }

    await getPreferences(db, user.id);

    const token = await createSessionToken({
      sub: String(user.id),
      email: user.email,
      name: user.fullName,
      role: user.role,
    });
    await setSessionCookie(token);

    return jsonOk({ user: toPublicUser(user) }, { status: 201 });
  });
}
