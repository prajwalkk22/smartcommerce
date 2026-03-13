const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { processPayment } = require('./payment');
const { runFraudCheck } = require('../fraud/detector');
const { logFraudEvent, logPaymentAttempt } = require('../fraud/logger');

const router = express.Router();

// GET /api/orders
router.get('/', authMiddleware, async (req, res) => {
  try {
    const orders = await pool.query(
      `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.userId]
    );

    const ordersWithItems = await Promise.all(
      orders.rows.map(async (order) => {
        const items = await pool.query(
          'SELECT * FROM order_items WHERE order_id = $1',
          [order.id]
        );
        return { ...order, items: items.rows };
      })
    );

    res.json({ orders: ordersWithItems });
  } catch (err) {
    console.error('[Orders GET] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/orders/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const order = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const items = await pool.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [req.params.id]
    );

    res.json({ order: { ...order.rows[0], items: items.rows } });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/orders/checkout
router.post('/checkout', authMiddleware, async (req, res) => {
  const { shipping_address, payment_method = 'card_test_4242' } = req.body;
  const ipAddress = req.headers['x-real-ip'] || req.ip;

  if (!shipping_address) {
    return res.status(400).json({ error: 'Shipping address is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Get cart items
    const cartResult = await client.query(
      'SELECT * FROM cart_items WHERE user_id = $1',
      [req.user.userId]
    );

    if (cartResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const cartItems = cartResult.rows;
    const totalAmount = cartItems.reduce(
      (sum, item) => sum + parseFloat(item.price) * item.quantity, 0
    );

    // 2. Run fraud detection BEFORE payment
    console.log(`[Fraud] Running check for user ${req.user.userId}, amount $${totalAmount}`);
    const fraudResult = await runFraudCheck(req.user.userId, totalAmount, ipAddress);

    console.log(`[Fraud] Score: ${fraudResult.score}, Level: ${fraudResult.level}, Flags: ${fraudResult.flags.join(', ') || 'none'}`);

    // 3. Block critical risk orders
    if (fraudResult.blocked) {
      await client.query('ROLLBACK');

      // Log the blocked attempt
      await logFraudEvent(req.user.userId, null, fraudResult, ipAddress);

      return res.status(403).json({
        error: 'Order blocked due to suspicious activity',
        risk_level: fraudResult.level,
        message: 'Please contact support if you believe this is a mistake',
      });
    }

    // 4. Log medium/high risk orders (but allow them)
    if (fraudResult.score >= 30) {
      await logFraudEvent(req.user.userId, null, fraudResult, ipAddress);
    }

    // 5. Process payment
    const paymentResult = await processPayment({
      amount: totalAmount,
      currency: 'usd',
      paymentMethod: payment_method,
      orderId: `pending_${req.user.userId}`,
    });

    // Log payment attempt
    await logPaymentAttempt(
      req.user.userId,
      totalAmount,
      paymentResult.success ? 'success' : 'failed',
      ipAddress
    );

    if (!paymentResult.success) {
      await client.query('ROLLBACK');
      return res.status(402).json({
        error: 'Payment failed',
        reason: paymentResult.error,
      });
    }

    // 6. Create order with fraud metadata
    const orderResult = await client.query(
      `INSERT INTO orders
         (user_id, total_amount, status, payment_status, payment_id, shipping_address, risk_score, fraud_flags)
       VALUES ($1, $2, 'confirmed', 'paid', $3, $4, $5, $6)
       RETURNING *`,
      [
        req.user.userId,
        totalAmount.toFixed(2),
        paymentResult.payment_id,
        shipping_address,
        fraudResult.score,
        fraudResult.flags,
      ]
    );

    const order = orderResult.rows[0];

    // 7. Create order items
    await Promise.all(
      cartItems.map(item =>
        client.query(
          `INSERT INTO order_items
             (order_id, product_id, product_name, price, quantity, image_url)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [order.id, item.product_id, item.product_name, item.price, item.quantity, item.image_url]
        )
      )
    );

    // 8. Clear cart
    await client.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.userId]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Order placed successfully',
      order: {
        ...order,
        items: cartItems.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          price: item.price,
          quantity: item.quantity,
        })),
      },
      payment: {
        payment_id: paymentResult.payment_id,
        status: paymentResult.status,
        amount: totalAmount.toFixed(2),
      },
      risk: {
        score: fraudResult.score,
        level: fraudResult.level,
        flags: fraudResult.flags,
      },
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Checkout] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// PATCH /api/orders/:id/cancel
router.patch('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const order = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.rows[0].status === 'confirmed') {
      return res.status(400).json({ error: 'Confirmed orders cannot be cancelled' });
    }

    await pool.query(
      `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );

    res.json({ message: 'Order cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
