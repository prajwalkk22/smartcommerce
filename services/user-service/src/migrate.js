const pool = require('./db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(100) NOT NULL,
        email       VARCHAR(255) UNIQUE NOT NULL,
        password    VARCHAR(255) NOT NULL,
        role        VARCHAR(20) DEFAULT 'customer',
        created_at  TIMESTAMP DEFAULT NOW(),
        updated_at  TIMESTAMP DEFAULT NOW()
      );
    `);

    // Track user activity for recommendations (Day 6)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_activity (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
        action      VARCHAR(50) NOT NULL,
        product_id  UUID,
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('[User Service] Migration complete');
  } catch (err) {
    console.error('[User Service] Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = migrate;
