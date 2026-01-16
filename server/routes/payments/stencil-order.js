const express = require('express');
const router = express.Router();
const { getClient } = require('../../paypal');
const admin = require('../../firebase-admin');
const nodemailer = require('nodemailer');
const fetch = require('node-fetch');
const { Pool } = require('pg');

// PostgreSQL connection for unified user/order storage
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://fotonix:fotonixpass@51.75.78.118:5432/fotonix_dev'
});

// Test connection on load
pool.query('SELECT 1').then(() => {
  console.log('✅ Stencil order routes: PostgreSQL connected');
}).catch(err => {
  console.error('❌ Stencil order routes: PostgreSQL connection failed:', err.message);
});

// Save order to PostgreSQL (unified data store)
async function saveOrderToPostgres(orderData) {
  try {
    const {
      orderId,
      firebaseUid,
      orderType, // 'paid', 'free_signup', 'test'
      status,
      paypalOrderId,
      paypalCaptureId,
      paypalStatus,
      pricing,
      stencilData,
      shippingAddress
    } = orderData;

    const result = await pool.query(`
      INSERT INTO stencil_orders (
        order_id, firebase_uid, order_type, status,
        paypal_order_id, paypal_capture_id, paypal_status,
        subtotal, delivery_fee, total, currency,
        num_stencils, stencil_data, storage_urls, layer_colors,
        shipping_address, fulfillment_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (order_id) DO UPDATE SET
        status = EXCLUDED.status,
        paypal_status = EXCLUDED.paypal_status,
        updated_at = NOW()
      RETURNING id, order_id
    `, [
      orderId,
      firebaseUid,
      orderType || 'paid',
      status || 'pending',
      paypalOrderId,
      paypalCaptureId,
      paypalStatus,
      parseFloat(pricing?.subtotal || 0),
      parseFloat(pricing?.deliveryFee || 0),
      parseFloat(pricing?.total || 0),
      'GBP',
      stencilData?.numStencils || 0,
      JSON.stringify(stencilData || {}),
      JSON.stringify(stencilData?.storageUrls || []),
      JSON.stringify(stencilData?.layerColors || []),
      JSON.stringify(shippingAddress || null),
      orderType === 'free_signup' ? 'digital_only' : 'pending'
    ]);

    console.log('✅ Order saved to PostgreSQL:', result.rows[0]?.order_id);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Failed to save order to PostgreSQL:', error.message);
    // Don't throw - PostgreSQL failure shouldn't fail the order (Firebase is backup)
    return null;
  }
}

// Seller notification email config
const SELLER_EMAIL = process.env.SELLER_NOTIFICATION_EMAIL || 'orders@fotonix.co.uk';
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};

