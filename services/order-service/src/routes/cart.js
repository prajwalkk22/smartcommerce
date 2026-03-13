const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/cart — get current user's cart
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM cart_items WHERE user_id = $1 ORDER BY created_at ASC`,
      [req.user.userId]
    );

    const items = result.rows;
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    res.json({
      items,
      total: parseFloat(total).toFixed(2),
      item_count: items.length
    });
  } catch (err) {
    console.error('[Cart GET] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/cart — add item to cart
// Body: { product_id, product_name, price, quantity, image_url }
router.post('/', authMiddleware, async (req, res) => {
  const { product_id, product_name, price, quantity = 1, image_url } = req.body;

  if (!product_id || !product_name || !price) {
    return res.status(400).json({ error: 'product_id, product_name and price are required' });
  }

  try {
    // Upsert — if item already in cart, increase quantity
    const result = await pool.query(
      `INSERT INTO cart_items (user_id, product_id, product_name, price, quantity, image_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, product_id)
       DO UPDATE SET
         quantity = cart_items.quantity + $5,
         updated_at = NOW()
       RETURNING *`,
      [req.user.userId, product_id, product_name, parseFloat(price), parseInt(quantity), image_url]
    );

    res.status(201).json({ item: result.rows[0], message: 'Added to cart' });
  } catch (err) {
    console.error('[Cart POST] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/cart/:product_id — update quantity
router.put('/:product_id', authMiddleware, async (req, res) => {
  const { quantity } = req.body;

  if (!quantity || quantity < 1) {
    return res.status(400).json({ error: 'Quantity must be at least 1' });
  }

  try {
    const result = await pool.query(
      `UPDATE cart_items SET quantity = $1, updated_at = NOW()
       WHERE user_id = $2 AND product_id = $3
       RETURNING *`,
      [parseInt(quantity), req.user.userId, req.params.product_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not in cart' });
    }

    res.json({ item: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/cart/:product_id — remove single item
router.delete('/:product_id', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2',
      [req.user.userId, req.params.product_id]
    );
    res.json({ message: 'Item removed from cart' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/cart — clear entire cart
router.delete('/', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.userId]);
    res.json({ message: 'Cart cleared' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
