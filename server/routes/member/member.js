const express = require('express');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const router = express.Router();

// PostgreSQL helper function
async function query(sql, params = []) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    const result = await client.query(sql, params);
    return result;
  } finally {
    await client.end();
  }
}

const DATA_DIR = path.join(__dirname, '..', 'data');
function readJSON(name, def) {
  try {
    const p = path.join(DATA_DIR, name);
    if (!fs.existsSync(p)) return def;
    const txt = fs.readFileSync(p, 'utf8');
    return JSON.parse(txt || 'null') || def;
  } catch (e) {
    console.warn('member readJSON failed', name, e);
    return def;
  }
}

// Simple auth check (in production, use proper session/JWT validation)
function getMemberUid(req) {
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('x-member-uid header:', req.headers['x-member-uid']);
  
  // For development or when NODE_ENV is not set, accept a header or return a test UID
  if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
    return req.headers['x-member-uid'] || 'test_user_1';
  }
  // In production, extract from session/JWT
  return req.user?.uid || null;
}

// Debug endpoint to check user authentication and business emails
router.get('/debug', async (req, res) => {
  try {
    const memberUid = getMemberUid(req);
    console.log('=== DEBUG INFO ===');
    console.log('1. Headers received:', req.headers);
    console.log('2. Member UID from getMemberUid:', memberUid);
    
    if (!memberUid) {
      return res.json({
        error: 'No member UID found',
        note: 'This means you may not be logged in, or the UID is not being passed correctly'
      });
    }

    // Check business emails for this user
    const result = await query(
      'SELECT * FROM member_business_emails WHERE member_uid = $1',
      [memberUid]
    );
    
    console.log('3. Business emails found:', result.rows.length);
    console.log('4. Business emails data:', result.rows);
    
    res.json({
      memberUid: memberUid,
      businessEmailsCount: result.rows.length,
      businessEmails: result.rows,
      headers: req.headers,
      note: 'This debug endpoint helps identify authentication and business email issues'
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/member/profile - Get member's profile including store name from signup
router.get('/profile', async (req, res) => {
  try {
    const memberUid = getMemberUid(req);
    if (!memberUid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get member's store name and business name from business_email_groups (set during signup)
    const result = await query(
      `SELECT store_name, business_name, created_at 
       FROM business_email_groups 
       WHERE member_uid = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [memberUid]
    );

    if (result.rows.length === 0) {
      return res.json({ 
        profile: null,
        message: 'No profile found - member may need to complete signup'
      });
    }

    const profile = result.rows[0];
    res.json({
      profile: {
        storeName: profile.store_name,
        businessName: profile.business_name,
        createdAt: profile.created_at
      }
    });
  } catch (error) {
    console.error('Get member profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/member/stats - PostgreSQL version
router.get('/stats', async (req, res) => {
  try {
    const memberUid = getMemberUid(req);
    console.log('DEBUG: Member stats requested for UID:', memberUid);
    if (!memberUid) return res.status(401).json({ error: 'Unauthorized' });

    console.log('Member UID:', memberUid);

    // Get member's affiliates from PostgreSQL. The `affiliates` table only ever
    // belonged to the manual affiliate-creation feature (removed) — it was never
    // actually created, so treat "no such table" the same as "no affiliates yet".
    let affiliatesResult;
    try {
      affiliatesResult = await query(
        'SELECT affiliate_code FROM affiliates WHERE member_uid = $1',
        [memberUid]
      );
    } catch (e) {
      if (e.code === '42P01') {
        affiliatesResult = { rows: [] };
      } else {
        throw e;
      }
    }
    const memberAffiliateCodes = affiliatesResult.rows.map(row => row.affiliate_code);
    
    console.log('Member affiliates:', affiliatesResult.rows.length);
    console.log('Member affiliate codes:', memberAffiliateCodes);

    if (memberAffiliateCodes.length === 0) {
      return res.json({
        totalSales: '0.00',
        commissions: {
          pending: '0.00',
          approved: '0.00',
          voided: '0.00'
        },
        averageCommissionRate: '0.0'
      });
    }
    
    // Get attributions and orders for member's affiliates
    const statsQuery = `
      SELECT 
        a.status,
        a.commission_cents,
        a.rate_pct,
        o.amount_cents
      FROM attributions a
      JOIN orders o ON o.order_id = a.order_id
      WHERE a.affiliate_id = ANY($1)
    `;
    const statsResult = await query(statsQuery, [memberAffiliateCodes]);
    const memberAttributions = statsResult.rows;
    
    console.log('Member attributions found:', memberAttributions.length);
    console.log('Member attributions data:', memberAttributions);
    
    // Calculate total sales from orders
    const totalSalesCents = memberAttributions.reduce((sum, attr) => {
      return sum + (parseInt(attr.amount_cents) || 0);
    }, 0);
    
    // Calculate commission stats
    const pendingCents = memberAttributions
      .filter(a => a.status === 'pending')
      .reduce((sum, a) => sum + (parseInt(a.commission_cents) || 0), 0);
      
    const approvedCents = memberAttributions
      .filter(a => a.status === 'approved')
      .reduce((sum, a) => sum + (parseInt(a.commission_cents) || 0), 0);
      
    const voidCents = memberAttributions
      .filter(a => a.status === 'void')
      .reduce((sum, a) => sum + (parseInt(a.commission_cents) || 0), 0);
      
    const avgRatePct = memberAttributions.length > 0
      ? memberAttributions.reduce((sum, a) => sum + (parseFloat(a.rate_pct) || 0), 0) / memberAttributions.length
      : 0;

    res.json({
      totalSales: (totalSalesCents / 100).toFixed(2),
      commissions: {
        pending: (pendingCents / 100).toFixed(2),
        approved: (approvedCents / 100).toFixed(2),
        voided: (voidCents / 100).toFixed(2)
      },
      averageCommissionRate: avgRatePct.toFixed(1)
    });
  } catch (e) {
    console.error('GET /api/member/stats error', e);
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/affiliate/stats - Member click dashboard stats (for AffiliateDashboardclick)
router.get('/affiliate/stats', (req, res) => {
  console.log('GET /api/affiliate/stats called with user:', req.query.user);
  console.log('Headers:', req.headers['x-member-uid']);
  try {
    const memberUid = getMemberUid(req);
    console.log('Resolved memberUid:', memberUid);
    if (!memberUid) return res.status(401).json({ error: 'Unauthorized' });

    // Get member's affiliates
    const allMemberAffiliates = readJSON('member_affiliates.json', {});
    const memberAffiliates = allMemberAffiliates[memberUid] || [];
    const memberAffiliateCodes = memberAffiliates.map(aff => aff.affiliateCode);

    // Get data for stats
    const attributions = readJSON('attributions.json', []);
    const orders = readJSON('orders.json', {});
    const clicks = readJSON('clicks.json', {});

    // Filter for member's affiliates
    const memberAttributions = attributions.filter(attr => 
      memberAffiliateCodes.includes(attr.affiliateId)
    );

    // Calculate summary stats
    const totalClicks = Object.keys(clicks).filter(k => 
      clicks[k] && memberAffiliateCodes.includes(clicks[k].affiliateId)
    ).length;

    const uniqueVisitors = totalClicks; // Simplified - in real system would track unique IPs
    const conversions = memberAttributions.length;
    const conversionRate = totalClicks > 0 ? ((conversions / totalClicks) * 100).toFixed(1) : '0.0';

    // Calculate revenue
    const revenue = memberAttributions.reduce((sum, attr) => {
      const order = orders[attr.orderId];
      if (!order) return sum;
      const amount = order.amountCents || 0;
      return sum + (amount / 100); // Convert to currency units
    }, 0);

    // Create daily data for charts (last 30 days)
    const dailyMap = new Map();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    memberAttributions.forEach(attr => {
      const date = new Date(attr.createdAt).toLocaleDateString();
      const existing = dailyMap.get(date) || { date, clicks: 0, conversions: 0 };
      existing.conversions += 1;
      dailyMap.set(date, existing);
    });

    const daily = Array.from(dailyMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));

    // Create channel data (mock for now)
    const channels = [
      { channel: 'Social Media', clicks: Math.floor(totalClicks * 0.4), conversions: Math.floor(conversions * 0.3) },
      { channel: 'Email', clicks: Math.floor(totalClicks * 0.3), conversions: Math.floor(conversions * 0.4) },
      { channel: 'Direct', clicks: Math.floor(totalClicks * 0.2), conversions: Math.floor(conversions * 0.2) },
      { channel: 'Other', clicks: Math.floor(totalClicks * 0.1), conversions: Math.floor(conversions * 0.1) }
    ];

    // Create top links data
    const topLinks = memberAffiliateCodes.map((code, i) => ({
      title: `Affiliate ${code}`,
      channel: ['Social Media', 'Email', 'Direct'][i % 3],
      clicks: Math.floor(Math.random() * 100),
      conversions: Math.floor(Math.random() * 20),
      ctr: (Math.random() * 10).toFixed(1),
      created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
    }));

    // Create referrers data
    const referrers = [
      { domain: 'facebook.com', clicks: Math.floor(totalClicks * 0.3) },
      { domain: 'twitter.com', clicks: Math.floor(totalClicks * 0.2) },
      { domain: 'instagram.com', clicks: Math.floor(totalClicks * 0.2) },
      { domain: 'google.com', clicks: Math.floor(totalClicks * 0.15) },
      { domain: 'direct', clicks: Math.floor(totalClicks * 0.15) }
    ];

    res.json({
      summary: {
        total_clicks: totalClicks,
        unique_visitors: uniqueVisitors,
        conversions: conversions,
        conversion_rate: parseFloat(conversionRate),
        revenue: revenue.toFixed(2)
      },
      daily,
      channels,
      top_links: topLinks,
      referrers
    });

  } catch (e) {
    console.error('GET /api/affiliate/stats error', e);
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/member/attributions
router.get('/attributions', (req, res) => {
  try {
    const memberUid = getMemberUid(req);
    if (!memberUid) return res.status(401).json({ error: 'Unauthorized' });

    const attributions = readJSON('attributions.json', []);
    const orders = readJSON('orders.json', {});
    
    // For now, return all attributions with enhanced data
    // In production, filter by member ownership
    const enhanced = attributions.map(a => ({
      ...a,
      affiliateName: a.affiliateId, // Could lookup from affiliates table
      paypalEmail: `${a.affiliateId}@example.com`, // Mock data
      paypalMe: a.affiliateId.includes('test') ? `paypal.me/${a.affiliateId}` : '', // Mock data
    }));
    
    res.json(enhanced);
  } catch (e) {
    console.error('GET /api/member/attributions error', e);
    res.status(500).json({ error: String(e) });
  }
});

// POST /api/member/attributions/mark-paid
router.post('/attributions/mark-paid', (req, res) => {
  try {
    const memberUid = getMemberUid(req);
    if (!memberUid) return res.status(401).json({ error: 'Unauthorized' });

    const { attributionIds } = req.body;
    if (!Array.isArray(attributionIds)) {
      return res.status(400).json({ error: 'attributionIds must be an array' });
    }

    const attributions = readJSON('attributions.json', []);
    let updated = 0;
    
    for (const attribution of attributions) {
      if (attributionIds.includes(attribution.id) && attribution.status === 'pending') {
        attribution.status = 'approved';
        attribution.approvedAt = new Date().toISOString();
        updated++;
      }
    }
    
    writeJSON('attributions.json', attributions);
    res.json({ updated });
  } catch (e) {
    console.error('POST /api/member/attributions/mark-paid error', e);
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/member/products - PostgreSQL version
router.get('/products', async (req, res) => {
  try {
    const memberUid = getMemberUid(req);
    if (!memberUid) return res.status(401).json({ error: 'Unauthorized' });

    console.log('Loading products for memberUid:', memberUid);
    
    // Check if products table exists first
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'products'
      )
    `);
    
    const tableExists = tableCheck.rows[0]?.exists;
    
    if (!tableExists) {
      console.log('Products table does not exist - returning empty array with setup flag');
      return res.json({ 
        products: [],
        needsSetup: true,
        message: 'No products created yet. Add your products in the Products section to display them here.'
      });
    }
    
    // Get products for this member
    const result = await query(`
      SELECT 
        id,
        title,
        description,
        price_cents,
        currency,
        images,
        tags,
        category,
        status,
        inventory_count,
        sku,
        created_at,
        updated_at
      FROM products 
      WHERE owner_uid = $1 AND status = 'active'
      ORDER BY created_at DESC
    `, [memberUid]);
    
    console.log(`Found ${result.rows.length} products for memberUid: ${memberUid}`);
    
    let memberProducts = result.rows.map(product => ({
      id: product.id.toString(),
      title: product.title,
      description: product.description || '',
      price: product.price_cents / 100,
      priceCents: product.price_cents,
      currency: product.currency || 'GBP',
      images: Array.isArray(product.images) ? product.images : [],
      tags: Array.isArray(product.tags) ? product.tags : [],
      category: product.category,
      status: product.status,
      inventoryCount: product.inventory_count,
      sku: product.sku,
      createdAt: product.created_at,
      updatedAt: product.updated_at,
      commissionRate: 0.10 // Default 10% for backward compatibility
    }));
    
    // If no products found, return structured response with demo flag
    if (memberProducts.length === 0) {
      console.log('No products found for member, returning sample products with needsSetup flag');
      return res.json({ 
        products: [
          { 
            id: 'sample-1', 
            title: 'Sample Product 1', 
            price: 29.99, 
            priceCents: 2999,
            description: 'This is a demo product - create your own products to replace these', 
            images: ['https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&h=400&fit=crop'],
            currency: 'GBP',
            tags: [],
            category: 'sample',
            status: 'active',
            isSample: true
          },
          { 
            id: 'sample-2', 
            title: 'Sample Product 2', 
            price: 19.99, 
            priceCents: 1999,
            description: 'This is a demo product - create your own products to replace these', 
            images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop'],
            currency: 'GBP',
            tags: [],
            category: 'sample',
            status: 'active',
            isSample: true
          },
          { 
            id: 'sample-3', 
            title: 'Sample Product 3', 
            price: 40.00, 
            priceCents: 4000,
            description: 'This is a demo product - create your own products to replace these', 
            images: ['https://images.unsplash.com/photo-1586953208462-d35b1f4468bc?w=400&h=400&fit=crop'],
            currency: 'GBP',
            tags: [],
            category: 'sample',
            status: 'active',
            isSample: true
          }
        ],
        needsSetup: true,
        message: 'No products created yet. Add your products in the Products section to display them here.'
      });
    }
    
    res.json({ products: memberProducts, needsSetup: false });
  } catch (e) {
    console.error('GET /api/member/products error', e);
    
    // Handle specific errors gracefully
    if (e.message && e.message.includes('relation "products" does not exist')) {
      console.log('Products table does not exist - returning empty with setup message');
      return res.json({ 
        products: [],
        needsSetup: true,
        message: 'Products feature is being set up. Please contact support if this persists.'
      });
    }
    
    res.status(500).json({ error: String(e) });
  }
});

// POST /api/member/products - Create new product
router.post('/products', async (req, res) => {
  try {
    const memberUid = getMemberUid(req);
    if (!memberUid) return res.status(401).json({ error: 'Unauthorized' });

    const { 
      title, 
      description, 
      price, 
      currency = 'GBP',
      images = [],
      tags = [],
      category,
      inventoryCount = 0,
      sku
    } = req.body;

    if (!title || !price) {
      return res.status(400).json({ error: 'Title and price are required' });
    }

    const { Client } = require('pg');
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });
    
    await client.connect();
    
    const result = await client.query(`
      INSERT INTO products (
        owner_uid, 
        title, 
        description, 
        price_cents, 
        currency,
        images, 
        tags, 
        category, 
        inventory_count,
        sku,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, 'active')
      RETURNING *
    `, [
      memberUid,
      title,
      description,
      Math.round(price * 100), // Convert to cents
      currency,
      JSON.stringify(images),
      JSON.stringify(tags),
      category,
      inventoryCount,
      sku
    ]);
    
    await client.end();
    
    const product = result.rows[0];
    const responseProduct = {
      id: product.id.toString(),
      title: product.title,
      description: product.description || '',
      price: product.price_cents / 100,
      priceCents: product.price_cents,
      currency: product.currency || 'GBP',
      images: Array.isArray(product.images) ? product.images : [],
      tags: Array.isArray(product.tags) ? product.tags : [],
      category: product.category,
      status: product.status,
      inventoryCount: product.inventory_count,
      sku: product.sku,
      createdAt: product.created_at,
      updatedAt: product.updated_at
    };
    
    res.status(201).json(responseProduct);
  } catch (e) {
    console.error('POST /api/member/products error', e);
    res.status(500).json({ error: String(e) });
  }
});

// PUT /api/member/products/:id - Update product
router.put('/products/:id', async (req, res) => {
  try {
    const memberUid = getMemberUid(req);
    if (!memberUid) return res.status(401).json({ error: 'Unauthorized' });

    const productId = req.params.id;
    const { 
      title, 
      description, 
      price, 
      currency,
      images,
      tags,
      category,
      inventoryCount,
      sku,
      status
    } = req.body;

    const { Client } = require('pg');
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });
    
    await client.connect();
    
    // First check if product belongs to this user
    const ownerCheck = await client.query(`
      SELECT id FROM products WHERE id = $1 AND owner_uid = $2
    `, [productId, memberUid]);
    
    if (ownerCheck.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Product not found or unauthorized' });
    }
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (price !== undefined) {
      updates.push(`price_cents = $${paramCount++}`);
      values.push(Math.round(price * 100));
    }
    if (currency !== undefined) {
      updates.push(`currency = $${paramCount++}`);
      values.push(currency);
    }
    if (images !== undefined) {
      updates.push(`images = $${paramCount++}::jsonb`);
      values.push(JSON.stringify(images));
    }
    if (tags !== undefined) {
      updates.push(`tags = $${paramCount++}::jsonb`);
      values.push(JSON.stringify(tags));
    }
    if (category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      values.push(category);
    }
    if (inventoryCount !== undefined) {
      updates.push(`inventory_count = $${paramCount++}`);
      values.push(inventoryCount);
    }
    if (sku !== undefined) {
      updates.push(`sku = $${paramCount++}`);
      values.push(sku);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    
    if (updates.length === 0) {
      await client.end();
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(productId);
    const result = await client.query(`
      UPDATE products 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);
    
    await client.end();
    
    const product = result.rows[0];
    const responseProduct = {
      id: product.id.toString(),
      title: product.title,
      description: product.description || '',
      price: product.price_cents / 100,
      priceCents: product.price_cents,
      currency: product.currency || 'GBP',
      images: Array.isArray(product.images) ? product.images : [],
      tags: Array.isArray(product.tags) ? product.tags : [],
      category: product.category,
      status: product.status,
      inventoryCount: product.inventory_count,
      sku: product.sku,
      createdAt: product.created_at,
      updatedAt: product.updated_at
    };
    
    res.json(responseProduct);
  } catch (e) {
    console.error('PUT /api/member/products/:id error', e);
    res.status(500).json({ error: String(e) });
  }
});

// DELETE /api/member/products/:id - Delete product
router.delete('/products/:id', async (req, res) => {
  try {
    const memberUid = getMemberUid(req);
    if (!memberUid) return res.status(401).json({ error: 'Unauthorized' });

    const productId = req.params.id;

    const { Client } = require('pg');
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });
    
    await client.connect();
    
    // Soft delete by setting status to 'inactive'
    const result = await client.query(`
      UPDATE products 
      SET status = 'inactive'
      WHERE id = $1 AND owner_uid = $2
      RETURNING id
    `, [productId, memberUid]);
    
    await client.end();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found or unauthorized' });
    }
    
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (e) {
    console.error('DELETE /api/member/products/:id error', e);
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/affiliates/search?q=<query> - DEPRECATED
// Use /api/member/affiliates/search instead for member's personal affiliates
router.get('/affiliates/search', (req, res) => {
  try {
    const memberUid = getMemberUid(req);
    if (!memberUid) return res.status(401).json({ error: 'Unauthorized' });

    const query = (req.query.q || '').toLowerCase().trim();
    if (!query) return res.json([]);

    // Redirect to member's personal affiliates
    const allMemberAffiliates = readJSON('member_affiliates.json', {});
    const memberAffiliates = allMemberAffiliates[memberUid] || [];

    // Filter affiliates based on search query
    const filtered = memberAffiliates.filter(affiliate => 
      affiliate.status === 'active' && (
        affiliate.displayName.toLowerCase().includes(query) ||
        affiliate.email.toLowerCase().includes(query) ||
        affiliate.affiliateCode.toLowerCase().includes(query) ||
        (affiliate.notes && affiliate.notes.toLowerCase().includes(query))
      )
    );

    res.json(filtered);
  } catch (e) {
    console.error('GET /api/affiliates/search error', e);
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/member/links
router.get('/links', (req, res) => {
  try {
    const memberUid = getMemberUid(req);
    if (!memberUid) return res.status(401).json({ error: 'Unauthorized' });

    const links = readJSON('member_links.json', []);
    
    // Filter links by member ownership
    const memberLinks = links.filter(link => link.memberUid === memberUid);
    
    res.json(memberLinks);
  } catch (e) {
    console.error('GET /api/member/links error', e);
    res.status(500).json({ error: String(e) });
  }
});

// POST /api/member/links
router.post('/links', (req, res) => {
  try {
    const memberUid = getMemberUid(req);
    if (!memberUid) return res.status(401).json({ error: 'Unauthorized' });

    const { productId, affiliateId, slug, linkCustomRatePct } = req.body;
    
    if (!productId || !affiliateId) {
      return res.status(400).json({ error: 'productId and affiliateId are required' });
    }

    const links = readJSON('member_links.json', []);
    
    // Check for slug conflicts
    const cleanSlug = (slug || `${productId}-${affiliateId}-${Date.now()}`).toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
      
    const existingSlug = links.find(l => l.slug === cleanSlug);
    if (existingSlug) {
      return res.status(400).json({ error: 'Slug already exists' });
    }
    
    const newLink = {
      id: `link_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      slug: cleanSlug,
      url: `${req.protocol}://${req.get('host')}/l/${cleanSlug}`,
      productId,
      affiliateId,
      memberUid,
      linkCustomRatePct: typeof linkCustomRatePct === 'number' ? linkCustomRatePct : null,
      createdAt: new Date().toISOString()
    };
    
    links.push(newLink);
    writeJSON('member_links.json', links);
    
    res.json(newLink);
  } catch (e) {
    console.error('POST /api/member/links error', e);
    res.status(500).json({ error: String(e) });
  }
});

// ============================================================================
// MEMBER AFFILIATE MANAGEMENT ENDPOINTS
// ============================================================================

// GET /api/member/affiliates/search - Search member's affiliates
router.get('/affiliates/search', (req, res) => {
  try {
    const memberUid = getMemberUid(req);
    if (!memberUid) return res.status(401).json({ error: 'Unauthorized' });

    const query = (req.query.q || '').toLowerCase().trim();
    if (!query) return res.json([]);

    // Read member affiliates
    const allMemberAffiliates = readJSON('member_affiliates.json', {});
    const memberAffiliates = allMemberAffiliates[memberUid] || [];

    // Filter affiliates based on search query
    const filtered = memberAffiliates.filter(affiliate => 
      affiliate.status === 'active' && (
        affiliate.displayName.toLowerCase().includes(query) ||
        affiliate.email.toLowerCase().includes(query) ||
        affiliate.affiliateCode.toLowerCase().includes(query) ||
        (affiliate.notes && affiliate.notes.toLowerCase().includes(query))
      )
    );

    res.json(filtered);
  } catch (e) {
    console.error('GET /api/member/affiliates/search error', e);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get business emails for a member (UPDATED for normalized schema)
router.get('/business-emails/:memberUid', async (req, res) => {
  try {
    const { memberUid } = req.params;
    console.log('DEBUG: Fetching business emails for UID:', memberUid);

    // Query the normalized business_emails table directly
    const result = await query(`
      SELECT 
        id,
        business_name,
        email_address,
        email_type,
        display_name,
        description,
        forward_to_email,
        is_active,
        is_verified,
        daily_send_limit,
        daily_send_count,
        (daily_send_limit - daily_send_count) as daily_remaining,
        created_at,
        updated_at
      FROM business_emails 
      WHERE member_uid = $1 
        AND is_active = true
      ORDER BY 
        CASE email_type
          WHEN 'main' THEN 1
          WHEN 'support' THEN 2
          WHEN 'orders' THEN 3
          WHEN 'noreply' THEN 4
          ELSE 5
        END,
        created_at ASC
    `, [memberUid]);
    
    if (result.rows.length === 0) {
      console.log('DEBUG: No business emails found for UID:', memberUid);
      return res.json([]);
    }

    // Transform to flat array with proper IDs (no grouping needed - normalized!)
    const businessEmails = result.rows.map(row => ({
      id: row.id,  // ✅ REAL DATABASE PRIMARY KEY
      email: row.email_address,
      type: row.email_type,
      displayName: row.display_name || row.business_name,
      description: row.description || `${row.email_type} email`,
      businessName: row.business_name,
      forwardTo: row.forward_to_email,
      isVerified: row.is_verified,
      dailyLimit: row.daily_send_limit,
      dailySent: row.daily_send_count,
      dailyRemaining: row.daily_remaining,
      createdAt: row.created_at
    }));
    
    console.log(`DEBUG: Found ${businessEmails.length} business emails for UID ${memberUid}`);
    res.json(businessEmails);
    
  } catch (error) {
    console.error('Get business emails error:', error.message);
    res.status(500).json({ error: 'Failed to get business emails', detail: error.message });
  }
});

// Check if store name is available
router.get('/check-store-name', async (req, res) => {
  try {
    const { storeName } = req.query;
    
    if (!storeName) {
      return res.status(400).json({ 
        error: 'Store name is required',
        available: false
      });
    }

    // Validate store name format
    if (!/^[a-zA-Z0-9_-]+$/.test(storeName)) {
      return res.status(400).json({ 
        error: 'Invalid store name format',
        available: false
      });
    }

    // Check if store name already exists by checking business_emails
    // Store names are part of the email address pattern: xxx.storename@fotonix.co.uk
    const existingStore = await query(
      `SELECT id FROM business_emails 
       WHERE email_address LIKE $1 
       OR email_address LIKE $2 
       OR email_address LIKE $3 
       OR email_address LIKE $4 
       LIMIT 1`,
      [
        `%.${storeName}@fotonix.co.uk`,
        `${storeName}@fotonix.co.uk`,
        `no_reply.${storeName}@fotonix.co.uk`,
        `contact.${storeName}@fotonix.co.uk`
      ]
    );

    const available = existingStore.rows.length === 0;
    
    console.log(`Store name "${storeName}" availability check: ${available ? 'available' : 'taken'}`);
    
    res.json({ 
      available,
      storeName
    });
    
  } catch (error) {
    console.error('Check store name error:', error);
    res.status(500).json({ 
      error: 'Failed to check store name availability',
      available: false,
      detail: error.message 
    });
  }
});

// Create standard business emails for new members (UPDATED for normalized schema)
router.post('/business-email/create-standard', async (req, res) => {
  try {
    const { memberUid, storeName, businessName, customEmail, forwardToEmail } = req.body;
    console.log('DEBUG: Creating business emails for UID:', memberUid, 'Store:', storeName);
    
    if (!memberUid || !storeName || !businessName) {
      return res.status(400).json({ 
        error: 'Member UID, store name, and business name are required' 
      });
    }

    // Validate store name format
    if (!/^[a-zA-Z0-9_-]+$/.test(storeName)) {
      return res.status(400).json({ 
        error: 'Invalid store name. Use letters, numbers, hyphens, and underscores only.' 
      });
    }

    // Validate custom email if provided
    if (customEmail && !/^[a-zA-Z0-9_-]+$/.test(customEmail)) {
      return res.status(400).json({ 
        error: 'Invalid custom email prefix. Use letters, numbers, hyphens, and underscores only.' 
      });
    }

    // Check if business emails already exist for this business name
    const existingResult = await query(
      'SELECT id FROM business_emails WHERE business_name = $1 LIMIT 1',
      [businessName]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Business emails already exist for this business name'
      });
    }

    // Create business email group first
    const groupResult = await query(`
      INSERT INTO business_email_groups 
      (member_uid, business_name, store_name, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, true, NOW(), NOW())
      RETURNING id
    `, [memberUid, businessName, storeName]);
    
    const groupId = groupResult.rows[0]?.id;

    // Define the 3 standard business emails
    const mainEmail = customEmail ? `${customEmail}.${storeName}@fotonix.co.uk` : `${storeName}@fotonix.co.uk`;
    const noreplyEmail = `no_reply.${storeName}@fotonix.co.uk`;
    const supportEmail = `contact.${storeName}@fotonix.co.uk`;
    const ordersEmail = `theirchoice.${storeName}@fotonix.co.uk`;
    const defaultForwardEmail = forwardToEmail || 'noreply@fotonix.co.uk';

    // Create each email address as its own row (normalized!)
    const emailsToCreate = [
      {
        address: mainEmail,
        type: 'main',
        displayName: businessName,
        description: 'Main business email'
      },
      {
        address: noreplyEmail,
        type: 'noreply',
        displayName: `${businessName} (No-Reply)`,
        description: 'No-reply email for newsletters'
      },
      {
        address: supportEmail,
        type: 'support',
        displayName: `${businessName} Support`,
        description: 'Contact and support email'
      },
      {
        address: ordersEmail,
        type: 'orders',
        displayName: `${businessName} Orders`,
        description: 'Customer choice email'
      }
    ];

    const createdEmails = [];
    
    for (const emailDef of emailsToCreate) {
      const emailResult = await query(`
        INSERT INTO business_emails 
        (
          member_uid, 
          business_name, 
          email_address, 
          email_type, 
          display_name,
          description,
          forward_to_email, 
          is_active,
          is_verified,
          daily_send_limit,
          created_at, 
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, 500, NOW(), NOW())
        RETURNING id, email_address, email_type, display_name, description
      `, [
        memberUid,
        businessName,
        emailDef.address,
        emailDef.type,
        emailDef.displayName,
        emailDef.description,
        defaultForwardEmail
      ]);
      
      if (emailResult.rows.length > 0) {
        createdEmails.push(emailResult.rows[0]);
      }
    }
    
    console.log(`✅ Created ${createdEmails.length} business emails for ${businessName}`);
    
    res.json({
      success: true,
      message: 'Standard business emails created successfully',
      groupId: groupId,
      emails: createdEmails.map(e => ({
        id: e.id,
        email: e.email_address,
        type: e.email_type,
        displayName: e.display_name,
        description: e.description
      })),
      storeName,
      businessName
    });
    
  } catch (error) {
    console.error('Create standard emails error:', error);
    res.status(500).json({
      error: 'Failed to create standard business emails',
      detail: error.message
    });
  }
});

// Create a single, real (send + receive) address for a new affiliate:
// support+<affiliateCode>@fotonix.co.uk. Rides the existing support@ mailbox
// via Postfix/Dovecot's '+' recipient_delimiter (confirmed set on both sides
// on the VPS) — no per-affiliate mailbox provisioning needed. Inbound mail
// to this address lands in support@'s real Maildir and gets attributed back
// to this row by mail-poller.js/receive-webhook.js matching the literal
// to-address, same as every other business_emails row.
router.post('/business-email/create-affiliate', async (req, res) => {
  try {
    const { memberUid, affiliateCode } = req.body;

    if (!memberUid || !affiliateCode) {
      return res.status(400).json({
        error: 'Member UID and affiliate code are required'
      });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(affiliateCode)) {
      return res.status(400).json({
        error: 'Invalid affiliate code. Use letters, numbers, hyphens, and underscores only.'
      });
    }

    // Idempotent: if this member already has an address, return it instead
    // of erroring on the UNIQUE(email_address) constraint (e.g. a retried
    // signup request).
    const existing = await query(
      'SELECT id, email_address, email_type, display_name, description FROM business_emails WHERE member_uid = $1 LIMIT 1',
      [memberUid]
    );
    if (existing.rows.length > 0) {
      return res.json({
        success: true,
        message: 'Affiliate email already exists',
        email: existing.rows[0]
      });
    }

    const emailAddress = `support+${affiliateCode.toLowerCase()}@fotonix.co.uk`;

    const result = await query(`
      INSERT INTO business_emails
      (member_uid, business_name, email_address, email_type, display_name, description, is_active, is_verified, daily_send_limit, created_at, updated_at)
      VALUES ($1, $2, $3, 'main', $4, $5, true, true, 500, NOW(), NOW())
      RETURNING id, email_address, email_type, display_name, description
    `, [
      memberUid,
      affiliateCode,
      emailAddress,
      affiliateCode,
      'Affiliate contact address'
    ]);

    console.log(`✅ Created affiliate email ${emailAddress} for ${affiliateCode}`);

    res.json({
      success: true,
      message: 'Affiliate email created successfully',
      email: result.rows[0]
    });

  } catch (error) {
    console.error('Create affiliate email error:', error);
    res.status(500).json({
      error: 'Failed to create affiliate email',
      detail: error.message
    });
  }
});

module.exports = router;