// Send order notification email to seller
async function sendOrderNotification(orderData) {
  try {
    if (!SMTP_CONFIG.auth.user || !SMTP_CONFIG.auth.pass) {
      console.warn('⚠️  SMTP not configured - skipping order notification email');
      return;
    }

    const transporter = nodemailer.createTransport(SMTP_CONFIG);
    
    const { orderId, shippingAddress, stencilData, paypalStatus } = orderData;
    
    // Build SVG download links
    const svgLinks = (stencilData.storageUrls || [])
      .map((url, i) => `<li><a href="${url.svgUrl}">Layer ${i + 1} SVG</a></li>`)
      .join('');
    
    const html = `
      <h2>🎨 New Stencil Order Received!</h2>
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>PayPal Status:</strong> ${paypalStatus}</p>
      <p><strong>Number of Stencils:</strong> ${stencilData.numStencils}</p>
      <p><strong>Original Image:</strong> ${stencilData.originalImageName || 'N/A'}</p>
      
      <h3>📦 Shipping Address</h3>
      <p>
        ${shippingAddress.name}<br>
        ${shippingAddress.addressLine1}<br>
        ${shippingAddress.addressLine2 ? shippingAddress.addressLine2 + '<br>' : ''}
        ${shippingAddress.city}<br>
        ${shippingAddress.postcode}<br>
        ${shippingAddress.country || 'GB'}<br>
        📞 ${shippingAddress.phone}
      </p>
      
      <h3>💰 Pricing</h3>
      <p>
        Subtotal: £${stencilData.pricing?.subtotal || 'N/A'}<br>
        Shipping: £${stencilData.pricing?.deliveryFee || 'N/A'}<br>
        <strong>Total: £${stencilData.pricing?.total || 'N/A'}</strong>
      </p>
      
      <h3>📥 Download SVG Files (for LightBurn)</h3>
      <ul>${svgLinks || '<li>No SVG files available</li>'}</ul>
      
      <hr>
      <p><small>View all orders in your <a href="http://localhost:3000/admin/orders">Admin Dashboard</a></small></p>
    `;

    await transporter.sendMail({
      from: `"Fotonix Orders" <${SMTP_CONFIG.auth.user}>`,
      to: SELLER_EMAIL,
      subject: `🎨 New Stencil Order: ${orderId} - ${stencilData.numStencils} layers`,
      html
    });

    console.log(`✅ Order notification email sent to ${SELLER_EMAIL}`);
  } catch (error) {
    console.error('❌ Failed to send order notification email:', error.message);
    // Don't throw - email failure shouldn't fail the order
  }
}

// Pricing tiers
const PRICING = {
  tier1: { max: 5, pricePerStencil: 4.00 },
  tier2: { min: 6, max: 14, pricePerStencil: 3.50 },
  tier3: { min: 15, pricePerStencil: 3.00 }
};

// Shipping zones and rates
const SHIPPING_ZONES = {
  uk: {
    baseFee: 4.95,
    freeThreshold: 25.00,
    name: 'United Kingdom'
  },
  eu: {
    baseFee: 12.95,
    freeThreshold: null, // No free shipping for EU
    name: 'Europe'
  },
  row: {
    baseFee: 18.95,
    freeThreshold: null, // No free shipping for Rest of World
    name: 'Rest of World'
  }
};

// Map country codes to shipping zones
const COUNTRY_ZONES = {
  'GB': 'uk',
  'IE': 'eu', 'FR': 'eu', 'DE': 'eu', 'ES': 'eu', 'IT': 'eu',
  'NL': 'eu', 'BE': 'eu', 'PT': 'eu', 'AT': 'eu', 'PL': 'eu',
  'SE': 'eu', 'DK': 'eu', 'FI': 'eu', 'GR': 'eu', 'CZ': 'eu',
  'HU': 'eu', 'RO': 'eu', 'BG': 'eu', 'SK': 'eu', 'HR': 'eu',
  'SI': 'eu', 'LT': 'eu', 'LV': 'eu', 'EE': 'eu', 'CY': 'eu',
  'LU': 'eu', 'MT': 'eu'
};

function getShippingZone(countryCode) {
  return COUNTRY_ZONES[countryCode] || 'row';
}

function calculatePrice(numStencils, countryCode = 'GB') {
  let pricePerStencil;
  if (numStencils <= PRICING.tier1.max) {
    pricePerStencil = PRICING.tier1.pricePerStencil;
  } else if (numStencils <= PRICING.tier2.max) {
    pricePerStencil = PRICING.tier2.pricePerStencil;
  } else {
    pricePerStencil = PRICING.tier3.pricePerStencil;
  }

  const subtotal = pricePerStencil * numStencils;
  
  // Get shipping zone and calculate delivery fee
  const zone = getShippingZone(countryCode);
  const shippingConfig = SHIPPING_ZONES[zone];
  
  let deliveryFee;
  if (shippingConfig.freeThreshold && subtotal >= shippingConfig.freeThreshold) {
    deliveryFee = 0;
  } else {
    deliveryFee = shippingConfig.baseFee;
  }
  
  const total = subtotal + deliveryFee;

  return {
    pricePerStencil,
    subtotal: subtotal.toFixed(2),
    deliveryFee: deliveryFee.toFixed(2),
    total: total.toFixed(2),
    shippingZone: zone,
    shippingZoneName: shippingConfig.name,
    freeShippingEligible: shippingConfig.freeThreshold !== null,
    freeShippingThreshold: shippingConfig.freeThreshold
  };
}

