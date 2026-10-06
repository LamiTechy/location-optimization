import { NextRequest, NextResponse } from "next/server";
import { CSRF_COOKIE, CSRF_HEADER, checkCsrf, randomToken } from "@/lib/auth/csrf";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/jwt";

/**
 * Application-layer guard (report Figure 3.2: User Authentication).
 *
 * - issues the double-submit CSRF cookie when it is missing
 * - rejects cross-site mutations (Origin/Referer check)
 * - verifies the JWT for the (app) and admin areas
 * - redirects unauthenticated visitors to /login (or 401s API calls)
 *
 * Role checks are repeated inside admin route handlers: middleware alone is
 * never trusted (see the Security section of README.md).
 */

const PUBLIC_PAGES = new Set(["/", "/login", "/register"]);
const PUBLIC_API = new Set(["/api/auth/login", "/api/auth/register"]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_API.has(pathname)) return true;
  if (pathname.startsWith("/api/")) return false;
  return PUBLIC_PAGES.has(pathname);
}

function allowedOrigins(req: NextRequest): string[] {
  const origins = new Set<string>();
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      origins.add(new URL(configured).origin);
    } catch {
      /* validated in lib/env.ts; ignored here */
    }
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    origins.add(`${proto}://${host}`);
    origins.add(`https://${host}`);
    origins.add(`http://${host}`);
  }
  return [...origins];
}

function withCsrfCookie(res: NextResponse, existing: string | null): NextResponse {
  if (existing) return res;
  res.cookies.set(CSRF_COOKIE, randomToken(), {
    httpOnly: false, // JavaScript must read it to echo in the header
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const existingCsrf = req.cookies.get(CSRF_COOKIE)?.value ?? null;

  let response: NextResponse;

  /* 1. CSRF verification for mutating API requests. */
  if (pathname.startsWith("/api/")) {
    const csrf = checkCsrf({
      method: req.method,
      origin: req.headers.get("origin"),
      referer: req.headers.get("referer"),
      headerToken: req.headers.get(CSRF_HEADER),
      cookieToken: existingCsrf,
      allowedOrigins: allowedOrigins(req),
    });
    if (!csrf.ok) {
      response = NextResponse.json(
        { ok: false, error: { code: csrf.code, message: csrf.message } },
        { status: 403 },
      );
      return withCsrfCookie(response, existingCsrf);
    }
  }

  /* 2. Session for protected paths. */
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const isApi = pathname.startsWith("/api/");

  if (!isPublicPath(pathname)) {
    if (!session) {
      response = isApi
        ? NextResponse.json(
            {
              ok: false,
              error: { code: "UNAUTHENTICATED", message: "Log in to continue" },
            },
            { status: 401 },
          )
        : NextResponse.redirect(
            new URL(
              `/login?next=${encodeURIComponent(pathname + req.nextUrl.search)}`,
              req.url,
            ),
          );
    } else if (pathname.startsWith("/admin") && session.role !== "admin") {
      response = NextResponse.redirect(new URL("/dashboard", req.url));
    } else {
      response = NextResponse.next();
    }
  } else if (session && (pathname === "/login" || pathname === "/register")) {
    // Already signed in - go straight to the app.
    response = NextResponse.redirect(new URL("/dashboard", req.url));
  } else {
    response = NextResponse.next();
  }

  return withCsrfCookie(response, existingCsrf);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};
