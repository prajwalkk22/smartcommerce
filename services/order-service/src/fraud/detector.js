const pool = require('../db');

const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

function getRiskLevel(score) {
  if (score >= 85) return RISK_LEVELS.CRITICAL;
  if (score >= 60) return RISK_LEVELS.HIGH;
  if (score >= 30) return RISK_LEVELS.MEDIUM;
  return RISK_LEVELS.LOW;
}

// ── Rule 1: Order velocity ─────────────────────────────────────
// Too many orders in a short time = fraud signal
async function checkOrderVelocity(userId) {
  const flags = [];
  let score = 0;

  const last10Min = await pool.query(`
    SELECT COUNT(*) as count FROM orders
    WHERE user_id = $1
    AND created_at > NOW() - INTERVAL '10 minutes'
  `, [userId]);

  const last1Hour = await pool.query(`
    SELECT COUNT(*) as count FROM orders
    WHERE user_id = $1
    AND created_at > NOW() - INTERVAL '1 hour'
  `, [userId]);

  const ordersLast10Min = parseInt(last10Min.rows[0].count);
  const ordersLast1Hour = parseInt(last1Hour.rows[0].count);

  if (ordersLast10Min >= 3) {
    score += 40;
    flags.push(`HIGH_ORDER_VELOCITY: ${ordersLast10Min} orders in 10 minutes`);
  } else if (ordersLast10Min >= 2) {
    score += 20;
    flags.push(`ELEVATED_ORDER_VELOCITY: ${ordersLast10Min} orders in 10 minutes`);
  }

  if (ordersLast1Hour >= 10) {
    score += 30;
    flags.push(`HIGH_HOURLY_ORDERS: ${ordersLast1Hour} orders in 1 hour`);
  }

  return { score, flags };
}

// ── Rule 2: Amount anomaly ─────────────────────────────────────
// Order amount much higher than user's average = fraud signal
async function checkAmountAnomaly(userId, currentAmount) {
  const flags = [];
  let score = 0;

  const history = await pool.query(`
    SELECT AVG(total_amount) as avg_amount, MAX(total_amount) as max_amount,
           COUNT(*) as order_count
    FROM orders
    WHERE user_id = $1 AND status != 'cancelled'
  `, [userId]);

  const { avg_amount, max_amount, order_count } = history.rows[0];

  if (parseInt(order_count) >= 3 && avg_amount) {
    const avg = parseFloat(avg_amount);
    const multiplier = currentAmount / avg;

    if (multiplier > 10) {
      score += 45;
      flags.push(`EXTREME_AMOUNT_ANOMALY: ${multiplier.toFixed(1)}x above average ($${avg.toFixed(2)})`);
    } else if (multiplier > 5) {
      score += 25;
      flags.push(`HIGH_AMOUNT_ANOMALY: ${multiplier.toFixed(1)}x above average ($${avg.toFixed(2)})`);
    } else if (multiplier > 3) {
      score += 10;
      flags.push(`MODERATE_AMOUNT_ANOMALY: ${multiplier.toFixed(1)}x above average`);
    }
  }

  // Absolute high value check (regardless of history)
  if (currentAmount > 5000) {
    score += 20;
    flags.push(`HIGH_VALUE_ORDER: $${currentAmount.toFixed(2)}`);
  }

  return { score, flags };
}

// ── Rule 3: Cart manipulation ──────────────────────────────────
// Rapid cart changes before checkout = testing stolen card limits
async function checkCartManipulation(userId) {
  const flags = [];
  let score = 0;

  const recentCartChanges = await pool.query(`
    SELECT COUNT(*) as count FROM cart_items
    WHERE user_id = $1
    AND updated_at > NOW() - INTERVAL '5 minutes'
  `, [userId]);

  const changes = parseInt(recentCartChanges.rows[0].count);

  if (changes > 10) {
    score += 30;
    flags.push(`RAPID_CART_MANIPULATION: ${changes} cart changes in 5 minutes`);
  } else if (changes > 5) {
    score += 15;
    flags.push(`ELEVATED_CART_ACTIVITY: ${changes} cart changes in 5 minutes`);
  }

  return { score, flags };
}

// ── Rule 4: Account age ────────────────────────────────────────
// Very new account placing large orders = fraud signal
async function checkAccountAge(userId, orderAmount) {
  const flags = [];
  let score = 0;

  // We don't have direct access to user service DB
  // so we check order history as proxy for account activity
  const firstOrder = await pool.query(`
    SELECT MIN(created_at) as first_order FROM orders WHERE user_id = $1
  `, [userId]);

  const orderCount = await pool.query(`
    SELECT COUNT(*) as count FROM orders WHERE user_id = $1
  `, [userId]);

  const count = parseInt(orderCount.rows[0].count);

  // First ever order over $500 = elevated risk
  if (count === 0 && orderAmount > 500) {
    score += 20;
    flags.push(`NEW_ACCOUNT_HIGH_VALUE: First order $${orderAmount.toFixed(2)}`);
  }

  // First ever order over $2000 = high risk
  if (count === 0 && orderAmount > 2000) {
    score += 30;
    flags.push(`NEW_ACCOUNT_VERY_HIGH_VALUE: First order $${orderAmount.toFixed(2)}`);
  }

  return { score, flags };
}

// ── Rule 5: Payment failure history ───────────────────────────
// Multiple failed payments = testing stolen cards
async function checkPaymentFailures(userId) {
  const flags = [];
  let score = 0;

  const recentFailures = await pool.query(`
    SELECT COUNT(*) as count FROM payment_attempts
    WHERE user_id = $1
    AND status = 'failed'
    AND created_at > NOW() - INTERVAL '1 hour'
  `, [userId]);

  const failures = parseInt(recentFailures.rows[0].count);

  if (failures >= 5) {
    score += 50;
    flags.push(`MULTIPLE_PAYMENT_FAILURES: ${failures} failed payments in 1 hour`);
  } else if (failures >= 3) {
    score += 25;
    flags.push(`ELEVATED_PAYMENT_FAILURES: ${failures} failed payments in 1 hour`);
  } else if (failures >= 2) {
    score += 10;
    flags.push(`SOME_PAYMENT_FAILURES: ${failures} failed payments in 1 hour`);
  }

  return { score, flags };
}

// ── Main fraud check — runs all rules ─────────────────────────
async function runFraudCheck(userId, orderAmount, ipAddress) {
  const results = await Promise.all([
    checkOrderVelocity(userId),
    checkAmountAnomaly(userId, orderAmount),
    checkCartManipulation(userId),
    checkAccountAge(userId, orderAmount),
    checkPaymentFailures(userId),
  ]);

  // Combine all scores and flags
  const totalScore = Math.min(100, results.reduce((sum, r) => sum + r.score, 0));
  const allFlags = results.flatMap(r => r.flags);
  const riskLevel = getRiskLevel(totalScore);

  return {
    score: totalScore,
    level: riskLevel,
    flags: allFlags,
    blocked: riskLevel === RISK_LEVELS.CRITICAL,
    details: {
      velocity: results[0],
      amountAnomaly: results[1],
      cartManipulation: results[2],
      accountAge: results[3],
      paymentFailures: results[4],
    },
  };
}

module.exports = { runFraudCheck, getRiskLevel };