// Create stencil order
router.post('/api/stencil/create-order', async (req, res) => {
  try {
    const { numStencils, userId, countryCode } = req.body;

    if (!numStencils || numStencils < 1) {
      return res.status(400).json({ error: 'Invalid number of stencils' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const pricing = calculatePrice(numStencils, countryCode || 'GB');
    
    const client = getClient();
    const OrdersCreateRequest = require('@paypal/checkout-server-sdk').orders.OrdersCreateRequest;
    const request = new OrdersCreateRequest();
    
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        description: `${numStencils} Stencil Layer${numStencils > 1 ? 's' : ''}`,
        amount: {
          currency_code: 'GBP',
          value: pricing.total,
          breakdown: {
            item_total: { currency_code: 'GBP', value: pricing.subtotal },
            shipping: { currency_code: 'GBP', value: pricing.deliveryFee }
          }
        },
        items: [{
          name: 'Stencil Layer',
          unit_amount: { currency_code: 'GBP', value: pricing.pricePerStencil.toFixed(2) },
          quantity: numStencils.toString()
        }],
        custom_id: userId
      }]
    });

    const response = await client.execute(request);
    res.json({ 
      orderId: response.result.id,
      pricing
    });
  } catch (error) {
    console.error('Error creating stencil order:', error);
    res.status(500).json({ error: error.message });
  }
});

