"use client";

/**
 * Small client-side API helper: sends JSON, echoes the double-submit CSRF
 * token and normalises every response into either data or an ApiError with
 * the server's `{ code, message }` payload.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues?: { path: (string | number)[]; message: string }[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const hasBody = init?.json !== undefined;
  const method = (init?.method ?? "GET").toUpperCase();
  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (hasBody) headers.set("Content-Type", "application/json");
  const csrf = readCookie("mapoly_csrf");
  // Middleware requires the double-submit token on *every* mutation, with or
  // without a body (logout and "clear history" send no body at all).
  if (csrf && (mutating || hasBody)) headers.set("x-csrf-token", csrf);

  const res = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
    body: hasBody ? JSON.stringify(init?.json) : init?.body,
  });

  const payload = (await res.json().catch(() => null)) as
    | (T & { ok?: boolean; error?: { code?: string; message?: string; issues?: { path: (string | number)[]; message: string }[] } })
    | null;

  if (!res.ok || payload?.ok === false) {
    throw new ApiError(
      res.status,
      payload?.error?.code ?? "UNKNOWN",
      payload?.error?.message ?? "Something went wrong. Please try again.",
      payload?.error?.issues,
    );
  }

  return payload as T;
}
