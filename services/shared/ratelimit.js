// Simple in-memory rate limiter
// In production you'd use Redis, but this works for single-instance deploys

const windows = new Map();

function createRateLimiter({ windowMs = 60000, max = 100, message = 'Too many requests' } = {}) {
  return (req, res, next) => {
    const ip = req.headers['x-real-ip'] || req.ip || 'unknown';
    const key = `${ip}:${req.path}`;
    const now = Date.now();

    if (!windows.has(key)) {
      windows.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    const window = windows.get(key);

    if (now > window.resetAt) {
      windows.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    window.count++;

    if (window.count > max) {
      res.setHeader('Retry-After', Math.ceil((window.resetAt - now) / 1000));
      return res.status(429).json({ error: message });
    }

    next();
  };
}

// Clean up expired windows every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of windows.entries()) {
    if (now > val.resetAt) windows.delete(key);
  }
}, 5 * 60 * 1000);

module.exports = { createRateLimiter };
