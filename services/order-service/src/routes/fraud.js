const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// GET /api/fraud/events — recent fraud events (admin only)
router.get('/events', authMiddleware, adminOnly, async (req, res) => {
  const { level, limit = 50, page = 1 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    let query = `
      SELECT * FROM fraud_events
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (level) {
      query += ` AND risk_level = $${idx}`;
      params.push(level);
      idx++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(Number(limit), offset);

    const result = await pool.query(query, params);

    const total = await pool.query(
      `SELECT COUNT(*) FROM fraud_events ${level ? 'WHERE risk_level = $1' : ''}`,
      level ? [level] : []
    );

    res.json({
      events: result.rows,
      pagination: {
        total: parseInt(total.rows[0].count),
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (err) {
    console.error('[Fraud Events] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/fraud/stats — summary stats (admin only)
router.get('/stats', authMiddleware, adminOnly, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_events,
        COUNT(*) FILTER (WHERE risk_level = 'critical') as critical,
        COUNT(*) FILTER (WHERE risk_level = 'high') as high,
        COUNT(*) FILTER (WHERE risk_level = 'medium') as medium,
        COUNT(*) FILTER (WHERE risk_level = 'low') as low,
        COUNT(*) FILTER (WHERE blocked = true) as blocked_orders,
        AVG(risk_score) as avg_risk_score
      FROM fraud_events
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);

    const topFlags = await pool.query(`
      SELECT event_type, COUNT(*) as count
      FROM fraud_events
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY event_type
      ORDER BY count DESC
      LIMIT 10
    `);

    const recentBlocked = await pool.query(`
      SELECT user_id, risk_score, risk_level, created_at, details
      FROM fraud_events
      WHERE blocked = true
      ORDER BY created_at DESC
      LIMIT 5
    `);

    res.json({
      last_24h: stats.rows[0],
      top_fraud_signals: topFlags.rows,
      recently_blocked: recentBlocked.rows,
    });
  } catch (err) {
    console.error('[Fraud Stats] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/fraud/user/:userId — fraud history for a user (admin only)
router.get('/user/:userId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const events = await pool.query(`
      SELECT * FROM fraud_events
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [req.params.userId]);

    const summary = await pool.query(`
      SELECT
        COUNT(*) as total_events,
        MAX(risk_score) as max_risk_score,
        AVG(risk_score) as avg_risk_score,
        COUNT(*) FILTER (WHERE blocked = true) as times_blocked
      FROM fraud_events
      WHERE user_id = $1
    `, [req.params.userId]);

    res.json({
      user_id: req.params.userId,
      summary: summary.rows[0],
      events: events.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
