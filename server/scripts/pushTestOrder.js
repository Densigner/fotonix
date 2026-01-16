const admin = require('firebase-admin');

// Initialize Firebase Admin using Application Default Credentials
// or with the correct database URL from firebase.js
if (!admin.apps.length) {
  admin.initializeApp({
    // Use ADC (Application Default Credentials) - requires `gcloud auth application-default login`
    // OR set GOOGLE_APPLICATION_CREDENTIALS env var to point to service account JSON
    databaseURL: 'https://fotonix-97544-default-rtdb.europe-west1.firebasedatabase.app'
  });
}

const db = admin.database();
const userId = 'EnSWq10vZmhrFni77BL9LOP1Q8q2';
// Explicitly log current user id for debugging
console.log('Current user id:', userId);
const orderId = 'TEST_ORDER_' + Date.now();
const timestamp = Date.now();

// Sample layer colors - Google-inspired colors from the screenshot
const layerColors = [
  { layerIndex: 0, paintOrder: 1, color: { hex: '#1a1a2e', rgb: { r: 26, g: 26, b: 46 }, name: 'Deep Navy' }, threshold: [0, 17] },
  { layerIndex: 1, paintOrder: 2, color: { hex: '#4285F4', rgb: { r: 66, g: 133, b: 244 }, name: 'Google Blue' }, threshold: [17, 34] },
  { layerIndex: 2, paintOrder: 3, color: { hex: '#EA4335', rgb: { r: 234, g: 67, b: 53 }, name: 'Google Red' }, threshold: [34, 51] },
  { layerIndex: 3, paintOrder: 4, color: { hex: '#FBBC05', rgb: { r: 251, g: 188, b: 5 }, name: 'Google Yellow' }, threshold: [51, 68] },
  { layerIndex: 4, paintOrder: 5, color: { hex: '#34A853', rgb: { r: 52, g: 168, b: 83 }, name: 'Google Green' }, threshold: [68, 85] },
  { layerIndex: 5, paintOrder: 6, color: { hex: '#5F6368', rgb: { r: 95, g: 99, b: 104 }, name: 'Gray 700' }, threshold: [85, 102] },
  { layerIndex: 6, paintOrder: 7, color: { hex: '#80868B', rgb: { r: 128, g: 134, b: 139 }, name: 'Gray 600' }, threshold: [102, 119] },
  { layerIndex: 7, paintOrder: 8, color: { hex: '#9AA0A6', rgb: { r: 154, g: 160, b: 166 }, name: 'Gray 500' }, threshold: [119, 136] },
  { layerIndex: 8, paintOrder: 9, color: { hex: '#BDC1C6', rgb: { r: 189, g: 193, b: 198 }, name: 'Gray 400' }, threshold: [136, 153] },
  { layerIndex: 9, paintOrder: 10, color: { hex: '#DADCE0', rgb: { r: 218, g: 220, b: 224 }, name: 'Gray 300' }, threshold: [153, 170] },
  { layerIndex: 10, paintOrder: 11, color: { hex: '#E8EAED', rgb: { r: 232, g: 234, b: 237 }, name: 'Gray 200' }, threshold: [170, 187] },
  { layerIndex: 11, paintOrder: 12, color: { hex: '#F1F3F4', rgb: { r: 241, g: 243, b: 244 }, name: 'Gray 100' }, threshold: [187, 204] },
  { layerIndex: 12, paintOrder: 13, color: { hex: '#F8F9FA', rgb: { r: 248, g: 249, b: 250 }, name: 'Gray 50' }, threshold: [204, 221] },
  { layerIndex: 13, paintOrder: 14, color: { hex: '#FAFAFA', rgb: { r: 250, g: 250, b: 250 }, name: 'Near White' }, threshold: [221, 238] },
  { layerIndex: 14, paintOrder: 15, color: { hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 }, name: 'Pure White' }, threshold: [238, 255] }
];

