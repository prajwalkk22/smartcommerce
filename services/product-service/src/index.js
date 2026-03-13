require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const migrate = require('./migrate');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const searchRoutes = require('./routes/search');

const app = express();
app.use(express.json());

const SERVICE = 'product-service';
const log = (level, event, data = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, service: SERVICE, event, ...data }));

const metrics = { requests: {}, errors: {}, durations: [] };

app.use((req, res, next) => {
  req.traceId = req.headers['x-trace-id'] || crypto.randomUUID();
  res.setHeader('X-Trace-Id', req.traceId);
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const key = `${req.method}_${res.statusCode}`;
    metrics.requests[key] = (metrics.requests[key] || 0) + 1;
    metrics.durations.push(duration);
    if (metrics.durations.length > 1000) metrics.durations.shift();
    if (res.statusCode >= 400) metrics.errors[key] = (metrics.errors[key] || 0) + 1;
    log('info', 'http_request', { traceId: req.traceId, method: req.method, path: req.path, status: res.statusCode, duration_ms: duration });
  });
  next();
});

app.get('/health', (req, res) => res.json({ service: SERVICE, status: 'ok' }));

app.get('/metrics', (req, res) => {
  const sorted = [...metrics.durations].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
  const total = Object.values(metrics.requests).reduce((a, b) => a + b, 0);
  const errors = Object.values(metrics.errors).reduce((a, b) => a + b, 0);
  res.set('Content-Type', 'text/plain');
  res.send([
    `# TYPE ${SERVICE}_http_requests_total counter`,
    `${SERVICE}_http_requests_total ${total}`,
    `# TYPE ${SERVICE}_http_errors_total counter`,
    `${SERVICE}_http_errors_total ${errors}`,
    `# TYPE ${SERVICE}_http_duration_ms summary`,
    `${SERVICE}_http_duration_ms{quantile="0.5"} ${p50}`,
    `${SERVICE}_http_duration_ms{quantile="0.95"} ${p95}`,
    `${SERVICE}_http_duration_ms{quantile="0.99"} ${p99}`,
  ].join('\n'));
});

app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/search', searchRoutes);
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, next) => {
  log('error', 'unhandled_error', { error: err.message });
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3002;
migrate().then(() => {
  app.listen(PORT, () => log('info', 'service_started', { port: PORT }));
}).catch(err => { log('error', 'startup_failed', { error: err.message }); process.exit(1); });
