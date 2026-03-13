const pool = require('../db');

async function logFraudEvent(userId, orderId, fraudResult, ipAddress) {
  try {
    await pool.query(`
      INSERT INTO fraud_events
        (user_id, order_id, event_type, risk_score, risk_level, details, ip_address, blocked)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      userId,
      orderId || null,
      fraudResult.flags.length > 0 ? fraudResult.flags[0] : 'CHECKOUT_SCAN',
      fraudResult.score,
      fraudResult.level,
      JSON.stringify(fraudResult.details),
      ipAddress || null,
      fraudResult.blocked,
    ]);
  } catch (err) {
    console.error('[Fraud Logger] Failed to log event:', err.message);
  }
}

async function logPaymentAttempt(userId, amount, status, ipAddress) {
  try {
    await pool.query(`
      INSERT INTO payment_attempts (user_id, amount, status, ip_address)
      VALUES ($1, $2, $3, $4)
    `, [userId, amount, status, ipAddress || null]);
  } catch (err) {
    console.error('[Fraud Logger] Failed to log payment attempt:', err.message);
  }
}

module.exports = { logFraudEvent, logPaymentAttempt };
