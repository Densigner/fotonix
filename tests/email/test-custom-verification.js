const fetch = require('node-fetch');

async function testCustomEmailVerification() {
  try {
    console.log('🧪 Testing custom email verification system...\n');

    // Test data
    const testData = {
      firebaseUid: 'test-firebase-uid-123',
      email: 'test@example.com',
      businessName: 'Test Business'
    };

    console.log('📧 Testing verification email sending...');
    
    const response = await fetch('http://localhost:4000/api/auth/send-custom-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const result = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('\n✅ Custom email verification system is working!');
      console.log('📧 Verification email would be sent via VPS to:', testData.email);
      console.log('🔑 Verification token created:', result.verificationToken?.substring(0, 16) + '...');
    } else {
      console.log('\n❌ Error in custom email verification:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCustomEmailVerification();