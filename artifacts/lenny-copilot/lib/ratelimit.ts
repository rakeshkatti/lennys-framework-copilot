/**
 * In-memory daily rate limiter — two layers:
 *
 *  1. Per-IP cap (default 5/day): stops a single visitor from spamming
 *     framework runs.
 *  2. Global cap (default 50/day): hard ceiling on total LLM calls across
 *     all users in a UTC day. Backstop if the per-IP layer is fooled
 *     (NAT, VPN cycling, bug). Bounds worst-case Anthropic spend.
 *
 * Both counters reset at midnight UTC.
 *
 * Storage: module-scope `Map` + a single counter. Works on a single
 * Replit/Vercel instance. If the host autoscales to multiple instances,
 * each instance gets its own counters — limits are effectively per-instance.
 * Acceptable for an archived contest project with low traffic; swap in
 * Upstash if real abuse appears.
 *
 * Override defaults via env: RATE_LIMIT_PER_IP, RATE_LIMIT_GLOBAL.
 */

const PER_IP_DEFAULT = 5;
const GLOBAL_DEFAULT = 50;

type Entry = { count: number; dayKey: string };

/** Allow tests to override the clock. Production uses real time. Declared
 *  BEFORE any other module state because the global counter's initializer
 *  calls dayKeyNow() which reads `clock` — temporal dead zone otherwise. */
let clock: () => Date = () => new Date();

function dayKeyNow(): string {
  return clock().toISOString().slice(0, 10); // "YYYY-MM-DD" in UTC
}

const perIp = new Map<string, Entry>();
let globalEntry: Entry = { count: 0, dayKey: dayKeyNow() };

/** Compute the ISO timestamp for midnight UTC of the day AFTER `dayKey`. */
function midnightUtcAfter(dayKey: string): string {
  const d = new Date(dayKey + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

function perIpLimit(): number {
  const v = parseInt(process.env.RATE_LIMIT_PER_IP ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : PER_IP_DEFAULT;
}

function globalLimit(): number {
  const v = parseInt(process.env.RATE_LIMIT_GLOBAL ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : GLOBAL_DEFAULT;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: string; // ISO timestamp
  reason?: "per_ip" | "global";
}

/**
 * Check and (if allowed) consume one quota slot for `ip`. Increments both
 * the per-IP counter and the global counter atomically. Returns
 * `{ allowed: false, reason }` without incrementing if either cap is hit.
 */
export function consume(ip: string): RateLimitResult {
  const today = dayKeyNow();
  const ipMax = perIpLimit();
  const globalMax = globalLimit();
  const resetAt = midnightUtcAfter(today);

  // Reset global counter on day rollover.
  if (globalEntry.dayKey !== today) {
    globalEntry = { count: 0, dayKey: today };
  }

  // Reset per-IP counter on day rollover.
  let ipEntry = perIp.get(ip);
  if (!ipEntry || ipEntry.dayKey !== today) {
    ipEntry = { count: 0, dayKey: today };
    perIp.set(ip, ipEntry);
  }

  // Global cap checked first — protects total spend even if a single IP
  // is somehow exempt.
  if (globalEntry.count >= globalMax) {
    return { allowed: false, remaining: 0, resetAt, reason: "global" };
  }
  if (ipEntry.count >= ipMax) {
    return { allowed: false, remaining: 0, resetAt, reason: "per_ip" };
  }

  ipEntry.count++;
  globalEntry.count++;
  return { allowed: true, remaining: ipMax - ipEntry.count, resetAt };
}

/**
 * Extract the client IP from a fetch-style Request. Trusts the leftmost
 * value of `x-forwarded-for` (Replit / Vercel / Cloudflare set it),
 * falls back to `x-real-ip`, then to "unknown". The "unknown" bucket
 * is rate-limited too so a misconfigured proxy can't accidentally
 * become an open spend faucet.
 */
export function extractIp(req: Request): string {
  return extractIpFromHeaders(req.headers);
}

/**
 * Same as `extractIp` but for server components that use the Next.js
 * `headers()` helper instead of receiving a Request.
 */
export function extractIpFromHeaders(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}

// ---------------------------------------------------------------------------
// Test-only helpers. Not exported via the package barrel; consumed directly
// by lib/ratelimit.test.ts which knows the implementation.
// ---------------------------------------------------------------------------

/** Reset all counters. Use in vitest `beforeEach`. */
export function _resetForTests(): void {
  perIp.clear();
  globalEntry = { count: 0, dayKey: dayKeyNow() };
}

/** Override the clock for deterministic day-rollover tests. */
export function _setClockForTests(fn: () => Date): void {
  clock = fn;
}
