/*! Production note: for multi-instance deployments, replace this in-memory rate limiter with Redis to ensure consistent rate limiting across all servers. */
const buckets = new Map();
let cleanupTimer = null;

function cleanupExpiredBuckets() {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function ensureCleanupTimer(windowMs) {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    cleanupExpiredBuckets();
  }, Math.max(windowMs, 60 * 1000));
  cleanupTimer.unref?.();
}

function createIpRateLimiter({ windowMs, max, message }) {
  ensureCleanupTimer(windowMs);

  return (req, res, next) => {
    const key = `${req.ip || req.socket.remoteAddress || "unknown"}:${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.set("Retry-After", String(Math.max(retryAfter, 1)));
      return res.status(429).json({
        message,
      });
    }

    return next();
  };
}

module.exports = { createIpRateLimiter };
