const fetch = require('node-fetch');

async function testBusinessEmailsAPI() {
  try {
    console.log('Testing business emails API...');
    
    // Test with the Claude test member UID
    const memberUid = 'claude-test-uid-12345';
    
    console.log(`\n📧 Fetching business emails for member: ${memberUid}`);
    
    const response = await fetch(`http://localhost:4000/api/member/business-emails/${memberUid}`);
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (response.ok && data.length > 0) {
      console.log('\n✅ API is working! Found business emails:');
      data.forEach(business => {
        console.log(`\n🏢 Business: ${business.businessName}`);
        console.log(`📨 Forward to: ${business.forwardingEmail}`);
        business.emails.forEach(email => {
          console.log(`  - ${email.email} (${email.type}): ${email.description}`);
        });
      });
    } else if (data.length === 0) {
      console.log('\n⚠️  No business emails found for this member');
    } else {
      console.log('\n❌ API error:', data);
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testBusinessEmailsAPI();