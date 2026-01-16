const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', 'data');
function readJSON(name, def) {
  try {
    const p = path.join(DATA_DIR, name);
    if (!fs.existsSync(p)) return def;
    const txt = fs.readFileSync(p, 'utf8');
    return JSON.parse(txt || 'null') || def;
  } catch (e) {
    console.warn('products readJSON failed', name, e);
    return def;
  }
}

// GET /api/products?ownerUid=<uid>
router.get('/api/products', (req, res) => {
  try {
    const ownerUid = req.query.ownerUid || null;
    const productsObj = readJSON('products.json', {});
    // products.json expected as { id: { ...product } }
    const all = Object.entries(productsObj).map(([id, p]) => Object.assign({ id }, p || {}));

    const filtered = ownerUid
      ? all.filter((p) => {
          // common owner fields: ownerUid, uid, owner, userId
          return (p.ownerUid && String(p.ownerUid) === String(ownerUid))
            || (p.uid && String(p.uid) === String(ownerUid))
            || (p.owner && String(p.owner) === String(ownerUid))
            || (p.userId && String(p.userId) === String(ownerUid));
        })
      : all;

    return res.json(filtered);
  } catch (e) {
    console.error('GET /api/products error', e);
    return res.status(500).json({ error: String(e) });
  }
});

module.exports = router;
