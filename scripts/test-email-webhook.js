/**
 * Test the email webhook endpoint
 */

require('dotenv').config();
const axios = require('axios');

async function testWebhook() {
  console.log('🧪 Testing Email Webhook Endpoint\n');

  const testEmail = {
    from: 'joshmarsden28@gmail.com',
    to: ['contact.fffff@fotonix.co.uk'],
    subject: 'RE: Test Email - Reply from Gmail',
    html: '<p>This is a test reply to your email.</p><p>It should appear in your inbox!</p>',
    text: 'This is a test reply to your email. It should appear in your inbox!',
    headers: {
      'message-id': '<test-' + Date.now() + '@gmail.com>',
      'in-reply-to': '<original-message@fotonix.co.uk>',
      'references': ['<original-message@fotonix.co.uk>']
    }
  };

  try {
    console.log('📨 Simulating incoming email...');
    console.log('   From:', testEmail.from);
    console.log('   To:', testEmail.to.join(', '));
    console.log('   Subject:', testEmail.subject);
    console.log('');

    const response = await axios.post(
      'http://localhost:4000/api/email/receive-webhook',
      testEmail,
      {
        headers: {
          'X-Webhook-Secret': process.env.WEBHOOK_SECRET || 'fotonix-webhook-secret-2024'
        }
      }
    );

    console.log('✅ Webhook processed successfully!');
    console.log('   Response:', JSON.stringify(response.data, null, 2));
    console.log('');

    // Check if it was saved to database
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    const result = await pool.query(`
      SELECT id, from_address, to_address, subject, direction, is_read, received_at
      FROM email_messages 
      WHERE direction = 'inbound'
      ORDER BY received_at DESC 
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      console.log('✅ Email found in database:');
      console.table(result.rows);
    } else {
      console.log('⚠️  No inbound emails found in database');
    }

    await pool.end();

  } catch (error) {
    console.error('❌ Webhook test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.error('\n💡 Webhook secret mismatch - check WEBHOOK_SECRET in .env');
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Server not running - start with: node server/index.js');
    }
    
    process.exit(1);
  }
}

testWebhook();
