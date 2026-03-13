const pool = require('../db');

// ── Action weights ────────────────────────────────────────────
// Purchase signals much stronger intent than a view
const WEIGHTS = {
  view: 1,
  cart_add: 3,
  purchase: 5,
};

// ── Track a user event ────────────────────────────────────────
async function trackEvent(userId, productId, action) {
  const weight = WEIGHTS[action] || 1;

  await pool.query(
    `INSERT INTO user_events (user_id, product_id, action, weight)
     VALUES ($1, $2, $3, $4)`,
    [userId, productId, action, weight]
  );

  // Update product popularity in real time
  const column = action === 'view' ? 'view_count'
    : action === 'cart_add' ? 'cart_count'
    : 'purchase_count';

  await pool.query(`
    INSERT INTO product_popularity (product_id, ${column}, score)
    VALUES ($1, 1, $2)
    ON CONFLICT (product_id) DO UPDATE SET
      ${column} = product_popularity.${column} + 1,
      score = (product_popularity.view_count * 1) +
              (product_popularity.cart_count * 3) +
              (product_popularity.purchase_count * 5),
      updated_at = NOW()
  `, [productId, weight]);
}

// ── Get popular products (cold start fallback) ─────────────────
// Used when a user has no history or not logged in
async function getPopularProducts(limit = 8, excludeProductId = null) {
  let query = `
    SELECT product_id, score, view_count, cart_count, purchase_count
    FROM product_popularity
  `;
  const params = [];

  if (excludeProductId) {
    query += ` WHERE product_id != $1`;
    params.push(excludeProductId);
  }

  query += ` ORDER BY score DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await pool.query(query, params);
  return result.rows;
}

// ── Collaborative filtering ───────────────────────────────────
// Step 1: Find users who interacted with the same products as target user
// Step 2: Get products those similar users interacted with
// Step 3: Filter out products target user already knows about
async function getCollaborativeRecommendations(userId, limit = 8) {

  // Get products this user has interacted with
  const userHistory = await pool.query(
    `SELECT DISTINCT product_id FROM user_events WHERE user_id = $1`,
    [userId]
  );

  if (userHistory.rows.length === 0) {
    // No history — fall back to popular products
    return [];
  }

  const userProductIds = userHistory.rows.map(r => r.product_id);

  // Find similar users — those who interacted with at least 1 same product
  // Score them by overlap: more shared products = more similar
  const similarUsers = await pool.query(`
    SELECT
      e.user_id,
      COUNT(DISTINCT e.product_id) as shared_products,
      SUM(e.weight) as interaction_strength
    FROM user_events e
    WHERE e.product_id = ANY($1)
      AND e.user_id != $2
    GROUP BY e.user_id
    HAVING COUNT(DISTINCT e.product_id) >= 1
    ORDER BY shared_products DESC, interaction_strength DESC
    LIMIT 20
  `, [userProductIds, userId]);

  if (similarUsers.rows.length === 0) {
    return [];
  }

  const similarUserIds = similarUsers.rows.map(r => r.user_id);

  // Get products those similar users interacted with
  // that the current user has NOT seen yet
  const recommendations = await pool.query(`
    SELECT
      e.product_id,
      COUNT(DISTINCT e.user_id) as user_count,
      SUM(e.weight) as total_weight,
      MAX(e.action) as top_action
    FROM user_events e
    WHERE e.user_id = ANY($1)
      AND e.product_id != ALL($2)
    GROUP BY e.product_id
    ORDER BY user_count DESC, total_weight DESC
    LIMIT $3
  `, [similarUserIds, userProductIds, limit]);

  return recommendations.rows.map(r => ({
    product_id: r.product_id,
    score: parseFloat(r.total_weight),
    reason: 'collaborative',
  }));
}

// ── Similar products (item-based) ─────────────────────────────
// Products that are frequently interacted with together
async function getSimilarProducts(productId, limit = 6) {
  // Find users who interacted with this product
  const usersWhoViewed = await pool.query(
    `SELECT DISTINCT user_id FROM user_events WHERE product_id = $1`,
    [productId]
  );

  if (usersWhoViewed.rows.length === 0) {
    return [];
  }

  const userIds = usersWhoViewed.rows.map(r => r.user_id);

  // Find other products those users also interacted with
  const similar = await pool.query(`
    SELECT
      product_id,
      COUNT(DISTINCT user_id) as co_occurrence,
      SUM(weight) as total_weight
    FROM user_events
    WHERE user_id = ANY($1)
      AND product_id != $2
    GROUP BY product_id
    ORDER BY co_occurrence DESC, total_weight DESC
    LIMIT $3
  `, [userIds, productId, limit]);

  return similar.rows.map(r => ({
    product_id: r.product_id,
    score: parseFloat(r.co_occurrence),
    reason: 'similar_item',
  }));
}

module.exports = {
  trackEvent,
  getPopularProducts,
  getCollaborativeRecommendations,
  getSimilarProducts,
};