// Create storage URLs (simulated for testing)
const storageUrls = layerColors.map((lc, i) => ({
  layerIndex: i,
  pngFileName: `test-stencil-layer-${i + 1}-${timestamp}.png`,
  pngUrl: `https://firebasestorage.googleapis.com/v0/b/fotonix.appspot.com/o/test-layer-${i + 1}.png?alt=media`,
  svgFileName: `test-stencil-layer-${i + 1}-${timestamp}.svg`,
  svgUrl: `https://firebasestorage.googleapis.com/v0/b/fotonix.appspot.com/o/test-layer-${i + 1}.svg?alt=media`,
  threshold: lc.threshold
}));

const orderData = {
  orderId: orderId,
  timestamp: timestamp,
  paypalStatus: 'COMPLETED',
  numStencils: 15,
  pricing: {
    pricePerStencil: 3.00,
    subtotal: '45.00',
    deliveryFee: '0.00',
    total: '45.00'
  },
  storageUrls: storageUrls,
  metadata: {
    layerMode: 'discrete',
    thresholdMethod: 'uniform',
    originalImageName: 'google-screenshot-test.png',
    stencilMode: 'standard',
    bridgeWidth: 3,
    halftoneSettings: null,
    registrationMarks: false
  },
  paintingGuide: {
    layerColors: layerColors,
    totalLayers: 15,
    instructions: 'Use the Android companion app to view color placement guide'
  }
};

// Save to user's stencilOrders
console.log('Creating order for user:', userId);
console.log('Order ID:', orderId);

// Print requested seller fingerprint to console
console.log('Seller fingerprint:', `stencilmeboy${userId}`);

// Attempt to write using Admin SDK, but fall back to REST PUT if Admin fails (common when ADC not configured)
const trySave = async () => {
  try {
    await db.ref(`users/${userId}/stencilOrders/${orderId}`).set(orderData);
    console.log('\n✅ Order created successfully via Admin SDK!');
    console.log('📦 Order ID:', orderId);
    console.log('👤 User ID:', userId);
    console.log('🎨 Layers:', layerColors.length);
    console.log('\nColors in order:');
    layerColors.forEach(lc => {
      console.log(`  Layer ${lc.layerIndex + 1}: ${lc.color.name} (${lc.color.hex})`);
    });
    process.exit(0);
  } catch (adminErr) {
    console.warn('\n⚠️ Admin SDK write failed - attempting REST fallback. Error:', adminErr && adminErr.message ? adminErr.message : adminErr);
    // REST fallback
    try {
      const dbUrl = 'https://fotonix-97544-default-rtdb.europe-west1.firebasedatabase.app';
      const putUrl = `${dbUrl}/users/${userId}/stencilOrders/${orderId}.json`;
      // Use global fetch if available (Node 18+), otherwise try node-fetch
      let _fetch = (typeof fetch !== 'undefined') ? fetch : null;
      if (!_fetch) {
        try {
          _fetch = require('node-fetch');
        } catch (e) {
          console.error('node-fetch not available; cannot perform REST fallback. Install node-fetch or configure ADC.');
          process.exit(1);
        }
      }

      const res = await _fetch(putUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.error('❌ REST fallback failed. Status:', res.status, res.statusText, txt);
        process.exit(1);
      }

      console.log('\n✅ Order created successfully via REST fallback!');
      console.log('📦 Order ID:', orderId);
      console.log('👤 User ID:', userId);
      console.log('🎨 Layers:', layerColors.length);
      console.log('\nColors in order:');
      layerColors.forEach(lc => {
        console.log(`  Layer ${lc.layerIndex + 1}: ${lc.color.name} (${lc.color.hex})`);
      });
      process.exit(0);
    } catch (restErr) {
      console.error('❌ REST fallback error:', restErr);
      process.exit(1);
    }
  }
};

trySave();

// original write moved to trySave wrapper
