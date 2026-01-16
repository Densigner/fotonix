/**
 * Test signup flow - simulate creating a new account to verify business emails are created
 */

require('dotenv').config();

async function testSignup() {
  const testData = {
    memberUid: 'test-uid-' + Date.now(),
    storeName: 'test-store-' + Date.now(),
    businessName: 'Test Business ' + Date.now(),
    customEmail: 'custom'
  };

  console.log('🧪 Testing signup flow with data:');
  console.log(JSON.stringify(testData, null, 2));
  console.log('');

  try {
    const response = await fetch('http://localhost:4000/api/member/business-email/create-standard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ SUCCESS! Business emails created:');
      console.log(JSON.stringify(result, null, 2));
      console.log('');
      console.log('📧 Email addresses created:');
      result.emails.forEach(email => {
        console.log(`  - ${email.email} (${email.type})`);
      });
    } else {
      console.error('❌ FAILED:', result.error);
      if (result.detail) console.error('   Detail:', result.detail);
    }

  } catch (error) {
    console.error('❌ Request failed:', error.message);
    console.error('   Stack:', error.stack);
    console.error('');
    console.error('⚠️  Make sure the server is running on port 4000');
    console.error('   Run: node server/index.js');
  }
}

// Run test
testSignup();
