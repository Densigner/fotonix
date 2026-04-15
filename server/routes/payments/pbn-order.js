const express = require('express');
const router = express.Router();
const { getClient } = require('../../paypal');
const admin = require('../../firebase-admin');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const { addCustomerToContacts } = require('../../utils/addCustomerContact');

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

pool.query('SELECT 1').then(() => {
  console.log('✅ PBN order routes: PostgreSQL connected');
}).catch(err => {
  console.error('❌ PBN order routes: PostgreSQL connection failed:', err.message);
});

// Seller notification email config
const SELLER_EMAIL = process.env.SELLER_NOTIFICATION_EMAIL || 'orders@fotonix.co.uk';
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || process.env.MAIL_HOST || 'mail.fotonix.co.uk',
  port: parseInt(process.env.SMTP_PORT || process.env.MAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || process.env.MAIL_USERNAME,
    pass: process.env.SMTP_PASS || process.env.MAIL_PASSWORD
  }
};

// PBN product pricing (matches frontend CANVAS_SIZES / PAPER_SIZES)
const PBN_PRODUCTS = {
  // Canvas
  '20x20': { label: 'Small Canvas 20×20 cm', price: 17.99 },
  '20x30': { label: 'Small Rectangle Canvas 20×30 cm', price: 21.99 },
  '30x40': { label: 'Medium Canvas 30×40 cm', price: 25.99 },
  // Paper
  'a4': { label: 'A4 Paper 21×29.7 cm', price: 12.99 },
  'a3': { label: 'A3 Paper 29.7×42 cm', price: 16.99 },
};

// Shipping zones
const SHIPPING_ZONES = {
  uk:  { baseFee: 0, freeThreshold: 0, name: 'United Kingdom' },
  eu:  { baseFee: 12.95, freeThreshold: null, name: 'Europe' },
  row: { baseFee: 18.95, freeThreshold: null, name: 'Rest of World' },
};

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

function calculatePbnPrice(productKey, countryCode = 'GB') {
  const product = PBN_PRODUCTS[productKey];
  if (!product) return null;

  const subtotal = product.price;
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
    productKey,
    productLabel: product.label,
    subtotal: subtotal.toFixed(2),
    deliveryFee: deliveryFee.toFixed(2),
    total: total.toFixed(2),
    shippingZone: zone,
    shippingZoneName: shippingConfig.name,
  };
}

