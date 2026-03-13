const pool = require('./db');

async function migrate() {
  const client = await pool.connect();
  try {

    // Cart table — one cart per user, multiple items
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

    // Orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL,
        status          VARCHAR(50) DEFAULT 'pending',
        total_amount    DECIMAL(10,2) NOT NULL,
        payment_status  VARCHAR(50) DEFAULT 'unpaid',
        payment_id      VARCHAR(255),
        shipping_address TEXT,
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
      );
    `);

    // Order items — snapshot of products at time of purchase
    // We store product details here so order history is accurate
    // even if the product is later updated or deleted
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
      CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
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
