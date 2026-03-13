const pool = require('./db');

async function migrate() {
  const client = await pool.connect();
  try {

    // Every user interaction is stored here
    // action: 'view' | 'cart_add' | 'purchase'
    // weight: view=1, cart_add=3, purchase=5 (purchases matter more)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_events (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL,
        product_id  UUID NOT NULL,
        action      VARCHAR(50) NOT NULL,
        weight      INTEGER NOT NULL DEFAULT 1,
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);

    // Precomputed recommendations cache
    // Recalculated periodically so API responses are fast
    await client.query(`
      CREATE TABLE IF NOT EXISTS recommendations_cache (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID NOT NULL,
        product_id    UUID NOT NULL,
        score         FLOAT NOT NULL DEFAULT 0,
        reason        VARCHAR(100),
        updated_at    TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, product_id)
      );
    `);

    // Product popularity scores (updated on each event)
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_popularity (
        product_id    UUID PRIMARY KEY,
        view_count    INTEGER DEFAULT 0,
        cart_count    INTEGER DEFAULT 0,
        purchase_count INTEGER DEFAULT 0,
        score         FLOAT DEFAULT 0,
        updated_at    TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_events_user ON user_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_events_product ON user_events(product_id);
      CREATE INDEX IF NOT EXISTS idx_cache_user ON recommendations_cache(user_id);
      CREATE INDEX IF NOT EXISTS idx_popularity_score ON product_popularity(score DESC);
    `);

    console.log('[Recommendation Service] Migration complete');
  } catch (err) {
    console.error('[Recommendation Service] Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = migrate;
