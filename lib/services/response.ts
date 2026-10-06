/** Consistent success envelope: everything is wrapped in `ok: true`. */
export function jsonOk<T extends object>(
  data: T,
  init?: ResponseInit,
): Response {
  return Response.json({ ok: true, ...data }, init);
}

/** Consistent failure envelope: `{ ok: false, error: { code, message } }`. */
export function jsonError(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): Response {
  return Response.json(
    { ok: false, error: { code, message, ...(extra ?? {}) } },
    { status },
  );
}

/** 401 helper used by every protected route handler. */
export function unauthorized(): Response {
  return jsonError(401, "UNAUTHENTICATED", "Log in to continue");
}

/** 403 helper for role failures (re-checked inside handlers on purpose). */
export function forbidden(
  message = "You do not have access to this area",
): Response {
  return jsonError(403, "FORBIDDEN", message);
}

export function notFound(message = "Not found"): Response {
  return jsonError(404, "NOT_FOUND", message);
}

/** 400 helper that forwards validation issues to the client for inline display. */
export function badRequest(
  message: string,
  issues?: { path: readonly PropertyKey[]; message: string }[],
): Response {
  return jsonError(400, "VALIDATION_ERROR", message, issues ? { issues } : {});
}
