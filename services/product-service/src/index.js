require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const migrate = require('./migrate');
const pool = require('./db');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const searchRoutes = require('./routes/search');

const app = express();
app.use(express.json({ limit: '10kb' }));

// CORS for Render (no NGINX)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});



const SERVICE = 'product_service';
const log = (level, event, data = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, service: SERVICE, event, ...data }));

const required = ['DATABASE_URL', 'JWT_SECRET'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) { log('error', 'missing_env', { missing }); process.exit(1); }

app.use((req, res, next) => { res.removeHeader('X-Powered-By'); res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });

const rateLimitWindows = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const ip = req.headers['x-real-ip'] || req.ip || 'unknown';
    const now = Date.now();
    const entry = rateLimitWindows.get(ip) || { count: 0, resetAt: now + windowMs };
    if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + windowMs; }
    entry.count++;
    rateLimitWindows.set(ip, entry);
    if (entry.count > max) return res.status(429).json({ error: 'Too many requests' });
    next();
  };
}

const metrics = { requests: {}, errors: {}, durations: [] };
app.use((req, res, next) => {
  req.traceId = req.headers['x-trace-id'] || crypto.randomUUID();
  res.setHeader('X-Trace-Id', req.traceId);
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const k = `${req.method}_${res.statusCode}`;
    metrics.requests[k] = (metrics.requests[k] || 0) + 1;
    metrics.durations.push(ms);
    if (metrics.durations.length > 1000) metrics.durations.shift();
    if (res.statusCode >= 400) metrics.errors[k] = (metrics.errors[k] || 0) + 1;
    log('info', 'http_request', { traceId: req.traceId, method: req.method, path: req.path, status: res.statusCode, duration_ms: ms });
  });
  next();
});

app.get('/health', (req, res) => res.json({ service: SERVICE, status: 'ok', uptime: process.uptime() }));
app.get('/metrics', (req, res) => {
  const s = [...metrics.durations].sort((a, b) => a - b);
  const p50 = s[Math.floor(s.length * 0.5)] || 0;
  const p95 = s[Math.floor(s.length * 0.95)] || 0;
  const p99 = s[Math.floor(s.length * 0.99)] || 0;
  const total = Object.values(metrics.requests).reduce((a, b) => a + b, 0);
  const errors = Object.values(metrics.errors).reduce((a, b) => a + b, 0);
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(
    `# HELP ${SERVICE}_http_requests_total Total requests\n# TYPE ${SERVICE}_http_requests_total counter\n${SERVICE}_http_requests_total ${total}\n\n` +
    `# HELP ${SERVICE}_http_errors_total Total errors\n# TYPE ${SERVICE}_http_errors_total counter\n${SERVICE}_http_errors_total ${errors}\n\n` +
    `# HELP ${SERVICE}_http_duration_ms Request duration\n# TYPE ${SERVICE}_http_duration_ms summary\n${SERVICE}_http_duration_ms{quantile="0.5"} ${p50}\n${SERVICE}_http_duration_ms{quantile="0.95"} ${p95}\n${SERVICE}_http_duration_ms{quantile="0.99"} ${p99}\n`
  );
});

app.use('/api/search', rateLimit(30, 60000));
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/search', searchRoutes);
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, next) => { log('error', 'unhandled_error', { error: err.message }); res.status(500).json({ error: err.message || 'Internal server error' }); });

const PORT = process.env.PORT || 3002;
migrate().then(() => {
  const server = app.listen(PORT, '0.0.0.0', () => log('info', 'service_started', { port: PORT }));
  const shutdown = async (signal) => { log('info', `shutdown_${signal}`); server.close(async () => { await pool.end().catch(() => {}); process.exit(0); }); setTimeout(() => process.exit(1), 10000); };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}).catch(err => { log('error', 'startup_failed', { error: err.message }); process.exit(1); });
