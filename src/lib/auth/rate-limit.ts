export type RateLimiter = {
  /** Records an attempt; returns false when the key is over its limit. */
  hit(key: string, now?: number): boolean;
};

/**
 * Fixed-window, in-memory limiter. On serverless each instance keeps its own
 * counts, so the effective limit is per instance; good enough for a
 * single-user password gate with a long random password.
 */
export function createRateLimiter(opts: {
  limit: number;
  windowMs: number;
}): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();

  return {
    hit(key, now = Date.now()) {
      const current = windows.get(key);
      if (!current || now - current.start >= opts.windowMs) {
        windows.set(key, { start: now, count: 1 });
        if (windows.size > 10_000) {
          for (const [k, w] of windows) {
            if (now - w.start >= opts.windowMs) windows.delete(k);
          }
        }
        return true;
      }
      current.count += 1;
      return current.count <= opts.limit;
    },
  };
}