// Save PBN order to PostgreSQL
async function savePbnOrderToPostgres(orderData) {
  try {
    const {
      orderId, firebaseUid, orderType, status,
      paypalOrderId, paypalCaptureId, paypalStatus,
      pricing, pbnData, shippingAddress
    } = orderData;

    const result = await pool.query(`
      INSERT INTO pbn_orders (
        order_id, firebase_uid, order_type, status,
        paypal_order_id, paypal_capture_id, paypal_status,
        subtotal, delivery_fee, total, currency,
        product_key, material_type, pbn_data, storage_urls,
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
      pbnData?.productKey || '',
      pbnData?.materialType || '',
      JSON.stringify(pbnData || {}),
      JSON.stringify(pbnData?.storageUrls || []),
      JSON.stringify(shippingAddress || null),
      'pending'
    ]);

    console.log('✅ PBN order saved to PostgreSQL:', result.rows[0]?.order_id);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Failed to save PBN order to PostgreSQL:', error.message);
    return null;
  }
}

// Send PBN order notification email
async function sendPbnOrderNotification(orderData) {
  try {
    if (!SMTP_CONFIG.auth.user || !SMTP_CONFIG.auth.pass) {
      console.warn('⚠️  SMTP not configured - skipping PBN order notification');
      return;
    }

    const transporter = nodemailer.createTransport(SMTP_CONFIG);
    const { orderId, shippingAddress, pbnData, paypalStatus } = orderData;

    const FILE_LABELS = {
      'svg': '🖌️ Coloured SVG (fills + numbers)',
      'hd-png': '🖼️ HD Mockup PNG (colour reference)',
      'outline-svg': '📄 Outline SVG (print-ready, no fills)',
      'palette-svg': '🎨 Colour Palette Key'
    };

    const downloadLinks = (pbnData.storageUrls || [])
      .map(f => `<li style="margin:4px 0"><a href="${f.url}" style="color:#7c3aed">${FILE_LABELS[f.type] || f.type}</a></li>`)
      .join('');

    const originalLink = pbnData.originalImageUrl
      ? `<li style="margin:4px 0"><a href="${pbnData.originalImageUrl}" style="color:#7c3aed">📷 Original Customer Photo</a></li>`
      : '';

    const paletteCount = pbnData.paletteColours || pbnData.numColors || '—';

    const html = `
      <h2>🎨 New Paint-By-Numbers Order!</h2>
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>PayPal Status:</strong> ${paypalStatus}</p>
      <p><strong>Product:</strong> ${pbnData.productLabel || pbnData.productKey}</p>
      <p><strong>Material:</strong> ${pbnData.materialType}</p>
      <p><strong>Size:</strong> ${pbnData.selectedSize}</p>
      <p><strong>Palette:</strong> ${paletteCount} colours, ${pbnData.regionCount || '—'} regions</p>
      
      <h3>📦 Shipping Address</h3>
      <p>
        ${shippingAddress.name}<br>
        ${shippingAddress.addressLine1}<br>
        ${shippingAddress.addressLine2 ? shippingAddress.addressLine2 + '<br>' : ''}
        ${shippingAddress.city}<br>
        ${shippingAddress.postcode}<br>
        ${shippingAddress.country || 'GB'}<br>
        📞 ${shippingAddress.phone}<br>
        ✉️ ${shippingAddress.email || 'N/A'}
      </p>
      
      <h3>💰 Pricing</h3>
      <p>
        Subtotal: £${pbnData.pricing?.subtotal || 'N/A'}<br>
        Shipping: £${pbnData.pricing?.deliveryFee || 'N/A'}<br>
        <strong>Total: £${pbnData.pricing?.total || 'N/A'}</strong>
      </p>
      
      <h3>📥 Download Files (for printing)</h3>
      <ul style="list-style:none;padding:0">
        ${originalLink}
        ${downloadLinks || '<li>No files uploaded yet</li>'}
      </ul>
    `;

    await transporter.sendMail({
      from: `"Fotonix Orders" <${SMTP_CONFIG.auth.user}>`,
      to: SELLER_EMAIL,
      subject: `🎨 New PBN Order: ${orderId} - ${pbnData.productLabel || pbnData.productKey}`,
      html
    });

    console.log(`✅ PBN order notification email sent to ${SELLER_EMAIL}`);
  } catch (error) {
    console.error('❌ Failed to send PBN order notification:', error.message);
  }
}

// ─── Customer Order Confirmation Email ──────────────────────────────────
async function sendPbnCustomerConfirmation(orderData) {
  try {
    if (!SMTP_CONFIG.auth.user || !SMTP_CONFIG.auth.pass) {
      console.warn('⚠️  SMTP not configured — skipping customer confirmation');
      return;
    }

    const { orderId, shippingAddress, pbnData } = orderData;
    const customerEmail = shippingAddress?.email;
    if (!customerEmail) {
      console.warn('⚠️  No customer email — skipping confirmation');
      return;
    }

    const transporter = nodemailer.createTransport(SMTP_CONFIG);

    // Find the original image URL from storageUrls or the dedicated field
    const originalUrl = pbnData.originalImageUrl
      || (pbnData.storageUrls || []).find(u => u.type === 'original')?.url
      || null;

    // Find the coloured mockup (HD PNG preview of the paint-by-numbers design)
    const mockupUrl = (pbnData.storageUrls || []).find(u => u.type === 'hd-png')?.url || null;

    const paletteCount = pbnData.paletteColours || pbnData.numColors || '—';
    const regionCount = pbnData.regionCount || '—';
    const isUK = (shippingAddress.country || 'GB') === 'GB';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:32px 40px;text-align:center">
            <h1 style="margin:0;color:#fff;font-size:24px">🎨 Order Confirmed!</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px">Your custom paint-by-numbers kit is being prepared</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px">
            <p style="margin:0 0 16px;font-size:16px;color:#333">Hi ${shippingAddress.name || 'there'},</p>
            <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6">
              Thank you for your order! We've received your payment and your custom paint-by-numbers kit is now being prepared. Here's a summary of your order:
            </p>

            <!-- Order Summary Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px">
              <tr>
                <td style="padding:20px">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:4px 0;font-size:13px;color:#888">Order ID</td>
                      <td style="padding:4px 0;font-size:13px;color:#333;text-align:right;font-weight:600">${orderId}</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;font-size:13px;color:#888">Product</td>
                      <td style="padding:4px 0;font-size:13px;color:#333;text-align:right;font-weight:600">${pbnData.productLabel || pbnData.productKey}</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;font-size:13px;color:#888">Material</td>
                      <td style="padding:4px 0;font-size:13px;color:#333;text-align:right;font-weight:600">${pbnData.materialType || 'Canvas'}</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;font-size:13px;color:#888">Colours</td>
                      <td style="padding:4px 0;font-size:13px;color:#333;text-align:right;font-weight:600">${paletteCount} colours · ${regionCount} regions</td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding:12px 0 4px;border-top:1px solid #e5e7eb"></td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;font-size:13px;color:#888">Subtotal</td>
                      <td style="padding:4px 0;font-size:13px;color:#333;text-align:right">£${pbnData.pricing?.subtotal || '—'}</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;font-size:13px;color:#888">Delivery</td>
                      <td style="padding:4px 0;font-size:13px;color:#333;text-align:right">${isUK ? 'FREE 🎉' : '£' + (pbnData.pricing?.deliveryFee || '4.95')}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0 0;font-size:15px;color:#333;font-weight:700">Total</td>
                      <td style="padding:8px 0 0;font-size:15px;color:#7c3aed;text-align:right;font-weight:700">£${pbnData.pricing?.total || '—'}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            ${originalUrl ? `
            <!-- Original Image -->
            <div style="margin-bottom:24px">
              <p style="margin:0 0 8px;font-size:13px;color:#888;font-weight:600">YOUR ORIGINAL IMAGE</p>
              <a href="${originalUrl}" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none">
                <img src="${originalUrl}" alt="Your uploaded photo" style="width:100%;max-width:400px;border-radius:8px;border:1px solid #e5e7eb" />
              </a>
              <p style="margin:8px 0 0;font-size:12px;color:#888">
                <a href="${originalUrl}" style="color:#7c3aed;text-decoration:underline">View full-size original image →</a>
              </p>
            </div>
            ` : ''}

            ${mockupUrl ? `
            <!-- Paint-By-Numbers Mockup -->
            <div style="margin-bottom:24px">
              <p style="margin:0 0 8px;font-size:13px;color:#888;font-weight:600">YOUR PAINT-BY-NUMBERS PREVIEW</p>
              <a href="${mockupUrl}" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none">
                <img src="${mockupUrl}" alt="Paint-by-numbers colour preview" style="width:100%;max-width:400px;border-radius:8px;border:1px solid #e5e7eb" />
              </a>
              <p style="margin:8px 0 0;font-size:12px;color:#888">
                This is what your finished painting will look like — use it as a reference while painting.
                <br><a href="${mockupUrl}" style="color:#7c3aed;text-decoration:underline">View full-size preview →</a>
              </p>
            </div>
            ` : ''}

            <!-- Delivery Info -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:24px">
              <tr>
                <td style="padding:16px 20px">
                  <p style="margin:0;font-size:14px;color:#166534;font-weight:600">📦 Delivery Address</p>
                  <p style="margin:8px 0 0;font-size:13px;color:#333;line-height:1.6">
                    ${shippingAddress.name}<br>
                    ${shippingAddress.addressLine1}<br>
                    ${shippingAddress.addressLine2 ? shippingAddress.addressLine2 + '<br>' : ''}
                    ${shippingAddress.city}, ${shippingAddress.postcode}<br>
                    ${shippingAddress.country || 'GB'}
                  </p>
                </td>
              </tr>
            </table>

            <!-- What Happens Next -->
            <div style="margin-bottom:24px">
              <p style="margin:0 0 12px;font-size:14px;color:#333;font-weight:600">What happens next?</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#555;line-height:1.5">
                    <strong>1.</strong> We print your custom design onto ${(pbnData.materialType || 'canvas').toLowerCase()} with numbered regions and boundary lines
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#555;line-height:1.5">
                    <strong>2.</strong> Your colour key with ${paletteCount} matched paint colours is prepared
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#555;line-height:1.5">
                    <strong>3.</strong> Everything is carefully packed and dispatched
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#555;line-height:1.5">
                    <strong>4.</strong> You'll receive a shipping confirmation email with tracking details once dispatched
                  </td>
                </tr>
              </table>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center">
            <p style="margin:0 0 8px;font-size:12px;color:#888">Questions about your order?</p>
            <p style="margin:0;font-size:12px;color:#888">
              Reply to this email or contact us at
              <a href="mailto:support@fotonix.co.uk" style="color:#7c3aed;text-decoration:none">support@fotonix.co.uk</a>
            </p>
            <p style="margin:16px 0 0;font-size:11px;color:#aaa">© ${new Date().getFullYear()} Fotonix · fotonix.co.uk</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
      from: `"Fotonix" <${process.env.SMTP_FROM || 'noreply@fotonix.co.uk'}>`,
      to: customerEmail,
      subject: `🎨 Order Confirmed — Your Paint-By-Numbers Kit #${orderId}`,
      html,
      text: `Order Confirmed — Paint-By-Numbers Kit\n\nHi ${shippingAddress.name || 'there'},\n\nThank you for your order (#${orderId})! Your custom ${pbnData.productLabel || 'paint-by-numbers kit'} with ${paletteCount} colours is being prepared.\n\nTotal: £${pbnData.pricing?.total || '—'}\n\n${originalUrl ? 'Your original image: ' + originalUrl + '\n' : ''}${mockupUrl ? 'Your paint-by-numbers preview: ' + mockupUrl + '\n' : ''}\nYou'll receive a shipping confirmation with tracking details once your kit is dispatched.\n\nThanks,\nFotonix`
    });

    console.log(`✅ PBN customer confirmation sent to ${customerEmail}`);
  } catch (error) {
    console.error('❌ Failed to send customer confirmation:', error.message);
  }
}

