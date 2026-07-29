// One-off/reusable helper: create a real affiliate account the same way
// AffiliateSignupPage.js does (Firebase Auth user + affiliates/{uid} +
// users/{uid} RTDB nodes + the create-affiliate business email), but from
// the server side via Admin SDK, for testing without a browser.
//
// Usage: node createTestAffiliate.js [email] [password]

const admin = require('../firebase-admin');

const email = process.argv[2] || `affiliate.tester.${Date.now()}@example.com`;
const password = process.argv[3] || 'TestPassword123!';
const API_BASE = process.env.API_BASE || 'http://localhost:4000';

// Mirrors AffiliateSignupPage.js's slugFromEmail()
function slugFromEmail(addr) {
  const local = (addr.split('@')[0] || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return local.slice(0, 8) || 'AFF';
}

// Mirrors AffiliateSignupPage.js's generateUniqueAffiliateCode()
async function generateUniqueAffiliateCode(db, addr) {
  const base = slugFromEmail(addr);
  for (let attempt = 0; attempt < 25; attempt++) {
    const suffix = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    const candidate = `${base}${suffix}`;
    const snap = await db.ref('affiliates').orderByChild('code').equalTo(candidate).once('value');
    if (!snap.exists()) return candidate;
  }
  return `${base}${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

async function main() {
  const db = admin.database();

  console.log(`Creating Firebase Auth user for ${email}...`);
  const userRecord = await admin.auth().createUser({ email, password, emailVerified: false });
  const uid = userRecord.uid;
  console.log(`✅ Auth user created: ${uid}`);

  const code = await generateUniqueAffiliateCode(db, email);
  console.log(`✅ Affiliate code: ${code}`);

  await db.ref(`affiliates/${uid}`).set({
    email,
    joinedAt: admin.database.ServerValue.TIMESTAMP,
    approved: false,
    code,
  });
  await db.ref(`users/${uid}`).update({
    affiliateCode: code,
    affiliateApproved: false,
    updatedAt: admin.database.ServerValue.TIMESTAMP,
  });
  console.log('✅ RTDB affiliates/ and users/ nodes written');

  const emailRes = await fetch(`${API_BASE}/api/member/business-email/create-affiliate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberUid: uid, affiliateCode: code }),
  });
  const emailJson = await emailRes.json();
  console.log('create-affiliate response:', emailJson);

  console.log('\n=== Test affiliate account ready ===');
  console.log('Email:   ', email);
  console.log('Password:', password);
  console.log('UID:     ', uid);
  console.log('Code:    ', code);
  console.log('Business email:', emailJson.email?.email_address);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
