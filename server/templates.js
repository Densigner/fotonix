const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Simple file-based storage under data/templates/{tid}.json
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function getStorePath(tid) {
  return path.join(dataDir, `templates_${tid}.json`);
}

function readTemplates(tid) {
  const p = getStorePath(tid);
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8') || '[]'); } catch (e) { return []; }
}

function writeTemplates(tid, arr) {
  const p = getStorePath(tid);
  fs.writeFileSync(p, JSON.stringify(arr, null, 2), 'utf8');
}

// GET list
router.get('/api/tenants/:tid/templates', (req, res) => {
  const tid = req.params.tid || 'default';
  const list = readTemplates(tid);
  return res.json({ ok: true, templates: list });
});

// POST create
router.post('/api/tenants/:tid/templates', (req, res) => {
  const tid = req.params.tid || 'default';
  const payload = req.body || {};
  if (!payload.name || !payload.blocks) return res.status(400).json({ error: 'name and blocks required' });
  const list = readTemplates(tid);
  const id = `tpl_${Date.now()}`;
  const t = { id, name: payload.name, blocks: payload.blocks, assets: payload.assets || [], createdAt: new Date().toISOString() };
  list.unshift(t);
  writeTemplates(tid, list);
  return res.json({ ok: true, template: t });
});

// DELETE
router.delete('/api/tenants/:tid/templates/:id', (req, res) => {
  const tid = req.params.tid || 'default';
  const id = req.params.id;
  let list = readTemplates(tid);
  list = list.filter(t => t.id !== id);
  writeTemplates(tid, list);
  return res.json({ ok: true });
});

module.exports = router;