// ─── GET /api/pbn/pricing ──────────────────────────────────────────────
router.get('/api/pbn/pricing', (req, res) => {
  const productKey = req.query.productKey || '20x20';
  const countryCode = req.query.countryCode || 'GB';

  const pricing = calculatePbnPrice(productKey, countryCode);
  if (!pricing) {
    return res.status(400).json({ error: 'Invalid product key' });
  }
  res.json(pricing);
});

// ─── POST /api/pbn/create-order ────────────────────────────────────────
router.post('/api/pbn/create-order', async (req, res) => {
  try {
    console.log('📦 PBN create-order body:', JSON.stringify(req.body));
    const { productKey, materialType, userId, email, countryCode } = req.body;

    if (!productKey || !PBN_PRODUCTS[productKey]) {
      console.error('❌ Invalid product. productKey:', productKey, 'Available:', Object.keys(PBN_PRODUCTS));
      return res.status(400).json({ error: 'Invalid product' });
    }
    if (!email) {
      console.error('❌ Missing email');
      return res.status(400).json({ error: 'Email address required' });
    }

    const pricing = calculatePbnPrice(productKey, countryCode || 'GB');
    const product = PBN_PRODUCTS[productKey];

    const client = getClient();
    const OrdersCreateRequest = require('@paypal/checkout-server-sdk').orders.OrdersCreateRequest;
    const request = new OrdersCreateRequest();

    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        description: `PaintYourPhoto – ${product.label}`,
        amount: {
          currency_code: 'GBP',
          value: pricing.total,
          breakdown: {
            item_total: { currency_code: 'GBP', value: pricing.subtotal },
            shipping: { currency_code: 'GBP', value: pricing.deliveryFee }
          }
        },
        items: [{
          name: `PaintYourPhoto ${product.label}`,
          unit_amount: { currency_code: 'GBP', value: pricing.subtotal },
          quantity: '1'
        }],
        custom_id: userId || email
      }]
    });

    const response = await client.execute(request);
    res.json({
      orderId: response.result.id,
      pricing
    });
  } catch (error) {
    console.error('Error creating PBN order:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/pbn/capture-order ───────────────────────────────────────
router.post('/api/pbn/capture-order', async (req, res) => {
  try {
    const { orderId, userId, email, shippingAddress, pbnData } = req.body;

    if (!orderId || !pbnData || !shippingAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const customerEmail = email || shippingAddress?.email || null;

    // Capture PayPal payment
    const client = getClient();
    const OrdersCaptureRequest = require('@paypal/checkout-server-sdk').orders.OrdersCaptureRequest;
    const request = new OrdersCaptureRequest(orderId);
    request.prefer('return=representation');
    const captureResponse = await client.execute(request);

    if (captureResponse.result.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Save to Firebase RTDB
    const db = admin.database();
    const timestamp = Date.now();

    const orderDataForUser = {
      orderId,
      timestamp,
      orderType: 'pbn',
      paypalStatus: captureResponse.result.status,
      productKey: pbnData.productKey,
      productLabel: pbnData.productLabel,
      materialType: pbnData.materialType,
      selectedSize: pbnData.selectedSize,
      pricing: pbnData.pricing || { total: '0.00', subtotal: '0.00', deliveryFee: '0.00' },
      storageUrls: pbnData.storageUrls || [],
      metadata: {
        numColors: pbnData.numColors,
        detailLevel: pbnData.detailLevel,
        regionCount: pbnData.regionCount,
        analysisWidth: pbnData.analysisWidth,
        analysisHeight: pbnData.analysisHeight,
        originalImageUrl: pbnData.originalImageUrl || null,
      },
    };

    // Save to user's orders (if logged in)
    if (userId) {
      const userOrderRef = db.ref(`users/${userId}/pbnOrders/${orderId}`);
      await userOrderRef.set(orderDataForUser);
    }

    // Save to madeOrders for fulfillment
    const madeOrderRef = db.ref(`madeOrders/${orderId}`);
    await madeOrderRef.set({
      orderId,
      userId: userId || null,
      customerEmail: customerEmail,
      createdAt: timestamp,
      orderType: 'pbn',
      paypalOrderId: orderId,
      paypalCaptureId: captureResponse.result.id,
      paypalStatus: captureResponse.result.status,
      shippingAddress: {
        email: customerEmail,
        name: shippingAddress.name,
        addressLine1: shippingAddress.addressLine1,
        addressLine2: shippingAddress.addressLine2 || '',
        city: shippingAddress.city,
        postcode: shippingAddress.postcode,
        country: shippingAddress.country || 'GB',
        phone: shippingAddress.phone
      },
      pbnData: {
        productKey: pbnData.productKey,
        productLabel: pbnData.productLabel,
        materialType: pbnData.materialType,
        selectedSize: pbnData.selectedSize,
        pricing: pbnData.pricing,
        storageUrls: pbnData.storageUrls || [],
        numColors: pbnData.numColors,
        detailLevel: pbnData.detailLevel,
        regionCount: pbnData.regionCount,
        paletteData: pbnData.paletteData || [],
      },
      fulfillmentStatus: 'pending'
    });

    // Save to PostgreSQL
    await savePbnOrderToPostgres({
      orderId,
      firebaseUid: userId || null,
      customerEmail: customerEmail,
      orderType: 'paid',
      status: 'paid',
      paypalOrderId: orderId,
      paypalCaptureId: captureResponse.result.id,
      paypalStatus: captureResponse.result.status,
      pricing: pbnData.pricing,
      pbnData,
      shippingAddress
    });

    // Send notification email (fire-and-forget)
    sendPbnOrderNotification({
      orderId,
      shippingAddress,
      pbnData,
      paypalStatus: captureResponse.result.status
    });

    // Send customer confirmation email (fire-and-forget)
    sendPbnCustomerConfirmation({
      orderId,
      shippingAddress,
      pbnData
    });

    // Add customer to "customers" contact group (fire-and-forget)
    if (customerEmail) {
      addCustomerToContacts({
        email: customerEmail,
        firstName: shippingAddress?.name?.split(' ')[0] || '',
        lastName: shippingAddress?.name?.split(' ').slice(1).join(' ') || '',
        source: 'pbn_order',
        orderId
      }).catch(() => {});
    }

    res.json({
      success: true,
      orderId,
      captureId: captureResponse.result.id
    });
  } catch (error) {
    console.error('Error capturing PBN order:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/pbn/test-capture (Fake Pay for development) ────────────
router.post('/api/pbn/test-capture', async (req, res) => {
  try {
    const { orderId, userId, email, shippingAddress, pbnData } = req.body;

    if (!orderId || !pbnData || !shippingAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const customerEmail = email || shippingAddress?.email || null;

    // Save to Firebase RTDB (same structure as real capture, no PayPal call)
    const db = admin.database();
    const timestamp = Date.now();

    const orderDataForUser = {
      orderId,
      timestamp,
      orderType: 'pbn',
      paypalStatus: 'TEST',
      productKey: pbnData.productKey,
      productLabel: pbnData.productLabel,
      materialType: pbnData.materialType,
      selectedSize: pbnData.selectedSize,
      pricing: pbnData.pricing || { total: '0.00', subtotal: '0.00', deliveryFee: '0.00' },
      storageUrls: pbnData.storageUrls || [],
      metadata: {
        numColors: pbnData.numColors,
        detailLevel: pbnData.detailLevel,
        regionCount: pbnData.regionCount,
        analysisWidth: pbnData.analysisWidth,
        analysisHeight: pbnData.analysisHeight,
        originalImageUrl: pbnData.originalImageUrl || null,
      },
      paletteData: pbnData.paletteData || [],
    };

    // Save to user's orders if userId provided
    if (userId) {
      const userOrderRef = db.ref(`users/${userId}/pbnOrders/${orderId}`);
      await userOrderRef.set(orderDataForUser);
    }

    const madeOrderRef = db.ref(`madeOrders/${orderId}`);
    await madeOrderRef.set({
      orderId,
      userId: userId || null,
      createdAt: timestamp,
      orderType: 'pbn',
      paypalOrderId: orderId,
      paypalCaptureId: 'TEST',
      paypalStatus: 'TEST',
      shippingAddress: {
        name: shippingAddress.name,
        email: customerEmail,
        addressLine1: shippingAddress.addressLine1,
        addressLine2: shippingAddress.addressLine2 || '',
        city: shippingAddress.city,
        postcode: shippingAddress.postcode,
        country: shippingAddress.country || 'GB',
        phone: shippingAddress.phone
      },
      pbnData: {
        productKey: pbnData.productKey,
        productLabel: pbnData.productLabel,
        materialType: pbnData.materialType,
        selectedSize: pbnData.selectedSize,
        pricing: pbnData.pricing,
        storageUrls: pbnData.storageUrls || [],
        numColors: pbnData.numColors,
        detailLevel: pbnData.detailLevel,
        regionCount: pbnData.regionCount,
        paletteData: pbnData.paletteData || [],
      },
      fulfillmentStatus: 'pending'
    });

    // Save to PostgreSQL (same as real capture)
    savePbnOrderToPostgres({
      orderId,
      firebaseUid: userId || null,
      customerEmail,
      orderType: 'test',
      status: 'paid',
      paypalOrderId: orderId,
      paypalCaptureId: 'TEST',
      paypalStatus: 'TEST',
      pricing: pbnData.pricing,
      pbnData,
      shippingAddress
    }).catch(() => {});

    // Send seller notification email (fire-and-forget)
    sendPbnOrderNotification({
      orderId,
      shippingAddress,
      pbnData,
      paypalStatus: 'TEST'
    });

    // Send customer confirmation email (fire-and-forget)
    if (customerEmail) {
      sendPbnCustomerConfirmation({
        orderId,
        shippingAddress: { ...shippingAddress, email: customerEmail },
        pbnData
      });
    }

    // Add customer to "customers" contact group (fire-and-forget)
    if (customerEmail) {
      addCustomerToContacts({
        email: customerEmail,
        firstName: shippingAddress?.name?.split(' ')[0] || '',
        lastName: shippingAddress?.name?.split(' ').slice(1).join(' ') || '',
        source: 'pbn_order_test',
        orderId
      }).catch(() => {});
    }

    console.log(`✅ PBN test order saved: ${orderId}`);
    res.json({ success: true, orderId, captureId: 'TEST' });
  } catch (error) {
    console.error('Error in PBN test-capture:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
