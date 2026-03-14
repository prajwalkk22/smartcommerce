function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  // Remove server fingerprint
  res.removeHeader('X-Powered-By');
  next();
}

function validateEnv(required) {
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[Startup] Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

module.exports = { securityHeaders, validateEnv };
