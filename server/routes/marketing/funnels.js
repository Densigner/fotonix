/**
 * Funnels API routes
 * Backs the Funnel Builder (src/components/marketing/funnelBuilder/) —
 * before this file existed there was no backend for it at all; the editor
 * saved to a single global localStorage key and the public viewer
 * fabricated content from the URL. See src/Bible/funnel-builder/ for the
 * full history.
 */
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

pool.query('SELECT 1').then(() => {
  console.log('✅ Funnels routes: PostgreSQL connected');
}).catch(err => {
  console.error('❌ Funnels routes: PostgreSQL connection failed:', err.message);
});

// Same weak-auth convention as server/routes/member/member.js — trusts an
// x-member-uid header rather than verifying a real session/token. Not
// fixed here; consistent with the rest of this codebase's member routes.
function getUserId(req) {
  return req.headers['x-member-uid'] || 'test_user_1';
}

function cleanSlug(input) {
  return (input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function tableMissing(error) {
  return error.message && error.message.includes('does not exist');
}

// List the current user's funnels
router.get('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    const result = await pool.query(
      'SELECT * FROM funnels WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );
    res.json({ funnels: result.rows });
  } catch (error) {
    if (tableMissing(error)) {
      return res.json({ funnels: [], needsSetup: true });
    }
    console.error('List funnels error:', error);
    res.status(500).json({ error: 'Failed to list funnels' });
  }
});

// Create a funnel
router.post('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { name, slug, blocks } = req.body;
    const cleanedSlug = cleanSlug(slug || name);

    if (!cleanedSlug) {
      return res.status(400).json({ error: 'A valid name or slug is required' });
    }

    const existing = await pool.query(
      'SELECT id FROM funnels WHERE user_id = $1 AND slug = $2',
      [userId, cleanedSlug]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'You already have a funnel with that slug' });
    }

    const result = await pool.query(
      `INSERT INTO funnels (user_id, name, slug, blocks, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, name || cleanedSlug, cleanedSlug, JSON.stringify(blocks || []), JSON.stringify({})]
    );

    res.json({ funnel: result.rows[0] });
  } catch (error) {
    console.error('Create funnel error:', error);
    res.status(500).json({ error: 'Failed to create funnel' });
  }
});

// Load one funnel (must be owned by the requesting user)
router.get('/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const result = await pool.query(
      'SELECT * FROM funnels WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Funnel not found' });
    }
    res.json({ funnel: result.rows[0] });
  } catch (error) {
    console.error('Get funnel error:', error);
    res.status(500).json({ error: 'Failed to get funnel' });
  }
});

// Save blocks/name — the editor's autosave target, replacing the old
// single-key localStorage persistence.
router.patch('/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { name, blocks, metadata } = req.body;

    const result = await pool.query(
      `UPDATE funnels SET
         name = COALESCE($3, name),
         blocks = COALESCE($4, blocks),
         metadata = COALESCE($5, metadata)
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [
        req.params.id,
        userId,
        name || null,
        blocks ? JSON.stringify(blocks) : null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Funnel not found' });
    }
    res.json({ funnel: result.rows[0] });
  } catch (error) {
    console.error('Save funnel error:', error);
    res.status(500).json({ error: 'Failed to save funnel' });
  }
});

// Publish — snapshot the current state into funnel_revisions, bump version,
// and flip published=true so the public route will serve it.
router.post('/:id/publish', async (req, res) => {
  try {
    const userId = getUserId(req);
    const current = await pool.query(
      'SELECT * FROM funnels WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Funnel not found' });
    }

    const funnel = current.rows[0];
    const nextVersion = (funnel.version || 1) + 1;

    await pool.query(
      `INSERT INTO funnel_revisions (funnel_id, user_id, snapshot, version, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [funnel.id, userId, JSON.stringify(funnel.blocks), funnel.version || 1, 'auto-snapshot on publish']
    );

    const updated = await pool.query(
      `UPDATE funnels SET published = true, version = $2 WHERE id = $1 RETURNING *`,
      [funnel.id, nextVersion]
    );

    res.json({ funnel: updated.rows[0] });
  } catch (error) {
    console.error('Publish funnel error:', error);
    res.status(500).json({ error: 'Failed to publish funnel' });
  }
});

router.post('/:id/unpublish', async (req, res) => {
  try {
    const userId = getUserId(req);
    const result = await pool.query(
      'UPDATE funnels SET published = false WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Funnel not found' });
    }
    res.json({ funnel: result.rows[0] });
  } catch (error) {
    console.error('Unpublish funnel error:', error);
    res.status(500).json({ error: 'Failed to unpublish funnel' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const result = await pool.query(
      'DELETE FROM funnels WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Funnel not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete funnel error:', error);
    res.status(500).json({ error: 'Failed to delete funnel' });
  }
});

// Get the current user's claimed company slug (the first segment of their
// public funnel URLs), if any.
router.get('/company-slug/mine', async (req, res) => {
  try {
    const userId = getUserId(req);
    const result = await pool.query(
      'SELECT company_slug FROM funnel_owners WHERE user_id = $1',
      [userId]
    );
    res.json({ companySlug: result.rows[0]?.company_slug || null });
  } catch (error) {
    if (tableMissing(error)) {
      return res.json({ companySlug: null, needsSetup: true });
    }
    console.error('Get company slug error:', error);
    res.status(500).json({ error: 'Failed to get company slug' });
  }
});

// Claim (or change) the current user's company slug.
router.post('/company-slug', async (req, res) => {
  try {
    const userId = getUserId(req);
    const cleaned = cleanSlug(req.body.companySlug);
    if (!cleaned) {
      return res.status(400).json({ error: 'A valid company slug is required' });
    }

    const taken = await pool.query(
      'SELECT user_id FROM funnel_owners WHERE company_slug = $1 AND user_id != $2',
      [cleaned, userId]
    );
    if (taken.rows.length > 0) {
      return res.status(409).json({ error: 'That company slug is already taken' });
    }

    const result = await pool.query(
      `INSERT INTO funnel_owners (user_id, company_slug)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET company_slug = EXCLUDED.company_slug
       RETURNING *`,
      [userId, cleaned]
    );

    res.json({ companySlug: result.rows[0].company_slug });
  } catch (error) {
    console.error('Claim company slug error:', error);
    res.status(500).json({ error: 'Failed to claim company slug' });
  }
});

// Public — no auth. Resolves companySlug -> owning user, then serves their
// published funnel by slug. This is what FunnelViewer.js should call
// instead of fabricating content from the URL.
router.get('/public/:companySlug/:funnelSlug', async (req, res) => {
  try {
    const { companySlug, funnelSlug } = req.params;

    const owner = await pool.query(
      'SELECT user_id FROM funnel_owners WHERE company_slug = $1',
      [companySlug]
    );
    if (owner.rows.length === 0) {
      return res.status(404).json({ error: 'Funnel not found' });
    }

    const result = await pool.query(
      'SELECT * FROM funnels WHERE user_id = $1 AND slug = $2 AND published = true',
      [owner.rows[0].user_id, funnelSlug]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Funnel not found' });
    }

    res.json({ funnel: result.rows[0] });
  } catch (error) {
    if (tableMissing(error)) {
      return res.status(404).json({ error: 'Funnel not found' });
    }
    console.error('Get public funnel error:', error);
    res.status(500).json({ error: 'Failed to get funnel' });
  }
});

module.exports = router;