// Capture stencil order and save to Firebase
router.post('/api/stencil/capture-order', async (req, res) => {
  try {
    const { orderId, userId, stencilData, shippingAddress } = req.body;

    if (!orderId || !userId || !stencilData || !shippingAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Capture PayPal order
    const client = getClient();
    const OrdersCaptureRequest = require('@paypal/checkout-server-sdk').orders.OrdersCaptureRequest;
    const request = new OrdersCaptureRequest(orderId);
    request.prefer('return=representation');
    const captureResponse = await client.execute(request);

    if (captureResponse.result.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Save stencil data to Firebase RTDB
    const db = admin.database();
    const timestamp = Date.now();
    
    // Build the order data structure - matches what Dart/mobile app expects
    // Key fields: orderId, timestamp, paypalStatus, numStencils, pricing, storageUrls, metadata, paintingGuide
    const orderData = {
      orderId,
      timestamp,
      paypalStatus: captureResponse.result.status,
      numStencils: stencilData.numStencils || 0,
      pricing: stencilData.pricing || { total: '0.00', subtotal: '0.00', deliveryFee: '0.00' },
      storageUrls: stencilData.storageUrls || [],
      metadata: {
        layerMode: stencilData.layerMode || 'discrete',
        thresholdMethod: stencilData.thresholdMethod || 'uniform',
        originalImageName: stencilData.originalImageName || '',
        originalImageUrl: stencilData.originalImageUrl || null,
        stencilMode: stencilData.stencilMode || 'standard',
        bridgeWidth: stencilData.bridgeWidth || 3,
        halftoneSettings: stencilData.halftoneSettings || null,
        registrationMarks: stencilData.registrationMarks || false
      },
      paintingGuide: {
        layerColors: stencilData.layerColors || [],
        totalLayers: stencilData.numStencils || 0,
        instructions: 'Use the Fotonix companion app to view your color placement guide'
      }
    };

    console.log('=== SAVING PAID ORDER TO FIREBASE ===');
    console.log('Path: users/' + userId + '/stencilOrders/' + orderId);
    console.log('Order data keys:', Object.keys(orderData));

    // Save to user's orders (for customer access)
    const userOrderRef = db.ref(`users/${userId}/stencilOrders/${orderId}`);
    await userOrderRef.set(orderData);

    // Save to madeOrders (for seller fulfillment)
    const madeOrderRef = db.ref(`madeOrders/${orderId}`);
    await madeOrderRef.set({
      orderId,
      userId,
      createdAt: timestamp,
      paypalOrderId: orderId,
      paypalCaptureId: captureResponse.result.id,
      paypalStatus: captureResponse.result.status,
      shippingAddress: {
        name: shippingAddress.name,
        addressLine1: shippingAddress.addressLine1,
        addressLine2: shippingAddress.addressLine2 || '',
        city: shippingAddress.city,
        postcode: shippingAddress.postcode,
        country: shippingAddress.country || 'GB',
        phone: shippingAddress.phone
      },
      stencilData: {
        numStencils: stencilData.numStencils,
        pricing: stencilData.pricing,
        storageUrls: stencilData.storageUrls || [],
        layerMode: stencilData.layerMode,
        thresholdMethod: stencilData.thresholdMethod,
        originalImageName: stencilData.originalImageName,
        stencilMode: stencilData.stencilMode || 'standard',
        bridgeWidth: stencilData.bridgeWidth,
        halftoneSettings: stencilData.halftoneSettings || null,
        registrationMarks: stencilData.registrationMarks,
        layerColors: stencilData.layerColors || []
      },
      fulfillmentStatus: 'pending' // Can be updated to 'processing', 'shipped', 'delivered'
    });

    // Save to PostgreSQL (unified data store - single source of truth)
    await saveOrderToPostgres({
      orderId,
      firebaseUid: userId,
      orderType: 'paid',
      status: 'paid',
      paypalOrderId: orderId,
      paypalCaptureId: captureResponse.result.id,
      paypalStatus: captureResponse.result.status,
      pricing: stencilData.pricing,
      stencilData,
      shippingAddress: {
        name: shippingAddress.name,
        addressLine1: shippingAddress.addressLine1,
        addressLine2: shippingAddress.addressLine2 || '',
        city: shippingAddress.city,
        postcode: shippingAddress.postcode,
        country: shippingAddress.country || 'GB',
        phone: shippingAddress.phone
      }
    });

    // Send notification email to seller (async, don't wait)
    sendOrderNotification({
      orderId,
      shippingAddress: { ...shippingAddress, country: shippingAddress.country || 'GB' },
      stencilData,
      paypalStatus: captureResponse.result.status
    });

    res.json({ 
      success: true, 
      orderId,
      captureId: captureResponse.result.id 
    });
  } catch (error) {
    console.error('Error capturing stencil order:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get pricing information
router.get('/api/stencil/pricing', (req, res) => {
  const numStencils = parseInt(req.query.numStencils) || 1;
  const countryCode = req.query.countryCode || 'GB';
  const pricing = calculatePrice(numStencils, countryCode);
  res.json(pricing);
});

// Test capture (developer helper) - write order directly to RTDB without capturing via PayPal
router.post('/api/stencil/test-capture', async (req, res) => {
  try {
    const { orderId: providedOrderId, userId, stencilData, shippingAddress } = req.body;

    // Debug: log what we received
    console.log('=== TEST-CAPTURE RECEIVED ===');
    console.log('userId:', userId);
    console.log('orderId:', providedOrderId);
    console.log('numStencils:', stencilData?.numStencils);
    console.log('layerColors count:', stencilData?.layerColors?.length || 0);
    console.log('storageUrls count:', stencilData?.storageUrls?.length || 0);
    console.log('originalImageUrl:', stencilData?.originalImageUrl);
    console.log('stencilSize:', stencilData?.stencilSize);
    console.log('stencilSizeOption:', stencilData?.stencilSizeOption);
    console.log('pricing:', JSON.stringify(stencilData?.pricing));

    if (!userId || !stencilData || !shippingAddress) {
      console.error('Missing fields - userId:', !!userId, 'stencilData:', !!stencilData, 'shippingAddress:', !!shippingAddress);
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = admin.database();
    const timestamp = Date.now();
    const orderId = providedOrderId || `TEST-${timestamp}`;

    // Build the order data structure - matches what Dart/mobile app expects
    // Key fields: orderId, timestamp, paypalStatus, numStencils, pricing, storageUrls, metadata, paintingGuide
    const orderData = {
      orderId,
      timestamp,
      status: 'paid',
      paypalStatus: 'TEST',
      numStencils: stencilData.numStencils || 0,
      pricing: stencilData.pricing || { total: '0.00', subtotal: '0.00', deliveryFee: '0.00' },
      storageUrls: stencilData.storageUrls || [],
      metadata: {
        layerMode: stencilData.layerMode || 'discrete',
        thresholdMethod: stencilData.thresholdMethod || 'uniform',
        originalImageName: stencilData.originalImageName || '',
        originalImageUrl: stencilData.originalImageUrl || null,
        stencilMode: stencilData.stencilMode || 'standard',
        stencilSize: stencilData.stencilSize || null,
        stencilSizeOption: stencilData.stencilSizeOption || null,
        bridgeWidth: stencilData.bridgeWidth || 3,
        halftoneSettings: stencilData.halftoneSettings || null,
        registrationMarks: stencilData.registrationMarks || false
      },
      paintingGuide: {
        layerColors: stencilData.layerColors || [],
        totalLayers: stencilData.numStencils || 0,
        instructions: 'Use the Fotonix companion app to view your color placement guide'
      },
      shippingAddress: {
        name: shippingAddress.name || '',
        addressLine1: shippingAddress.addressLine1 || '',
        addressLine2: shippingAddress.addressLine2 || '',
        city: shippingAddress.city || '',
        postcode: shippingAddress.postcode || '',
        phone: shippingAddress.phone || '',
        country: shippingAddress.country || 'GB'
      }
    };

    // Log the complete order data being saved
    console.log('=== SAVING ORDER TO FIREBASE ===');
    console.log('Path: users/' + userId + '/stencilOrders/' + orderId);
    console.log('Order data keys:', Object.keys(orderData));
    console.log('layerColors sample:', JSON.stringify(orderData.paintingGuide.layerColors.slice(0, 2)));

    // Save to user's orders (for customer access)
    const userOrderRef = db.ref(`users/${userId}/stencilOrders/${orderId}`);
    await userOrderRef.set(orderData);

    // Save to madeOrders (for seller fulfillment)
    const madeOrderRef = db.ref(`madeOrders/${orderId}`);
    await madeOrderRef.set({
      orderId,
      userId,
      createdAt: timestamp,
      paypalOrderId: orderId,
      paypalCaptureId: null,
      paypalStatus: 'TEST',
      shippingAddress: {
        name: shippingAddress.name,
        addressLine1: shippingAddress.addressLine1,
        addressLine2: shippingAddress.addressLine2 || '',
        city: shippingAddress.city,
        postcode: shippingAddress.postcode,
        phone: shippingAddress.phone
      },
      stencilData: {
        numStencils: stencilData.numStencils,
        pricing: stencilData.pricing,
        storageUrls: stencilData.storageUrls || [],
        originalImageUrl: stencilData.originalImageUrl || null,
        layerMode: stencilData.layerMode,
        thresholdMethod: stencilData.thresholdMethod,
        originalImageName: stencilData.originalImageName,
        stencilMode: stencilData.stencilMode || 'standard',
        stencilSize: stencilData.stencilSize,
        stencilSizeOption: stencilData.stencilSizeOption || null,
        bridgeWidth: stencilData.bridgeWidth,
        halftoneSettings: stencilData.halftoneSettings || null,
        registrationMarks: stencilData.registrationMarks,
        layerColors: stencilData.layerColors || []
      },
      fulfillmentStatus: 'pending_test'
    });

    // Send notification email to seller (async, don't wait) - even for test orders
    sendOrderNotification({
      orderId,
      shippingAddress: { ...shippingAddress, country: shippingAddress.country || 'GB' },
      stencilData,
      paypalStatus: 'TEST'
    });

    res.json({ success: true, orderId });
  } catch (error) {
    console.error('Error in test-capture:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download proxy endpoint - fetches Firebase Storage files and serves with download headers
router.get('/api/stencil/download-proxy', async (req, res) => {
  try {
    const { url, filename } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Only allow Firebase Storage URLs for security (supports both old and new domain formats)
    if (!url.includes('firebasestorage.googleapis.com') && 
        !url.includes('storage.googleapis.com') && 
        !url.includes('.firebasestorage.app')) {
      return res.status(403).json({ error: 'Only Firebase Storage URLs are allowed' });
    }
    
    // Fetch the file using the globally required node-fetch
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch file' });
    }
    
    // Get content type from response
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Set headers for download
    const downloadFilename = filename || 'download';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    // Pipe the response
    const buffer = await response.buffer();
    res.send(buffer);
    
  } catch (error) {
    console.error('Download proxy error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Free signup handler - creates order for free and captures lead for email campaigns
router.post('/api/stencil/free-signup', async (req, res) => {
  try {
    const { orderId, userId, stencilData, email, source } = req.body;

    console.log('=== FREE SIGNUP RECEIVED ===');
    console.log('userId:', userId);
    console.log('email:', email);
    console.log('orderId:', orderId);
    console.log('numStencils:', stencilData?.numStencils);

    if (!userId || !stencilData || !email) {
      console.error('Missing fields - userId:', !!userId, 'stencilData:', !!stencilData, 'email:', !!email);
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = admin.database();
    const timestamp = Date.now();
    const finalOrderId = orderId || `FREE-${timestamp}`;

    // Build the order data structure - same as paid but marked as free_lead
    const orderData = {
      orderId: finalOrderId,
      timestamp,
      status: 'free_lead',
      paypalStatus: 'FREE',
      numStencils: stencilData.numStencils || 0,
      pricing: { total: '0.00', subtotal: '0.00', deliveryFee: '0.00' },
      storageUrls: stencilData.storageUrls || [],
      metadata: {
        layerMode: stencilData.layerMode || 'discrete',
        thresholdMethod: stencilData.thresholdMethod || 'uniform',
        originalImageName: stencilData.originalImageName || '',
        originalImageUrl: stencilData.originalImageUrl || null,
        stencilMode: stencilData.stencilMode || 'standard',
        stencilSize: stencilData.stencilSize || null,
        stencilSizeOption: stencilData.stencilSizeOption || null,
        bridgeWidth: stencilData.bridgeWidth || 3,
        halftoneSettings: stencilData.halftoneSettings || null,
        registrationMarks: stencilData.registrationMarks || false,
        isFreeSignup: true
      },
      paintingGuide: {
        layerColors: stencilData.layerColors || [],
        totalLayers: stencilData.numStencils || 0,
        instructions: 'Use the Fotonix companion app to view your color placement guide'
      }
    };

    console.log('=== SAVING FREE SIGNUP ORDER TO FIREBASE ===');
    console.log('Path: users/' + userId + '/stencilOrders/' + finalOrderId);

    // Save to user's orders (for customer access in app)
    const userOrderRef = db.ref(`users/${userId}/stencilOrders/${finalOrderId}`);
    await userOrderRef.set(orderData);

    // Save to stencilLeads for email campaigns
    const leadRef = db.ref(`stencilLeads/${userId}`);
    await leadRef.set({
      email,
      userId,
      source: source || 'stencil-generator-free-signup',
      createdAt: timestamp,
      numStencils: stencilData.numStencils || 0,
      stencilMode: stencilData.stencilMode || 'standard',
      hasConverted: false, // Track if they later purchase
      emailVerified: false,
      subscribed: true, // Opted in for marketing
      tags: ['free-stencil-signup', 'stencil-generator']
    });

    // Also save to madeOrders for tracking (but with free status)
    const madeOrderRef = db.ref(`madeOrders/${finalOrderId}`);
    await madeOrderRef.set({
      orderId: finalOrderId,
      userId,
      email,
      createdAt: timestamp,
      paypalOrderId: null,
      paypalCaptureId: null,
      paypalStatus: 'FREE',
      shippingAddress: null,
      stencilData: {
        numStencils: stencilData.numStencils,
        pricing: { total: '0.00', subtotal: '0.00', deliveryFee: '0.00' },
        storageUrls: stencilData.storageUrls || [],
        originalImageUrl: stencilData.originalImageUrl || null,
        layerMode: stencilData.layerMode,
        thresholdMethod: stencilData.thresholdMethod,
        originalImageName: stencilData.originalImageName,
        stencilMode: stencilData.stencilMode || 'standard',
        stencilSize: stencilData.stencilSize,
        stencilSizeOption: stencilData.stencilSizeOption || null,
        bridgeWidth: stencilData.bridgeWidth,
        halftoneSettings: stencilData.halftoneSettings || null,
        registrationMarks: stencilData.registrationMarks,
        layerColors: stencilData.layerColors || []
      },
      fulfillmentStatus: 'digital_only',
      isFreeSignup: true
    });

    // Save to PostgreSQL (unified data store - single source of truth)
    await saveOrderToPostgres({
      orderId: finalOrderId,
      firebaseUid: userId,
      orderType: 'free_signup',
      status: 'free_lead',
      paypalOrderId: null,
      paypalCaptureId: null,
      paypalStatus: 'FREE',
      pricing: { total: '0.00', subtotal: '0.00', deliveryFee: '0.00' },
      stencilData,
      shippingAddress: null
    });

    // Send welcome email to the new user (async, don't wait)
    try {
      if (SMTP_CONFIG.auth.user && SMTP_CONFIG.auth.pass) {
        const transporter = nodemailer.createTransport(SMTP_CONFIG);
        
        await transporter.sendMail({
          from: `"Fotonix Stencils" <${SMTP_CONFIG.auth.user}>`,
          to: email,
          subject: '🎨 Your Free Stencils Are Ready!',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #7c3aed;">Welcome to Fotonix! 🎉</h1>
              <p>Your ${stencilData.numStencils || 0} stencil layer${(stencilData.numStencils || 0) > 1 ? 's are' : ' is'} now available in your account!</p>
              
              <div style="background: linear-gradient(135deg, #7c3aed, #ec4899); padding: 20px; border-radius: 12px; margin: 20px 0;">
                <h2 style="color: white; margin: 0 0 10px 0;">📱 Download the Fotonix App</h2>
                <p style="color: rgba(255,255,255,0.9); margin: 0;">View your stencils with our color placement guide for perfect results every time.</p>
              </div>
              
              <h3>What's Next?</h3>
              <ul>
                <li><strong>View in app:</strong> Open the Fotonix app and log in with this email</li>
                <li><strong>Download PNGs:</strong> Access your digital files anytime from your orders</li>
                <li><strong>Order physical stencils:</strong> Want laser-cut mylar stencils shipped to you? Visit fotonix.co.uk</li>
              </ul>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                Questions? Reply to this email or contact us at support@fotonix.co.uk
              </p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
              <p style="color: #999; font-size: 12px;">
                You received this email because you created a free account on Fotonix. 
                <a href="https://fotonix.co.uk/unsubscribe?email=${encodeURIComponent(email)}" style="color: #999;">Unsubscribe</a>
              </p>
            </div>
          `
        });
        console.log('✅ Welcome email sent to:', email);
      }
    } catch (emailError) {
      console.warn('⚠️ Failed to send welcome email:', emailError.message);
      // Don't fail the request if email fails
    }

    console.log('✅ Free signup completed for:', email);
    res.json({ success: true, orderId: finalOrderId });

  } catch (error) {
    console.error('Error in free-signup:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
