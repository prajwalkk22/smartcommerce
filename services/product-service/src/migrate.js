const pool = require('./db');

async function migrate() {
  const client = await pool.connect();
  try {
    // Categories table first (products reference it)
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);

    // Products table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name          VARCHAR(255) NOT NULL,
        description   TEXT,
        price         DECIMAL(10,2) NOT NULL,
        stock         INTEGER DEFAULT 0,
        image_url     VARCHAR(500),
        category_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
        is_active     BOOLEAN DEFAULT true,
        created_at    TIMESTAMP DEFAULT NOW(),
        updated_at    TIMESTAMP DEFAULT NOW()
      );
    `);

    // Index for faster search and category filtering
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin(to_tsvector('english', name));
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
      CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
    `);

    // Seed some default categories if empty
    await client.query(`
      INSERT INTO categories (name, description)
      VALUES
        ('Electronics', 'Gadgets and devices'),
        ('Clothing', 'Apparel and accessories'),
        ('Books', 'Physical and digital books'),
        ('Home & Kitchen', 'Home appliances and kitchenware'),
        ('Sports', 'Sports and outdoor equipment')
      ON CONFLICT (name) DO NOTHING;
    `);

    console.log('[Product Service] Migration complete');
  } catch (err) {
    console.error('[Product Service] Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = migrate;
