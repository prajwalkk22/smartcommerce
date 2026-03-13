const pool = require('./db');

async function migrate() {
  const client = await pool.connect();
  try {

    await client.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL,
        product_id  UUID NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        price       DECIMAL(10,2) NOT NULL,
        quantity    INTEGER NOT NULL DEFAULT 1,
        image_url   VARCHAR(500),
        created_at  TIMESTAMP DEFAULT NOW(),
        updated_at  TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, product_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL,
        status          VARCHAR(50) DEFAULT 'pending',
        total_amount    DECIMAL(10,2) NOT NULL,
        payment_status  VARCHAR(50) DEFAULT 'unpaid',
        payment_id      VARCHAR(255),
        shipping_address TEXT,
        risk_score      INTEGER DEFAULT 0,
        fraud_flags     TEXT[],
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id      UUID REFERENCES orders(id) ON DELETE CASCADE,
        product_id    UUID NOT NULL,
        product_name  VARCHAR(255) NOT NULL,
        price         DECIMAL(10,2) NOT NULL,
        quantity      INTEGER NOT NULL,
        image_url     VARCHAR(500),
        created_at    TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS fraud_events (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL,
        order_id    UUID,
        event_type  VARCHAR(100) NOT NULL,
        risk_score  INTEGER NOT NULL DEFAULT 0,
        risk_level  VARCHAR(20) NOT NULL DEFAULT 'low',
        details     JSONB,
        ip_address  VARCHAR(50),
        blocked     BOOLEAN DEFAULT false,
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_attempts (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL,
        amount      DECIMAL(10,2) NOT NULL,
        status      VARCHAR(50) NOT NULL,
        ip_address  VARCHAR(50),
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;
    `);

    await client.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS fraud_flags TEXT[];
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_fraud_user ON fraud_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_fraud_created ON fraud_events(created_at);
      CREATE INDEX IF NOT EXISTS idx_payment_user ON payment_attempts(user_id);
    `);

    console.log('[Order Service] Migration complete');
  } catch (err) {
    console.error('[Order Service] Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = migrate;
