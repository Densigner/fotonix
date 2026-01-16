#!/usr/bin/env node

/**
 * Quick Test Script for VPS Mail Integration
 * Run this to verify your setup is working
 */

const fetch = require('node-fetch');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';

async function runTests() {
  console.log('🧪 Testing VPS Mail Integration...\n');

  try {
    // Test 1: Health check
    console.log('1️⃣  Testing server health...');
    const health = await fetch(`${BASE_URL}/__health`);
    if (health.ok) {
      const healthData = await health.json();
      console.log('✅ Server is healthy:', healthData);
    } else {
      console.log('❌ Server health check failed');
      return;
    }

    // Test 2: SMTP Connection
    console.log('\n2️⃣  Testing SMTP connection...');
    try {
      const smtpTest = await fetch(`${BASE_URL}/api/smtp/test-connection`);
      const smtpData = await smtpTest.json();
      
      if (smtpData.success) {
        console.log('✅ SMTP connection successful:', smtpData.config);
      } else {
        console.log('❌ SMTP connection failed:', smtpData.error);
        console.log('💡 Make sure your VPS mail server is running and accessible');
      }
    } catch (error) {
      console.log('❌ SMTP test endpoint not available:', error.message);
    }

    // Test 3: Email API endpoints
    console.log('\n3️⃣  Testing email API endpoints...');
    try {
      const statsTest = await fetch(`${BASE_URL}/api/emails/stats`);
      if (statsTest.ok) {
        const statsData = await statsTest.json();
        console.log('✅ Email stats API working:', {
          total: statsData.stats.total,
          sent: statsData.stats.sent,
          failed: statsData.stats.failed
        });
      } else {
        console.log('❌ Email stats API failed');
      }
    } catch (error) {
      console.log('❌ Email API endpoints not available:', error.message);
    }

    // Test 4: Campaign API (legacy)
    console.log('\n4️⃣  Testing campaign API...');
    try {
      const testPayload = {
        to: 'test@example.com',
        html: '<h1>Test Email</h1><p>This is a test from your VPS mail server.</p>'
      };
      
      const campaignTest = await fetch(`${BASE_URL}/api/tenants/1/campaigns/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
      });

      if (campaignTest.ok) {
        const campaignData = await campaignTest.json();
        console.log('✅ Campaign API working:', campaignData.message);
        
        if (campaignData.messageId) {
          console.log('📧 Email sent with Message ID:', campaignData.messageId);
        } else if (campaignData.simulation) {
          console.log('🎭 Campaign running in simulation mode (VPS not configured)');
        }
      } else {
        console.log('❌ Campaign API failed');
      }
    } catch (error) {
      console.log('❌ Campaign API test failed:', error.message);
    }

    console.log('\n✅ Integration test completed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Configure your .env file with VPS details');
    console.log('   2. Run: node setup-vps-mail-integration.js');
    console.log('   3. Test email delivery to your address');
    console.log('   4. Set up DNS records (SPF, DKIM, DMARC)');
    console.log('   5. Monitor deliverability to major providers');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { runTests };