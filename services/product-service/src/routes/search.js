const express = require('express');
const pool = require('../db');

const router = express.Router();

// ── GET /api/search?q=macbok&category=&page=1&limit=12 ────────
// Main search endpoint with full-text + typo tolerance + ranking
router.get('/', async (req, res) => {
  const { q = '', category = '', page = 1, limit = 12 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const userId = req.headers['x-user-id'] || null;

  if (!q.trim()) {
    return res.json({ products: [], pagination: { page: 1, limit: 12, total: 0, pages: 0 }, query: q });
  }

  try {
    const params = [];
    let paramIdx = 1;

    // Build query using both full-text search AND trigram similarity
    // ts_rank = relevance score from full-text
    // similarity() = trigram match score for typo tolerance
    // We combine both so "macbok" finds "MacBook" via trigrams
    // and "laptop computer" finds products mentioning both words
    let searchQuery = `
      SELECT
        p.*,
        c.name as category_name,
        COALESCE(ts_rank(p.search_vector, plainto_tsquery('english', $${paramIdx})), 0) as text_rank,
        COALESCE(similarity(p.name, $${paramIdx}), 0) as name_similarity,
        (
          COALESCE(ts_rank(p.search_vector, plainto_tsquery('english', $${paramIdx})), 0) * 2 +
          COALESCE(similarity(p.name, $${paramIdx}), 0)
        ) as combined_score
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true
      AND (
        p.search_vector @@ plainto_tsquery('english', $${paramIdx})
        OR similarity(p.name, $${paramIdx}) > 0.15
        OR p.name ILIKE $${paramIdx + 1}
        OR p.description ILIKE $${paramIdx + 1}
      )
    `;

    params.push(q);
    paramIdx++;
    params.push(`%${q}%`);
    paramIdx++;

    if (category) {
      searchQuery += ` AND c.name ILIKE $${paramIdx}`;
      params.push(`%${category}%`);
      paramIdx++;
    }

    searchQuery += ` ORDER BY combined_score DESC, p.created_at DESC`;
    searchQuery += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(Number(limit), offset);

    const result = await pool.query(searchQuery, params);

    // Count total for pagination
    let countQuery = `
      SELECT COUNT(*) FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true
      AND (
        p.search_vector @@ plainto_tsquery('english', $1)
        OR similarity(p.name, $1) > 0.15
        OR p.name ILIKE $2
        OR p.description ILIKE $2
      )
    `;
    const countParams = [q, `%${q}%`];
    if (category) {
      countQuery += ` AND c.name ILIKE $3`;
      countParams.push(`%${category}%`);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    // Log search for analytics
    pool.query(
      `INSERT INTO search_history (query, user_id, results) VALUES ($1, $2, $3)`,
      [q.trim().toLowerCase(), userId, total]
    ).catch(() => {});

    res.json({
      products: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
      query: q,
    });

  } catch (err) {
    console.error('[Search] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/search/suggestions?q=mac ────────────────────────
// Autocomplete — returns up to 5 product name suggestions
// Used for the live search dropdown in frontend
router.get('/suggestions', async (req, res) => {
  const { q = '' } = req.query;

  if (q.trim().length < 2) {
    return res.json({ suggestions: [] });
  }

  try {
    // Product name suggestions using trigram similarity
    const productSuggestions = await pool.query(`
      SELECT DISTINCT name, similarity(name, $1) as score
      FROM products
      WHERE is_active = true
      AND (
        name ILIKE $2
        OR similarity(name, $1) > 0.2
      )
      ORDER BY score DESC, name ASC
      LIMIT 5
    `, [q, `%${q}%`]);

    // Popular past searches matching the query
    const historySuggestions = await pool.query(`
      SELECT query, COUNT(*) as frequency
      FROM search_history
      WHERE query ILIKE $1
      GROUP BY query
      ORDER BY frequency DESC
      LIMIT 3
    `, [`${q}%`]);

    res.json({
      suggestions: productSuggestions.rows.map(r => ({
        text: r.name,
        type: 'product',
      })),
      popular_searches: historySuggestions.rows.map(r => ({
        text: r.query,
        count: parseInt(r.frequency),
        type: 'history',
      })),
    });

  } catch (err) {
    console.error('[Suggestions] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/search/trending ──────────────────────────────────
// Most searched queries in the last 7 days
router.get('/trending', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT query, COUNT(*) as search_count
      FROM search_history
      WHERE created_at > NOW() - INTERVAL '7 days'
        AND results > 0
      GROUP BY query
      ORDER BY search_count DESC
      LIMIT 8
    `);

    res.json({ trending: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
