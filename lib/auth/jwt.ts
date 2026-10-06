import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/db/schema";
import { env } from "@/lib/env";

/** Session cookie name (also read by middleware.ts, so keep it dependency-free). */
export const SESSION_COOKIE = "mapoly_session";

/** Session lifetime: 7 days (report: short-lived JWT in an httpOnly cookie). */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export interface SessionPayload {
  /** User id as a string (standard JWT `sub` claim). */
  sub: string;
  email: string;
  name: string;
  role: Role;
  iat?: number;
  exp?: number;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env().JWT_SECRET);
}

export async function createSessionToken(
  payload: Omit<SessionPayload, "iat" | "exp">,
): Promise<string> {
  return new SignJWT({ email: payload.email, name: payload.name, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

/**
 * Verifies signature and expiry. Returns null instead of throwing so callers
 * can treat any bad token as "not logged in".
 */
export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    if (!payload.sub || typeof payload.role !== "string") return null;
    return {
      sub: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: payload.role as Role,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}
