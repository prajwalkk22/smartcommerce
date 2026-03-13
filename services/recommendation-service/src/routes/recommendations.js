const express = require('express');
const axios = require('axios');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const {
  trackEvent,
  getPopularProducts,
  getCollaborativeRecommendations,
  getSimilarProducts,
} = require('../engine/recommender');

const router = express.Router();

const PRODUCT_SERVICE = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002';

async function enrichWithProductDetails(recommendations) {
  if (recommendations.length === 0) return [];
  try {
    const productPromises = recommendations.map(rec =>
      axios.get(`${PRODUCT_SERVICE}/api/products/${rec.product_id}`)
        .then(res => ({ ...res.data.product, _score: rec.score, _reason: rec.reason }))
        .catch(() => null)
    );
    const products = await Promise.all(productPromises);
    return products.filter(Boolean);
  } catch (err) {
    console.error('[Recommendations] Enrich error:', err.message);
    return [];
  }
}

// POST /api/recommendations/track
router.post('/track', authMiddleware, async (req, res) => {
  const { product_id, action } = req.body;

  if (!product_id || !action) {
    return res.status(400).json({ error: 'product_id and action required' });
  }

  const validActions = ['view', 'cart_add', 'purchase'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: `action must be one of: ${validActions.join(', ')}` });
  }

  try {
    await trackEvent(req.user.userId, product_id, action);
    res.json({ message: 'Event tracked' });
  } catch (err) {
    console.error('[Track] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/recommendations/for-you
router.get('/for-you', authMiddleware, async (req, res) => {
  const limit = parseInt(req.query.limit) || 8;

  try {
    let recs = await getCollaborativeRecommendations(req.user.userId, limit);

    if (recs.length < limit) {
      const popular = await getPopularProducts(limit - recs.length);
      const existingIds = new Set(recs.map(r => r.product_id));
      const popularFiltered = popular
        .filter(p => !existingIds.has(p.product_id))
        .map(p => ({ product_id: p.product_id, score: p.score, reason: 'popular' }));
      recs = [...recs, ...popularFiltered];
    }

    const enriched = await enrichWithProductDetails(recs);

    res.json({
      recommendations: enriched,
      type: recs.length > 0 && recs[0].reason === 'collaborative' ? 'personalized' : 'popular',
    });
  } catch (err) {
    console.error('[For You] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/recommendations/similar/:productId
router.get('/similar/:productId', optionalAuth, async (req, res) => {
  const limit = parseInt(req.query.limit) || 6;

  try {
    let similar = await getSimilarProducts(req.params.productId, limit);

    if (similar.length < 3) {
      const popular = await getPopularProducts(limit, req.params.productId);
      similar = popular.map(p => ({
        product_id: p.product_id,
        score: p.score,
        reason: 'popular',
      }));
    }

    const enriched = await enrichWithProductDetails(similar);
    res.json({ recommendations: enriched });
  } catch (err) {
    console.error('[Similar] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/recommendations/popular
router.get('/popular', async (req, res) => {
  const limit = parseInt(req.query.limit) || 8;

  try {
    const popular = await getPopularProducts(limit);
    const enriched = await enrichWithProductDetails(
      popular.map(p => ({ product_id: p.product_id, score: p.score, reason: 'popular' }))
    );
    res.json({ recommendations: enriched });
  } catch (err) {
    console.error('[Popular] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
