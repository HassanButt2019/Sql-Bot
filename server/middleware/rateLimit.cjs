const DEFAULT_WINDOW_MS = 60 * 1000;

function createRateLimiter(options = {}) {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const max = options.max ?? 60;
  const keyGenerator = options.keyGenerator ?? keyByIp;
  const skip = options.skip ?? (() => false);
  const store = new Map();

  return (req, res, next) => {
    if (skip(req)) return next();
    const key = keyGenerator(req);
    if (!key) return next();
    const now = Date.now();
    const entry = store.get(key);
    if (!entry || entry.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ success: false, error: 'Rate limit exceeded. Please retry later.' });
    }
    return next();
  };
}

function keyByIp(req) {
  return req.ip ? `ip:${req.ip}` : null;
}

function keyByUserOrg(req) {
  const userId = req.user?.id || 'anon';
  const orgId = req.auth?.tenant?.orgId || 'none';
  const ip = req.ip || 'unknown';
  return `user:${userId}|org:${orgId}|ip:${ip}`;
}

module.exports = {
  createRateLimiter,
  keyByIp,
  keyByUserOrg
};
