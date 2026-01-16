const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON(name, def) {
  ensureDir();
  const p = path.join(DATA_DIR, name);
  try {
    if (!fs.existsSync(p)) return def;
    const txt = fs.readFileSync(p, 'utf8');
    return JSON.parse(txt || 'null') || def;
  } catch (e) {
    console.warn('readJSON failed', p, e);
    return def;
  }
}

function writeJSON(name, data) {
  ensureDir();
  const p = path.join(DATA_DIR, name);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

// Orders: store by id
function upsertOrder(orderId, payload) {
  const orders = readJSON('orders.json', {});
  orders[orderId] = Object.assign({}, orders[orderId] || {}, payload);
  writeJSON('orders.json', orders);
  return orders[orderId];
}

function getOrder(orderId) {
  const orders = readJSON('orders.json', {});
  return orders[orderId] || null;
}

// Clicks: example structure { clickId: { affiliateId, ratePct, createdAt, ... } }
function getClick(clickId) {
  if (!clickId) return null;
  const clicks = readJSON('clicks.json', {});
  return clicks[clickId] || null;
}

// Save or update a click record (append/update into clicks.json)
function saveClick(click) {
  if (!click || !click.id) throw new Error('click.id required');
  const clicks = readJSON('clicks.json', {});
  clicks[click.id] = click;
  writeJSON('clicks.json', clicks);
  return clicks[click.id];
}

// Helper: get product by id from optional products.json store
function getProductById(productId) {
  if (!productId) return null;
  const products = readJSON('products.json', {});
  return products[productId] || null;
}

// Create and persist a click record, snapping the effective ratePct.
function createClick({ affiliateId, productId, linkCustomRatePct } = {}) {
  if (!affiliateId) throw new Error('affiliateId required');
  // read program defaults (safe fallback)
  const settings = readJSON('affiliateSettings.json', { programDefaultCommissionPct: 10 });
  const programDefaultRatePct = Number(settings.programDefaultCommissionPct || 0);

  // attempt to lookup a product rate from a local products.json (optional)
  const products = readJSON('products.json', {});
  const product = productId ? (products[productId] || null) : null;
  const productRatePct = (product && typeof product.commissionRate === 'number') ? (product.commissionRate * 100) : null;

  const ratePct = (linkCustomRatePct !== undefined && linkCustomRatePct !== null)
    ? Number(linkCustomRatePct)
    : (productRatePct !== null ? Number(productRatePct) : programDefaultRatePct);

  const clicks = readJSON('clicks.json', {});
  const id = 'click_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  const click = {
    id,
    affiliateId,
    productId: productId || null,
    ratePct,
    programDefaultRatePct,
    linkCustomRatePct: (linkCustomRatePct !== undefined ? linkCustomRatePct : null),
    createdAt: new Date().toISOString()
  };
  clicks[id] = click;
  writeJSON('clicks.json', clicks);
  return click;
}

// Attributions: array
function createAttribution(attr) {
  const arr = readJSON('attributions.json', []);
  // Prevent duplicates: consider same orderId + clickId + affiliateId as duplicate
  const exists = arr.find(a => a.orderId === attr.orderId && a.clickId === attr.clickId && a.affiliateId === attr.affiliateId);
  if (exists) return exists;

  const item = Object.assign({ id: 'attr_' + Date.now() + '_' + Math.floor(Math.random()*9999), createdAt: new Date().toISOString() }, attr);
  arr.push(item);
  writeJSON('attributions.json', arr);
  return item;
}

function dedupeAttributions() {
  const arr = readJSON('attributions.json', []);
  const map = new Map();
  for (const a of arr) {
    const key = `${a.orderId}|||${a.clickId}|||${a.affiliateId}`;
    if (!map.has(key)) map.set(key, a);
    else {
      // keep earliest createdAt (or existing) — do nothing to replace
      const existing = map.get(key);
      if (new Date(a.createdAt) < new Date(existing.createdAt)) map.set(key, a);
    }
  }
  const deduped = Array.from(map.values()).sort((x,y) => new Date(x.createdAt) - new Date(y.createdAt));
  writeJSON('attributions.json', deduped);
  return deduped;
}

function findAttributionsByOrder(orderId) {
  const arr = readJSON('attributions.json', []);
  return arr.filter(a => a.orderId === orderId);
}

function voidAttributionsForOrder(orderId, reason) {
  const arr = readJSON('attributions.json', []);
  let changed = false;
  for (const a of arr) {
    if (a.orderId === orderId && a.status !== 'void') {
      a.status = 'void';
      a.voidedAt = new Date().toISOString();
      a.voidReason = reason || 'refund';
      changed = true;
    }
  }
  if (changed) writeJSON('attributions.json', arr);
  return arr.filter(a => a.orderId === orderId);
}

// Idempotency store for webhook event ids / transmission ids
function readIds() {
  return readJSON('ids.json', { processed: [] });
}

function hasProcessedId(id) {
  if (!id) return false;
  const data = readIds();
  return (data.processed || []).includes(id);
}

function markProcessedId(id) {
  if (!id) return;
  const data = readIds();
  data.processed = data.processed || [];
  if (!data.processed.includes(id)) data.processed.push(id);
  writeJSON('ids.json', data);
}

module.exports = { upsertOrder, getOrder, getClick, saveClick, createClick, createAttribution, findAttributionsByOrder, voidAttributionsForOrder, dedupeAttributions, readIds, hasProcessedId, markProcessedId, getProductById };
