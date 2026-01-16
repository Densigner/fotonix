const { Client } = require('pg');
require('dotenv').config();

async function createTestBusinessEmails() {
  console.log('Creating test business emails for Claude...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    const memberUid = 'claude-test-uid-12345';
    const businessName = 'claudes';
    const storeName = 'claudesshop';
    
    // Delete existing if any
    await client.query('DELETE FROM member_business_emails WHERE member_uid = $1', [memberUid]);
    
    // Create the business email record
    const result = await client.query(`
      INSERT INTO member_business_emails 
      (member_uid, business_name, main_email, noreply_email, support_email, orders_email, forward_to_email, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
      RETURNING *
    `, [
      memberUid,
      businessName,
      'claude.claudesshop@fotonix.co.uk',           // main_email (custom)
      'no_reply.claudesshop@fotonix.co.uk',         // noreply_email
      'contact.claudesshop@fotonix.co.uk',          // support_email  
      'theirchoice.claudesshop@fotonix.co.uk',      // orders_email
      'claude.test@example.com'                     // forward_to_email
    ]);
    
    console.log('✅ Created business emails:');
    const record = result.rows[0];
    console.log(`- Main: ${record.main_email}`);
    console.log(`- No Reply: ${record.noreply_email}`);
    console.log(`- Support: ${record.support_email}`);
    console.log(`- Orders: ${record.orders_email}`);
    console.log(`- Forward to: ${record.forward_to_email}`);
    console.log(`\n🔑 Member UID: ${memberUid}`);
    console.log('Use this UID to test the API endpoint!');
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await client.end();
  }
}

createTestBusinessEmails();