/**
 * User Sync Routes
 * 
 * Syncs Firebase Auth users to PostgreSQL for unified data management
 * Firebase handles auth, PostgreSQL is the source of truth for user data
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://fotonix:fotonixpass@51.75.78.118:5432/fotonix_dev'
});

// Test connection on load
pool.query('SELECT 1').then(() => {
  console.log('✅ User sync routes: PostgreSQL connected');
}).catch(err => {
  console.error('❌ User sync routes: PostgreSQL connection failed:', err.message);
});

/**
 * POST /api/users/sync
 * Called after Firebase login/signup to sync user to PostgreSQL
 */
router.post('/sync', async (req, res) => {
  try {
    const { 
      firebaseUid, 
      email, 
      username, 
      displayName, 
      photoURL, 
      signupSource,
      isNewUser 
    } = req.body;

    if (!firebaseUid || !email) {
      return res.status(400).json({ error: 'firebaseUid and email are required' });
    }

    // Upsert user - create if new, update if exists
    const result = await pool.query(`
      INSERT INTO users (
        firebase_uid, 
        email, 
        username, 
        display_name, 
        photo_url, 
        signup_source,
        last_activity_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW())
      ON CONFLICT (firebase_uid) 
      DO UPDATE SET
        email = EXCLUDED.email,
        username = COALESCE(EXCLUDED.username, users.username),
        display_name = COALESCE(EXCLUDED.display_name, users.display_name),
        photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url),
        last_activity_at = NOW(),
        updated_at = NOW()
      RETURNING id, firebase_uid, email, user_state, total_orders, total_spent, created_at
    `, [firebaseUid, email, username, displayName, photoURL, signupSource]);

    const user = result.rows[0];

    // Log activity
    await pool.query(`
      INSERT INTO user_activity (firebase_uid, activity_type, metadata)
      VALUES ($1, $2, $3)
    `, [firebaseUid, isNewUser ? 'signup' : 'login', JSON.stringify({ source: signupSource })]);

    res.json({
      success: true,
      user: {
        id: user.id,
        firebaseUid: user.firebase_uid,
        email: user.email,
        userState: user.user_state,
        totalOrders: user.total_orders,
        totalSpent: parseFloat(user.total_spent),
        createdAt: user.created_at
      }
    });

  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({ error: 'Failed to sync user', details: error.message });
  }
});

/**
 * GET /api/users/:firebaseUid
 * Get user profile from PostgreSQL
 */
router.get('/:firebaseUid', async (req, res) => {
  try {
    const { firebaseUid } = req.params;

    const result = await pool.query(`
      SELECT 
        id, firebase_uid, email, username, display_name, photo_url,
        user_state, total_orders, total_spent, last_order_at, last_activity_at,
        email_verified, subscribed_marketing, subscribed_product_updates,
        signup_source, created_at, updated_at
      FROM users 
      WHERE firebase_uid = $1
    `, [firebaseUid]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * GET /api/users/:firebaseUid/orders
 * Get all orders for a user
 */
router.get('/:firebaseUid/orders', async (req, res) => {
  try {
    const { firebaseUid } = req.params;

    const result = await pool.query(`
      SELECT 
        id, order_id, status, order_type, 
        subtotal, delivery_fee, total, currency,
        num_stencils, stencil_data, storage_urls, layer_colors,
        shipping_address, fulfillment_status, tracking_number,
        shipped_at, delivered_at, created_at
      FROM stencil_orders 
      WHERE firebase_uid = $1
      ORDER BY created_at DESC
    `, [firebaseUid]);

    res.json({ orders: result.rows });

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

/**
 * GET /api/users/:firebaseUid/downloads
 * Get all stencil downloads for a user
 */
router.get('/:firebaseUid/downloads', async (req, res) => {
  try {
    const { firebaseUid } = req.params;

    const result = await pool.query(`
      SELECT 
        id, file_name, file_type, storage_url, thumbnail_url,
        layer_index, threshold, settings, created_at
      FROM stencil_downloads 
      WHERE firebase_uid = $1
      ORDER BY created_at DESC
    `, [firebaseUid]);

    res.json({ downloads: result.rows });

  } catch (error) {
    console.error('Error fetching downloads:', error);
    res.status(500).json({ error: 'Failed to fetch downloads' });
  }
});

/**
 * POST /api/users/:firebaseUid/downloads
 * Save a stencil download
 */
router.post('/:firebaseUid/downloads', async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    const { fileName, fileType, storageUrl, thumbnailUrl, layerIndex, threshold, settings } = req.body;

    if (!fileName || !storageUrl) {
      return res.status(400).json({ error: 'fileName and storageUrl are required' });
    }

    const result = await pool.query(`
      INSERT INTO stencil_downloads (
        firebase_uid, file_name, file_type, storage_url, thumbnail_url,
        layer_index, threshold, settings
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, file_name, storage_url, created_at
    `, [firebaseUid, fileName, fileType, storageUrl, thumbnailUrl, layerIndex, threshold, JSON.stringify(settings || {})]);

    // Update user activity
    await pool.query(`
      UPDATE users SET last_activity_at = NOW() WHERE firebase_uid = $1
    `, [firebaseUid]);

    res.json({ success: true, download: result.rows[0] });

  } catch (error) {
    console.error('Error saving download:', error);
    res.status(500).json({ error: 'Failed to save download' });
  }
});

/**
 * PATCH /api/users/:firebaseUid/preferences
 * Update user email preferences
 */
router.patch('/:firebaseUid/preferences', async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    const { subscribedMarketing, subscribedProductUpdates } = req.body;

    const result = await pool.query(`
      UPDATE users SET
        subscribed_marketing = COALESCE($2, subscribed_marketing),
        subscribed_product_updates = COALESCE($3, subscribed_product_updates),
        updated_at = NOW()
      WHERE firebase_uid = $1
      RETURNING firebase_uid, subscribed_marketing, subscribed_product_updates
    `, [firebaseUid, subscribedMarketing, subscribedProductUpdates]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, preferences: result.rows[0] });

  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * POST /api/users/:firebaseUid/activity
 * Log user activity
 */
router.post('/:firebaseUid/activity', async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    const { activityType, metadata } = req.body;

    await pool.query(`
      INSERT INTO user_activity (firebase_uid, activity_type, metadata)
      VALUES ($1, $2, $3)
    `, [firebaseUid, activityType, JSON.stringify(metadata || {})]);

    // Update last activity
    await pool.query(`
      UPDATE users SET last_activity_at = NOW() WHERE firebase_uid = $1
    `, [firebaseUid]);

    res.json({ success: true });

  } catch (error) {
    console.error('Error logging activity:', error);
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

module.exports = router;
