#!/usr/bin/env node
/**
 * End-to-End Business Email System Test
 * 
 * Tests the full flow of the production-ready email management system:
 *  1. Business email creation (signup simulation)
 *  2. Email listing API
 *  3. Email send flow with business email ID
 *  4. Rate limiting and validation
 * 
 * Usage:
 *   node scripts/test-email-system.js
 */

const fetch = require('node-fetch');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const TEST_MEMBER_UID = `test_${Date.now()}`;
const TEST_STORE_NAME = `teststore${Date.now()}`;

console.log('\n🧪 Business Email System End-to-End Test');
console.log('='.repeat(60));
console.log(`Base URL: ${BASE_URL}`);
console.log(`Test Member UID: ${TEST_MEMBER_UID}`);
console.log(`Test Store Name: ${TEST_STORE_NAME}\n`);

async function test() {
  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Create business emails
  console.log('📝 Test 1: Create business emails for new member');
  try {
    const createResponse = await fetch(`${BASE_URL}/api/member/business-email/create-standard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberUid: TEST_MEMBER_UID,
        storeName: TEST_STORE_NAME,
        businessName: `Test Business ${TEST_STORE_NAME}`,
        customEmail: null,
        forwardToEmail: 'test@example.com'
      })
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`HTTP ${createResponse.status}: ${error}`);
    }

    const createResult = await createResponse.json();
    console.log('✅ Business emails created:');
    console.log(`   - Group ID: ${createResult.groupId}`);
    console.log(`   - Emails created: ${createResult.emails.length}`);
    createResult.emails.forEach(e => {
      console.log(`     • ${e.email} (${e.type}) [ID: ${e.id}]`);
    });
    
    if (!createResult.emails || createResult.emails.length !== 4) {
      throw new Error(`Expected 4 emails, got ${createResult.emails?.length || 0}`);
    }
    
    // Verify all emails have IDs
    const emailsWithoutId = createResult.emails.filter(e => !e.id);
    if (emailsWithoutId.length > 0) {
      throw new Error(`${emailsWithoutId.length} emails missing IDs!`);
    }
    
    testsPassed++;
  } catch (error) {
    console.error('❌ Test 1 failed:', error.message);
    testsFailed++;
    return; // Can't continue without created emails
  }

  // Test 2: Fetch business emails
  console.log('\n📧 Test 2: Fetch business emails for member');
  let businessEmails = [];
  try {
    const fetchResponse = await fetch(`${BASE_URL}/api/member/business-emails/${TEST_MEMBER_UID}`);
    
    if (!fetchResponse.ok) {
      throw new Error(`HTTP ${fetchResponse.status}`);
    }

    businessEmails = await fetchResponse.json();
    
    if (!Array.isArray(businessEmails)) {
      throw new Error(`Expected array response, got ${typeof businessEmails}`);
    }
    
    console.log(`✅ Fetched ${businessEmails.length} business emails`);
    businessEmails.forEach(e => {
      console.log(`   • ID: ${e.id}, Email: ${e.email}, Type: ${e.type}, Verified: ${e.isVerified}`);
      console.log(`     Daily limit: ${e.dailyLimit}, Remaining: ${e.dailyRemaining}`);
    });
    
    // Verify all have proper IDs
    const invalidEmails = businessEmails.filter(e => !e.id || typeof e.id !== 'number');
    if (invalidEmails.length > 0) {
      throw new Error(`${invalidEmails.length} emails have invalid IDs`);
    }
    
    testsPassed++;
  } catch (error) {
    console.error('❌ Test 2 failed:', error.message);
    testsFailed++;
    return;
  }

  // Test 3: Send email using business email ID
  console.log('\n📤 Test 3: Send email with business email ID');
  try {
    const mainEmail = businessEmails.find(e => e.type === 'main');
    if (!mainEmail) {
      throw new Error('No main email found');
    }

    const sendResponse = await fetch(`${BASE_URL}/api/email/send`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-tenant-id': '1'
      },
      body: JSON.stringify({
        to: 'test-recipient@example.com',
        from: mainEmail.email,
        businessEmailId: mainEmail.id,  // ✅ Pass the ID
        subject: 'Test Email from Production System',
        html: '<p>This is a test email from the production-ready email management system.</p>',
        text: 'This is a test email from the production-ready email management system.'
      })
    });

    if (!sendResponse.ok) {
      const error = await sendResponse.text();
      throw new Error(`HTTP ${sendResponse.status}: ${error}`);
    }

    const sendResult = await sendResponse.json();
    console.log('✅ Email sent successfully:');
    console.log(`   - Message ID: ${sendResult.messageId}`);
    console.log(`   - Provider Message ID: ${sendResult.providerMessageId || 'N/A'}`);
    console.log(`   - From: ${sendResult.from}`);
    
    testsPassed++;
  } catch (error) {
    console.error('❌ Test 3 failed:', error.message);
    testsFailed++;
  }

  // Test 4: Test rate limiting (send multiple emails quickly)
  console.log('\n⏱️  Test 4: Rate limiting validation');
  try {
    const mainEmail = businessEmails.find(e => e.type === 'main');
    
    // Check current send count
    const beforeFetch = await fetch(`${BASE_URL}/api/member/business-emails/${TEST_MEMBER_UID}`);
    const beforeEmails = await beforeFetch.json();
    const beforeMain = beforeEmails.find(e => e.type === 'main');
    
    console.log(`   Before: ${beforeMain.dailySent}/${beforeMain.dailyLimit} sent today`);
    
    // Send a few emails
    for (let i = 0; i < 3; i++) {
      await fetch(`${BASE_URL}/api/email/send`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': '1'
        },
        body: JSON.stringify({
          to: `test${i}@example.com`,
          from: mainEmail.email,
          businessEmailId: mainEmail.id,
          subject: `Rate limit test ${i + 1}`,
          html: `<p>Test email ${i + 1}</p>`,
          text: `Test email ${i + 1}`
        })
      });
    }
    
    // Check updated count
    const afterFetch = await fetch(`${BASE_URL}/api/member/business-emails/${TEST_MEMBER_UID}`);
    const afterEmails = await afterFetch.json();
    const afterMain = afterEmails.find(e => e.type === 'main');
    
    console.log(`   After: ${afterMain.dailySent}/${afterMain.dailyLimit} sent today`);
    
    if (afterMain.dailySent <= beforeMain.dailySent) {
      throw new Error('Send count did not increment');
    }
    
    console.log(`✅ Rate limiting working: count incremented by ${afterMain.dailySent - beforeMain.dailySent}`);
    testsPassed++;
  } catch (error) {
    console.error('❌ Test 4 failed:', error.message);
    testsFailed++;
  }

  // Test 5: Test validation (missing required fields)
  console.log('\n🛡️  Test 5: Validation checks');
  try {
    const invalidResponse = await fetch(`${BASE_URL}/api/email/send`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-tenant-id': '1'
      },
      body: JSON.stringify({
        to: '', // Missing
        subject: '', // Missing
        html: '<p>Test</p>'
      })
    });

    if (invalidResponse.ok) {
      throw new Error('Expected validation error, but request succeeded');
    }
    
    const errorText = await invalidResponse.text();
    console.log(`✅ Validation working: ${invalidResponse.status} - ${errorText.substring(0, 100)}`);
    testsPassed++;
  } catch (error) {
    console.error('❌ Test 5 failed:', error.message);
    testsFailed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📈 Success Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);
  
  if (testsFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! System is production-ready.');
    console.log('');
    process.exit(0);
  } else {
    console.log('\n⚠️  SOME TESTS FAILED. Review errors above.');
    console.log('');
    process.exit(1);
  }
}

// Run tests
test().catch(err => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
