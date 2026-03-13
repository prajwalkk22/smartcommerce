const express = require('express');
const pool = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { upload, getImageUrl } = require('../upload/s3');

const router = express.Router();

// ─── GET /api/products ────────────────────────────────────────
// Public. Supports: ?search=, ?category=, ?page=, ?limit=
router.get('/', async (req, res) => {
  const { search, category, page = 1, limit = 12 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true
    `;
    const params = [];
    let paramIndex = 1;

    // Search by name or description
    if (search) {
      query += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Filter by category name
    if (category) {
      query += ` AND c.name ILIKE $${paramIndex}`;
      params.push(`%${category}%`);
      paramIndex++;
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true
    `;
    const countParams = [];
    let countIndex = 1;
    if (search) {
      countQuery += ` AND (p.name ILIKE $${countIndex} OR p.description ILIKE $${countIndex})`;
      countParams.push(`%${search}%`);
      countIndex++;
    }
    if (category) {
      countQuery += ` AND c.name ILIKE $${countIndex}`;
      countParams.push(`%${category}%`);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      products: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[Products GET] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/products/:id ────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1 AND p.is_active = true`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/products ───────────────────────────────────────
// Admin only. Accepts multipart/form-data for image upload
router.post('/', authMiddleware, adminMiddleware, upload.single('image'), async (req, res) => {
  const { name, description, price, stock, category_id } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: 'Name and price are required' });
  }

  try {
    // Get image URL (S3 in production, placeholder in dev)
    const image_url = await getImageUrl(req.file);

    const result = await pool.query(
      `INSERT INTO products (name, description, price, stock, image_url, category_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description, parseFloat(price), parseInt(stock) || 0, image_url, category_id || null]
    );

    res.status(201).json({ product: result.rows[0] });
  } catch (err) {
    console.error('[Products POST] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/products/:id ────────────────────────────────────
// Admin only
router.put('/:id', authMiddleware, adminMiddleware, upload.single('image'), async (req, res) => {
  const { name, description, price, stock, category_id, is_active } = req.body;

  try {
    const existing = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const image_url = req.file
      ? await getImageUrl(req.file)
      : existing.rows[0].image_url;

    const result = await pool.query(
      `UPDATE products
       SET name=$1, description=$2, price=$3, stock=$4,
           image_url=$5, category_id=$6, is_active=$7, updated_at=NOW()
       WHERE id=$8
       RETURNING *`,
      [
        name || existing.rows[0].name,
        description || existing.rows[0].description,
        price ? parseFloat(price) : existing.rows[0].price,
        stock !== undefined ? parseInt(stock) : existing.rows[0].stock,
        image_url,
        category_id || existing.rows[0].category_id,
        is_active !== undefined ? is_active : existing.rows[0].is_active,
        req.params.id,
      ]
    );

    res.json({ product: result.rows[0] });
  } catch (err) {
    console.error('[Products PUT] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/products/:id ─────────────────────────────────
// Soft delete — sets is_active = false (admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query(
      'UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1',
      [req.params.id]
    );
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
