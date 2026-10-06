import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth/jwt";
import { verifyPassword } from "@/lib/auth/password";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/auth/rate-limit";
import { setSessionCookie } from "@/lib/auth/session";
import { getDb } from "@/db";
import { handleRoute } from "@/lib/services/handle-route";
import { badRequest, jsonError, jsonOk } from "@/lib/services/response";
import {
  findUserByEmail,
  getPreferences,
  recordLogin,
  toPublicUser,
} from "@/lib/services/users";
import { loginSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/**
 * Always-valid bcrypt hash used when the email does not exist, so the
 * response time does not reveal which accounts are registered.
 */
const DUMMY_HASH =
  "$2b$12$VEmgb75.o5tesV2wIHeeXO1FV3i3S4gBNru.Lhz6d//oFXft.TXTu";

const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest): Promise<Response> {
  return handleRoute(async () => {
    const parsed = loginSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return badRequest("Check your email and password", parsed.error.issues);
    }

    const ip = clientIp(req.headers);
    const ipLimit = rateLimit(`login-ip:${ip}`, { limit: 20, windowMs: WINDOW_MS });
    const emailLimit = rateLimit(
      `login-email:${parsed.data.email}`,
      { limit: 5, windowMs: WINDOW_MS },
    );
    if (!ipLimit.ok || !emailLimit.ok) {
      const retryAfter = Math.max(ipLimit.retryAfter, emailLimit.retryAfter);
      return jsonError(
        429,
        "RATE_LIMITED",
        `Too many login attempts. Try again in ${retryAfter}s`,
      );
    }

    const db = await getDb();
    const user = await findUserByEmail(db, parsed.data.email);
    const valid = await verifyPassword(
      parsed.data.password,
      user?.passwordHash ?? DUMMY_HASH,
    );

    if (!user || !valid) {
      return jsonError(401, "INVALID_CREDENTIALS", "Incorrect email or password");
    }

    resetRateLimit(`login-email:${parsed.data.email}`);
    await recordLogin(db, user.id);
    const loggedInAt = new Date();

    const token = await createSessionToken({
      sub: String(user.id),
      email: user.email,
      name: user.fullName,
      role: user.role,
    });
    await setSessionCookie(token);

    const preferences = await getPreferences(db, user.id);

    return jsonOk({
      user: toPublicUser({ ...user, lastLoginAt: loggedInAt }),
      preferences,
    });
  });
}
