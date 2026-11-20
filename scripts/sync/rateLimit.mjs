/**
 * Bounded limiter for failed authentication attempts.
 *
 * Why this exists: the sync server listens on loopback and is normally reached through
 * Tailscale Serve, so every request appears to come from the proxy. Without a limiter,
 * a local process that can reach the port could hammer the endpoint indefinitely.
 *
 * Only FAILURES are counted. A successful request never consumes budget, so a healthy
 * client that reconnects after a laptop sleeps is never locked out.
 *
 * The state is deliberately small and self-cleaning: at most `maxKeys` buckets are
 * tracked, and expired buckets are pruned on write. Nothing here grows without bound.
 */

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_FAILURES = 20;
const DEFAULT_MAX_KEYS = 1024;

export function createAuthFailureLimiter({
  windowMs = DEFAULT_WINDOW_MS,
  maxFailures = DEFAULT_MAX_FAILURES,
  maxKeys = DEFAULT_MAX_KEYS,
  now = () => Date.now(),
} = {}) {
  /** key -> { count, resetAt } */
  const buckets = new Map();

  function prune(currentTime) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= currentTime) buckets.delete(key);
    }
    // Still too many live buckets: drop the oldest so memory stays bounded.
    while (buckets.size > maxKeys) {
      const oldest = buckets.keys().next();
      if (oldest.done) break;
      buckets.delete(oldest.value);
    }
  }

  return {
    /** True when `key` has exhausted its failure budget for the current window. */
    isLimited(key) {
      const currentTime = now();
      const bucket = buckets.get(key);
      if (!bucket) return false;
      if (bucket.resetAt <= currentTime) {
        buckets.delete(key);
        return false;
      }
      return bucket.count >= maxFailures;
    },

    /** Record one failed attempt. */
    recordFailure(key) {
      const currentTime = now();
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= currentTime) {
        buckets.set(key, { count: 1, resetAt: currentTime + windowMs });
      } else {
        bucket.count += 1;
      }
      prune(currentTime);
    },

    /** Clear a key's budget (a successful authentication proves it is legitimate). */
    recordSuccess(key) {
      buckets.delete(key);
    },

    /** Test/diagnostic helper. */
    size() {
      return buckets.size;
    },
  };
}

/**
 * Identify the caller for rate-limiting purposes.
 *
 * The socket address is used, not a forwarded header: behind Serve every request
 * arrives from the proxy, and trusting `x-forwarded-for` would let a caller rotate its
 * own bucket. Bucketing by the actual peer keeps the limit honest.
 */
export function rateLimitKey(req) {
  const address = req?.socket?.remoteAddress;
  return typeof address === 'string' && address.length > 0 ? address : 'unknown';
}
