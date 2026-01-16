function toCents(value) {
  // Accept decimals or integer cents
  if (value === undefined || value === null) return 0;
  const n = Number(value);
  if (Number.isFinite(n)) {
    // if value looks like cents (integer) assume cents else treat as dollars
    if (Math.abs(n) > 0 && Number.isInteger(n) && String(n).length > 2) return n; // heuristic
    // treat as dollars: convert to cents
    return Math.round(n * 100);
  }
  return 0;
}

function parseCurrency(cur) {
  if (!cur) return 'GBP';
  return String(cur).toUpperCase();
}

const crypto = require('crypto');
function sha256(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex');
}

module.exports = { toCents, parseCurrency, sha256 };
