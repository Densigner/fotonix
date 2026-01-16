const db = require('../db');
const res = db.dedupeAttributions();
console.log('Deduped attributions count:', res.length);
console.log(res);
