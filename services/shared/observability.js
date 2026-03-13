const { v4: uuidv4 } = require('crypto').randomUUID ? { v4: () => require('crypto').randomUUID() } : require('uuid');

// ── Structured logger ─────────────────────────────────────────
function createLogger(serviceName) {
  const log = (level, event, data = {}) => {
    const entry = {
      ts: new Date().toISOString(),
      level,
      service: serviceName,
      event,
      ...data,
    };
    console.log(JSON.stringify(entry));
  };

  return {
    info:  (event, data) => log('info',  event, data),
    warn:  (event, data) => log('warn',  event, data),
    error: (event, data) => log('error', event, data),
    debug: (event, data) => log('debug', event, data),
  };
}

// ── Trace ID middleware ───────────────────────────────────────
// Reads X-Trace-Id from upstream (NGINX) or generates one
// Attaches to req.traceId and adds to response header
function traceMiddleware(req, res, next) {
  req.traceId = req.headers['x-trace-id'] || require('crypto').randomUUID();
  res.setHeader('X-Trace-Id', req.traceId);
  next();
}

// ── Prometheus metrics ────────────────────────────────────────
// Simple in-memory counters — no external lib needed
function createMetrics(serviceName) {
  const counters = {};
  const histograms = {};

  function inc(name, labels = {}) {
    const key = name + JSON.stringify(labels);
    counters[key] = (counters[key] || { name, labels, value: 0 });
    counters[key].value++;
  }

  function observe(name, value, labels = {}) {
    const key = name + JSON.stringify(labels);
    if (!histograms[key]) {
      histograms[key] = { name, labels, values: [], sum: 0, count: 0 };
    }
    histograms[key].values.push(value);
    histograms[key].sum += value;
    histograms[key].count++;
  }

  function toPrometheus() {
    const lines = [];

    for (const m of Object.values(counters)) {
      const labelStr = Object.entries(m.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      const name = `${serviceName}_${m.name}`;
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name}{${labelStr}} ${m.value}`);
    }

    for (const m of Object.values(histograms)) {
      const labelStr = Object.entries(m.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      const name = `${serviceName}_${m.name}`;
      const sorted = [...m.values].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
      const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
      const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

      lines.push(`# TYPE ${name}_duration_ms summary`);
      lines.push(`${name}_duration_ms{quantile="0.5",${labelStr}} ${p50}`);
      lines.push(`${name}_duration_ms{quantile="0.95",${labelStr}} ${p95}`);
      lines.push(`${name}_duration_ms{quantile="0.99",${labelStr}} ${p99}`);
      lines.push(`${name}_duration_ms_sum{${labelStr}} ${m.sum}`);
      lines.push(`${name}_duration_ms_count{${labelStr}} ${m.count}`);
    }

    return lines.join('\n');
  }

  return { inc, observe, toPrometheus };
}

// ── Request logging + metrics middleware ──────────────────────
function requestMiddleware(logger, metrics) {
  return (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const labels = {
        method: req.method,
        route: req.route ? req.route.path : req.path,
        status: String(res.statusCode),
      };

      metrics.inc('http_requests_total', labels);
      metrics.observe('http_request', duration, labels);

      if (res.statusCode >= 400) {
        metrics.inc('http_errors_total', labels);
      }

      logger.info('http_request', {
        traceId: req.traceId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: duration,
        ip: req.headers['x-real-ip'] || req.ip,
      });
    });

    next();
  };
}

module.exports = { createLogger, traceMiddleware, createMetrics, requestMiddleware };
