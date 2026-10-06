/**
 * CSRF protection for cookie-authenticated mutating requests.
 *
 * Chosen approach (documented in docs/CHAPTER4_NOTES.md):
 *
 * 1. `SameSite=Lax` on the session cookie blocks cross-site POSTs from ever
 *    carrying credentials - this is the primary defence.
 * 2. **Origin/Referer check**: middleware rejects a mutating `/api` request
 *    whose `Origin` header is present and points at another site.
 * 3. **Double-submit token**: a JS-readable `mapoly_csrf` cookie must match the
 *    `x-csrf-token` request header. The cookie is issued by middleware on the
 *    first request, so it always exists for same-origin clients.
 *
 * Requests without an Origin header (curl, server-to-server) skip step 2 but
 * must still satisfy step 3 when a CSRF cookie is present.
 */

export const CSRF_COOKIE = "mapoly_csrf";
export const CSRF_HEADER = "x-csrf-token";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isMutatingMethod(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase());
}

export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface CsrfCheckInput {
  method: string;
  origin: string | null;
  referer: string | null;
  headerToken: string | null;
  cookieToken: string | null;
  /** Origins the request is allowed to come from. */
  allowedOrigins: string[];
}

export type CsrfResult =
  | { ok: true }
  | { ok: false; code: "BAD_ORIGIN" | "BAD_TOKEN"; message: string };

export function checkCsrf(input: CsrfCheckInput): CsrfResult {
  if (!isMutatingMethod(input.method)) return { ok: true };

  const source = input.origin ?? input.referer;
  if (source) {
    let sourceOrigin: string;
    try {
      sourceOrigin = new URL(source).origin;
    } catch {
      return { ok: false, code: "BAD_ORIGIN", message: "Invalid Origin header" };
    }
    if (!input.allowedOrigins.includes(sourceOrigin)) {
      return {
        ok: false,
        code: "BAD_ORIGIN",
        message: "Cross-site request blocked",
      };
    }
  }

  // No CSRF cookie yet (very first request): the origin check above already
  // covers browsers, and a non-browser client cannot be a CSRF victim.
  if (input.cookieToken) {
    if (!input.headerToken || input.headerToken !== input.cookieToken) {
      return {
        ok: false,
        code: "BAD_TOKEN",
        message: "Missing or invalid CSRF token",
      };
    }
  }

  return { ok: true };
}
