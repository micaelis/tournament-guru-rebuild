/**
 * Lightweight in-process rate limiter.
 *
 * Vercel routes are serverless; a single instance handles up to ~1k
 * requests before being recycled. In-process state is per-instance and
 * bounded, so this is a burst / first-line defence, not a distributed
 * quota. The intended threat model is unauthenticated spam of the
 * search-log and contact-form endpoints, and casual scraping of the
 * search endpoint. For distributed brute-force at scale, add Upstash
 * or Vercel KV and wrap this call site.
 *
 * Second-line defence lives in Postgres: see the DB-side burst caps in
 * migration 20260714100007_h5_rate_limits.sql.
 *
 * See AUDIT.md · H5.
 */

type Bucket = { hits: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Cap total keys stored so a distributed IP-hopping flood can't blow
 * memory. Oldest entries are dropped first (LRU-ish via insertion order).
 */
const MAX_KEYS = 5000;

function trim(now: number) {
  if (buckets.size <= MAX_KEYS) return;
  const drop = buckets.size - MAX_KEYS + 100;
  let i = 0;
  for (const key of buckets.keys()) {
    if (i++ >= drop) break;
    buckets.delete(key);
  }
  // Also opportunistically drop expired keys.
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Fire-and-check counter. Returns `{ok: true}` when the caller is
 * within budget, `{ok: false, retryAfterSec}` when it isn't.
 *
 * Windows are hard (fixed): every `windowSec` seconds the counter
 * resets. Simpler than sliding window and good enough for burst
 * defence when the second-line DB cap catches sustained abuse.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
  now: number = Date.now(),
): { ok: true } | { ok: false; retryAfterSec: number } {
  trim(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { hits: 1, resetAt: now + windowSec * 1000 });
    return { ok: true };
  }
  if (existing.hits >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.hits += 1;
  return { ok: true };
}

/**
 * Extract a stable client identifier from Vercel-set request headers.
 * Prefers Vercel's `x-vercel-forwarded-for` (first hop only), falls
 * back to `x-forwarded-for` and finally to a fixed anon bucket. Never
 * returns a raw IP — always a short hash, so logs don't accumulate
 * PII.
 */
export function clientKey(headers: {
  get(name: string): string | null;
}): string {
  const raw =
    headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    "anon";
  // FNV-1a 32-bit hash — collision-resistant enough for bucketing.
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
