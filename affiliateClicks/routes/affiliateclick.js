const express = require('express');
const { query } = require('../../src/db/client');

const router = express.Router();

/**
 * GET /api/affiliate/stats?user=<user_id>
 * Returns summary, daily trends, channel breakdown, top links, and referrers.
 */
router.get("/api/affiliate/stats", async (req, res) => {
  const userId = req.query.user;
  if (!userId) return res.status(400).json({ error: "Missing ?user=" });

  try {
    // 🔹 Summary
    const summary = (await query(`
      SELECT
        COUNT(c.id)::int AS total_clicks,
        COUNT(DISTINCT c.ip_address)::int AS unique_visitors,
  0 AS conversions
      FROM link_clicks c
      JOIN tracked_links l ON l.id = c.link_id
      WHERE l.user_id::text = $1
    `, [userId])).rows[0] || { total_clicks: 0, unique_visitors: 0, conversions: 0 };

    const conversionRate = summary.total_clicks
      ? ((summary.conversions / summary.total_clicks) * 100).toFixed(1)
      : 0;

    // 🔹 Daily trends (last 30 days)
    const daily = (await query(`
      SELECT
        to_char(date_trunc('day', c.occurred_at), 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS clicks,
  0 AS conversions
      FROM link_clicks c
      JOIN tracked_links l ON l.id = c.link_id
      WHERE l.user_id::text = $1
        AND c.occurred_at >= now() - interval '30 days'
      GROUP BY 1
      ORDER BY 1
    `, [userId])).rows;

    // 🔹 Channel performance
    const channels = (await query(`
      SELECT
        c.channel,
        COUNT(*)::int AS clicks,
  0 AS conversions
  FROM link_clicks c
  JOIN tracked_links l ON l.id = c.link_id
  WHERE l.user_id::text = $1
      GROUP BY c.channel
      ORDER BY clicks DESC
    `, [userId])).rows;

    // 🔹 Top performing links
    const top_links = (await query(`
      SELECT
        l.slug,
        l.title,
        COALESCE(c.channel,'unknown') AS channel,
        COUNT(c.id)::int AS clicks,
  0 AS conversions,
  0.0::float AS ctr,
        l.created_at
  FROM tracked_links l
      LEFT JOIN link_clicks c ON c.link_id = l.id
  WHERE l.user_id::text = $1
      GROUP BY l.id, c.channel
      ORDER BY clicks DESC
      LIMIT 10
    `, [userId])).rows;

    // 🔹 Referrer breakdown
    const referrers = (await query(`
      SELECT
        COALESCE(substring(c.referrer from 'https?://([^/]+)'), 'unknown') AS domain,
        COUNT(*)::int AS clicks
      FROM link_clicks c
      JOIN tracked_links l ON l.id = c.link_id
      WHERE l.user_id::text = $1
      GROUP BY domain
      ORDER BY clicks DESC
      LIMIT 6
    `, [userId])).rows;

    res.json({
      summary: {
        ...summary,
        conversion_rate: conversionRate,
      },
      daily,
      channels,
      top_links,
      referrers,
    });
  } catch (e) {
    console.error("Affiliate stats error:", e);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

module.exports = router;
