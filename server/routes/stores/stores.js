/**
 * Stores API Routes
 * Handles store builder CRUD operations
 */
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Test pool on load
pool.query('SELECT 1').then(() => {
  console.log('✅ Stores routes: PostgreSQL connected');
}).catch(err => {
  console.error('❌ Stores routes: PostgreSQL connection failed:', err.message);
});

// Create or update a store
router.post('/', async (req, res) => {
  try {
    console.log('📝 POST /api/stores received:', { userId: req.body.userId, handle: req.body.handle, isPublished: req.body.isPublished });
    const { userId, handle, displayName, description, blocks, isPublished, returnsPolicy, theme, logo } = req.body;
    
    if (!userId || !handle) {
      return res.status(400).json({ error: 'userId and handle are required' });
    }
    
    // Clean the handle (lowercase, alphanumeric + hyphens only)
    const cleanHandle = handle.toLowerCase().replace(/[^a-z0-9-]/g, '');
    
    // Check if handle is already taken by another user
    const existingStore = await pool.query(
      'SELECT user_id FROM stores WHERE handle = $1 AND user_id != $2', 
      [cleanHandle, userId]
    );
    
    if (existingStore.rows.length > 0) {
      return res.status(409).json({ error: 'Handle already taken' });
    }
    
    // Upsert the store (update if exists, insert if new)
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

// Check if a handle is available
router.get('/check-handle', async (req, res) => {
  try {
    const { handle } = req.query;
    
    if (!handle) {
      return res.status(400).json({ error: 'Handle is required' });
    }
    
    const cleanHandle = handle.toLowerCase().replace(/[^a-z0-9-]/g, '');
    
    // First check if stores table exists
    try {
      const result = await pool.query(
        'SELECT id FROM stores WHERE handle = $1', 
        [cleanHandle]
      );
      
      const available = result.rows.length === 0;
      res.json({ available, handle: cleanHandle });
    } catch (tableError) {
      // If table doesn't exist, handle is available
      if (tableError.message && tableError.message.includes('relation "stores" does not exist')) {
        console.log('📋 Stores table does not exist yet - handle available by default');
        res.json({ available: true, handle: cleanHandle, needsSetup: true });
      } else {
        throw tableError;
      }
    }
  } catch (error) {
    console.error('Check handle error:', error);
    res.status(500).json({ error: 'Failed to check handle availability' });
  }
});

// Get a user's current/active store (most recent)
router.get('/user/:userId/current', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // First check if stores table exists
    try {
      const result = await pool.query(
        'SELECT * FROM stores WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1', 
        [userId]
      );
      
      if (result.rows.length === 0) {
        return res.json({ store: null });
      }
      
      res.json({ store: result.rows[0] });
    } catch (tableError) {
      // If table doesn't exist, return null store gracefully
      if (tableError.message && tableError.message.includes('relation "stores" does not exist')) {
        console.log('📋 Stores table does not exist yet - returning null store');
        return res.json({ store: null, needsSetup: true });
      }
      throw tableError;
    }
  } catch (error) {
    console.error('Get current store error:', error);
    res.status(500).json({ error: 'Failed to get current store' });
  }
});

// Get a user's stores
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // First check if stores table exists
    try {
      const result = await pool.query(
        'SELECT * FROM stores WHERE user_id = $1 ORDER BY updated_at DESC', 
        [userId]
      );
      
      res.json({ stores: result.rows });
    } catch (tableError) {
      // If table doesn't exist, return empty array gracefully
      if (tableError.message && tableError.message.includes('relation "stores" does not exist')) {
        console.log('📋 Stores table does not exist yet - returning empty stores');
        return res.json({ stores: [], needsSetup: true });
      }
      throw tableError;
    }
  } catch (error) {
    console.error('Get stores error:', error);
    res.status(500).json({ error: 'Failed to get stores' });
  }
});

// Get a store by handle (public endpoint for viewing stores)
router.get('/view/:handle', async (req, res) => {
  try {
    const { handle } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM stores WHERE handle = $1 AND is_published = true', 
      [handle]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found or not published' });
    }
    
    res.json({ store: result.rows[0] });
  } catch (error) {
    console.error('Get store by handle error:', error);
    res.status(500).json({ error: 'Failed to get store' });
  }
});

// Delete a store
router.delete('/:userId/:handle', async (req, res) => {
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

// Store chat endpoint (AI chatbot for store visitors)
router.post('/:handle/chat', async (req, res) => {
  try {
    const { handle } = req.params;
    const { message, sessionId, chatbotConfig } = req.body;
    
    // Get the store and its chatbot configuration
    const storeResult = await pool.query(
      'SELECT * FROM stores WHERE handle = $1', 
      [handle]
    );
    
    if (storeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    const store = storeResult.rows[0];
    const blocks = typeof store.blocks === 'string' ? JSON.parse(store.blocks) : store.blocks;
    
    // Find the chatbot block configuration
    const chatbotBlock = blocks.find(b => b.type === 'chatbot');
    const config = chatbotConfig || chatbotBlock?.data || {};
    
    // Generate AI response based on store context
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const systemPrompt = `You are a helpful customer service assistant for "${store.display_name || handle}". 
${store.description ? `Store description: ${store.description}` : ''}
${config.welcomeMessage ? `Welcome message style: ${config.welcomeMessage}` : ''}
${config.refundPolicyText ? `Refund Policy: ${config.refundPolicyText}` : ''}
${config.contactEmail ? `Contact Email: ${config.contactEmail}` : ''}
${config.contactPhone ? `Contact Phone: ${config.contactPhone}` : ''}
${config.contactHours ? `Business Hours: ${config.contactHours}` : ''}

Be concise, helpful, and friendly. If you don't know something specific about the store, say so politely.`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 300
    });
    
    const reply = completion.choices[0].message.content;
    
    res.json({ reply, sessionId });
  } catch (error) {
    console.error('Store chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

module.exports = router;
