import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { resetDb } = vi.hoisted(() => ({ resetDb: vi.fn() }));

vi.mock("@/db", () => ({
  DB_RECOVERY_HINT: "Local database (.pglite-data) could not serve queries.",
  resetDb,
}));

import { handleRoute } from "@/lib/services/handle-route";

const RECOVERY_MESSAGE =
  "Local database (.pglite-data) could not serve queries. It is usually damaged.";

/** Shape drizzle throws: a wrapper message with the real error on `cause`. */
function wrappedFailure(): Error {
  const runtime = new Error(
    "Aborted(). Build with -sASSERTIONS for more info.",
  );
  runtime.name = "RuntimeError";
  return Object.assign(new Error("Failed query: select ... from users"), {
    cause: runtime,
  });
}

describe("handleRoute", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetDb.mockClear();
    // handleRoute logs every failure; keep the test output readable.
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => consoleError.mockRestore());

  it("drops the dead client when the abort sits on error.cause", async () => {
    const res = await handleRoute(() => Promise.reject(wrappedFailure()));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "DB_UNAVAILABLE" },
    });
    expect(resetDb).toHaveBeenCalledOnce();
  });

  it("recovers when the open probe itself reports the damaged directory", async () => {
    const res = await handleRoute(() =>
      Promise.reject(new Error(`${RECOVERY_MESSAGE} (WAL corrupt)`)),
    );

    expect(res.status).toBe(503);
    expect(resetDb).toHaveBeenCalledOnce();
  });

  it("leaves unrelated failures on the generic envelope", async () => {
    const res = await handleRoute(() => Promise.reject(new Error("boom")));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      },
    });
    expect(JSON.stringify(body)).not.toContain("boom");
    expect(resetDb).not.toHaveBeenCalled();
  });
});
