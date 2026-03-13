const pool = require('./db');

async function migrate() {
  const client = await pool.connect();
  try {

    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);

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

    // Add search_vector column if it doesn't exist yet (safe migration)
    await client.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;
    `);

    await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_search
      ON products USING GIN(search_vector);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_name_trgm
      ON products USING GIN(name gin_trgm_ops);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
      CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION update_search_vector()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS trigger_update_search_vector ON products;
      CREATE TRIGGER trigger_update_search_vector
        BEFORE INSERT OR UPDATE ON products
        FOR EACH ROW EXECUTE FUNCTION update_search_vector();
    `);

    // Backfill search_vector for existing products
    await client.query(`
      UPDATE products SET search_vector =
        setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(description, '')), 'B')
      WHERE search_vector IS NULL;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS search_history (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        query      VARCHAR(255) NOT NULL,
        user_id    UUID,
        results    INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_search_query
      ON search_history USING GIN(query gin_trgm_ops);
    `);

    await client.query(`
      INSERT INTO categories (name, description) VALUES
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
