/**
 * Standalone Stores API Server
 * Lightweight server for store builder CRUD operations
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.STORES_PORT || 3001;

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Test connection
pool.query('SELECT 1').then(() => {
  console.log('✅ PostgreSQL connected');
}).catch(err => {
  console.error('❌ PostgreSQL connection failed:', err.message);
});

// CORS configuration - allow frontend domains
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://fotonix.co.uk',
  'https://www.fotonix.co.uk',
  'https://fotonix-co-uk.vercel.app',  // Vercel preview
  'https://fotonix.vercel.app',         // Vercel deployment
  'https://fotonix.netlify.app',        // Netlify if used
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.fotonix.co.uk') || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'fotonix-stores-api' });
});

// ===== STORES API =====

// Create or update a store
app.post('/api/stores', async (req, res) => {
  try {
    console.log('📝 POST /api/stores received:', { userId: req.body.userId, handle: req.body.handle });
    const { userId, handle, displayName, description, blocks, isPublished, returnsPolicy, theme, logo } = req.body;
    
    if (!userId || !handle) {
      return res.status(400).json({ error: 'userId and handle are required' });
    }
    
    const cleanHandle = handle.toLowerCase().replace(/[^a-z0-9-]/g, '');
    
    // Check if handle is taken by another user
    const existingStore = await pool.query(
      'SELECT user_id FROM stores WHERE handle = $1 AND user_id != $2', 
      [cleanHandle, userId]
    );
    
    if (existingStore.rows.length > 0) {
      return res.status(409).json({ error: 'Handle already taken' });
    }
    
    const result = await pool.query(`
      INSERT INTO stores (user_id, handle, display_name, description, blocks, is_published, theme, logo, returns_policy, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (user_id, handle) 
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        blocks = EXCLUDED.blocks,
        is_published = EXCLUDED.is_published,
        theme = EXCLUDED.theme,
        logo = EXCLUDED.logo,
        returns_policy = EXCLUDED.returns_policy,
        updated_at = NOW()
      RETURNING *
    `, [userId, cleanHandle, displayName || '', description || '', JSON.stringify(blocks), isPublished || false, theme || null, logo || null, returnsPolicy ? JSON.stringify(returnsPolicy) : null]);
    
    res.json({ success: true, store: result.rows[0] });
  } catch (error) {
    console.error('Store save error:', error);
    res.status(500).json({ error: 'Failed to save store' });
  }
});

// Check handle availability
app.get('/api/stores/check-handle', async (req, res) => {
  try {
    const { handle } = req.query;
    if (!handle) return res.status(400).json({ error: 'Handle is required' });
    
    const cleanHandle = handle.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const result = await pool.query('SELECT id FROM stores WHERE handle = $1', [cleanHandle]);
    
    res.json({ available: result.rows.length === 0, handle: cleanHandle });
  } catch (error) {
    console.error('Check handle error:', error);
    res.status(500).json({ error: 'Failed to check handle' });
  }
});

// Get user's current store
app.get('/api/stores/user/:userId/current', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT * FROM stores WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1', 
      [userId]
    );
    
    res.json({ store: result.rows.length > 0 ? result.rows[0] : null });
  } catch (error) {
    console.error('Get current store error:', error);
    res.status(500).json({ error: 'Failed to get store' });
  }
});

// Get user's stores
app.get('/api/stores/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT * FROM stores WHERE user_id = $1 ORDER BY updated_at DESC', 
      [userId]
    );
    
    res.json({ stores: result.rows });
  } catch (error) {
    console.error('Get stores error:', error);
    res.status(500).json({ error: 'Failed to get stores' });
  }
});

// Get store by handle (public)
app.get('/api/stores/view/:handle', async (req, res) => {
  try {
    const { handle } = req.params;
    const result = await pool.query(
      'SELECT * FROM stores WHERE handle = $1 AND is_published = true', 
      [handle]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    res.json({ store: result.rows[0] });
  } catch (error) {
    console.error('Get store error:', error);
    res.status(500).json({ error: 'Failed to get store' });
  }
});

// Delete store
app.delete('/api/stores/:userId/:handle', async (req, res) => {
  try {
    const { userId, handle } = req.params;
    const result = await pool.query(
      'DELETE FROM stores WHERE user_id = $1 AND handle = $2 RETURNING *', 
      [userId, handle]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    res.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    console.error('Delete store error:', error);
    res.status(500).json({ error: 'Failed to delete store' });
  }
});

// ===== MEMBER API (basic products endpoint) =====

// Get products for a user
app.get('/api/member/products', async (req, res) => {
  try {
    const uid = req.headers['x-member-uid'];
    if (!uid) {
      return res.status(401).json({ error: 'Missing x-member-uid header' });
    }
    
    // Check if products table exists
    try {
      const result = await pool.query(
        'SELECT * FROM products WHERE owner_id = $1 ORDER BY created_at DESC',
        [uid]
      );
      res.json({ products: result.rows, needsSetup: false });
    } catch (tableError) {
      if (tableError.message && tableError.message.includes('relation "products" does not exist')) {
        res.json({ 
          products: [], 
          needsSetup: true,
          message: 'No products created yet. Add products in your member dashboard to display them here.'
        });
      } else {
        throw tableError;
      }
    }
  } catch (error) {
    console.error('Products API error:', error);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

app.listen(PORT, () => {
  console.log(`Stores API server running on port ${PORT}`);
});
