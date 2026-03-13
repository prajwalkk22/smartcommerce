const { Pool } = require('pg');

// Connection pool — reuses DB connections instead of opening a new one per request
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('[User Service] Unexpected DB error:', err);
});

module.exports = pool;
