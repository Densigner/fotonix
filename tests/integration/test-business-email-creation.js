const fetch = require('node-fetch');

async function testBusinessEmailCreation() {
  try {
    console.log('🧪 Testing business email creation...\n');

    const testData = {
      memberUid: 'test-user-123',
      storeName: 'teststore',
      businessName: 'Test Business',
      customEmail: 'hello'
    };

    console.log('📧 Creating business emails...');
    
    const response = await fetch('http://localhost:4000/api/member/business-email/create-standard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    console.log('Response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Business email creation successful!');
      console.log('Response:', JSON.stringify(result, null, 2));
    } else {
      const error = await response.text();
      console.log('❌ Business email creation failed:');
      console.log(error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testBusinessEmailCreation();