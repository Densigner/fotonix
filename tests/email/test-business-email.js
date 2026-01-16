const axios = require('axios');

const testData = {
  memberUid: 'test123',
  storeName: 'Test Store',
  businessName: 'Test Business'
};

async function testBusinessEmailCreation() {
  try {
    console.log('Testing business email creation...');
    console.log('Sending data:', testData);
    
    const response = await axios.post('http://localhost:4000/api/member/business-email/create-standard', testData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response:', response.data);
  } catch (error) {
    if (error.response) {
      console.error('Error response:', error.response.status, error.response.data);
    } else {
      console.error('Request error:', error.message);
    }
  }
}

testBusinessEmailCreation();