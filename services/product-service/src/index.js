require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const migrate = require('./migrate');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const searchRoutes = require('./routes/search');

const app = express();
app.use(express.json());
const SERVICE = 'product_service';
const log = (level, event, data = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, service: SERVICE, event, ...data }));
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

app.get('/health', (req, res) => res.json({ service: SERVICE, status: 'ok' }));

app.get('/metrics', (req, res) => {
  const s = [...metrics.durations].sort((a, b) => a - b);
  const p50 = s[Math.floor(s.length * 0.5)] || 0;
  const p95 = s[Math.floor(s.length * 0.95)] || 0;
  const p99 = s[Math.floor(s.length * 0.99)] || 0;
  const total = Object.values(metrics.requests).reduce((a, b) => a + b, 0);
  const errors = Object.values(metrics.errors).reduce((a, b) => a + b, 0);
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(
    `# HELP ${SERVICE}_http_requests_total Total requests\n` +
    `# TYPE ${SERVICE}_http_requests_total counter\n` +
    `${SERVICE}_http_requests_total ${total}\n` +
    `\n` +
    `# HELP ${SERVICE}_http_errors_total Total errors\n` +
    `# TYPE ${SERVICE}_http_errors_total counter\n` +
    `${SERVICE}_http_errors_total ${errors}\n` +
    `\n` +
    `# HELP ${SERVICE}_http_duration_ms Request duration\n` +
    `# TYPE ${SERVICE}_http_duration_ms summary\n` +
    `${SERVICE}_http_duration_ms{quantile="0.5"} ${p50}\n` +
    `${SERVICE}_http_duration_ms{quantile="0.95"} ${p95}\n` +
    `${SERVICE}_http_duration_ms{quantile="0.99"} ${p99}\n`
  );
});

app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/search', searchRoutes);
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, next) => { log('error', 'unhandled_error', { error: err.message }); res.status(500).json({ error: err.message || 'Internal server error' }); });

const PORT = process.env.PORT || 3002;
migrate().then(() => app.listen(PORT, () => log('info', 'service_started', { port: PORT })))
  .catch(err => { log('error', 'startup_failed', { error: err.message }); process.exit(1); });
