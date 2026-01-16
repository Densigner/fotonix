require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({connectionString: process.env.DATABASE_URL});

const memberUid = 'XSFZo8rye2YsQDjUm4zRhguZPRI2';

async function diagnose() {
  console.log('🔍 Diagnosing email inbox issue\n');
  
  // 1. Check user's business emails
  const businessEmails = await pool.query(
    'SELECT id, email_address, member_uid, business_name FROM business_emails WHERE member_uid = $1',
    [memberUid]
  );
  
  console.log(`📧 User's Business Emails (${businessEmails.rows.length}):`);
  console.table(businessEmails.rows);
  
  const emailAddresses = businessEmails.rows.map(r => r.email_address);
  console.log('\n📋 Email addresses:', emailAddresses.join(', '));
  
  // 2. Check all inbound emails
  const allInbound = await pool.query(
    `SELECT id, from_address, to_address, subject, direction, business_email_id, received_at 
     FROM email_messages 
     WHERE direction='inbound' 
     ORDER BY received_at DESC 
     LIMIT 10`
  );
  
  console.log(`\n📨 All Inbound Emails (${allInbound.rows.length}):`);
  console.table(allInbound.rows);
  
  // 3. Check if any match user's emails
  const userInbound = await pool.query(
    `SELECT id, from_address, to_address, subject, business_email_id 
     FROM email_messages 
     WHERE direction='inbound' 
       AND to_address = ANY($1::text[])
     ORDER BY received_at DESC`,
    [emailAddresses]
  );
  
  console.log(`\n✅ Emails matching user's addresses (${userInbound.rows.length}):`);
  if (userInbound.rows.length > 0) {
    console.table(userInbound.rows);
  } else {
    console.log('❌ NO EMAILS FOUND for user\'s addresses!');
    console.log('\n🔍 The inbound emails have to_address:', allInbound.rows.map(r => r.to_address));
    console.log('   But user owns:', emailAddresses);
  }
  
  pool.end();
}

diagnose().catch(e => {
  console.error('❌ Error:', e.message);
  pool.end();
});
