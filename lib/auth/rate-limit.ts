/**
 * In-memory sliding-window rate limiter.
 *
 * Serverless note: this is per-instance. On Vercel each lambda instance keeps
 * its own counters, so a determined attacker could exceed the limit by hitting
 * different instances. For a diploma project this is the documented,
 * dependency-free trade-off; a production system would move the counter into
 * Redis/Postgres (Upstash) or use an edge WAF.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds until the oldest hit leaves the window. */
  retryAfter: number;
}

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
  now = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    buckets.set(key, bucket);
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return {
    ok: true,
    remaining: limit - bucket.hits.length,
    retryAfter: 0,
  };
}

/** Clears counters after a successful login so users are not punished later. */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** Best-effort client IP for rate-limit keys. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
