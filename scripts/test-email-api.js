/**
 * Test the /api/email/send endpoint directly
 */

require('dotenv').config();
const axios = require('axios');

async function testEmailEndpoint() {
  console.log('🧪 Testing /api/email/send endpoint\n');

  try {
    const response = await axios.post('http://localhost:4000/api/email/send', {
      from: 'contact.fffff@fotonix.co.uk',
      to: 'joshmarsden28@gmail.com',
      subject: 'API Test - ' + new Date().toISOString(),
      html: '<h1>API Test</h1><p>Testing the email API endpoint</p>',
      text: 'Testing the email API endpoint',
      businessEmailId: 1
    });

    console.log('✅ Email sent successfully!');
    console.log('   Response:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Request failed:', error.response?.data || error.message);
    console.error('   Status:', error.response?.status);
    
    if (error.response?.data?.detail) {
      console.error('\n   Error detail:', error.response.data.detail);
    }
  }
}

// Check if server is running first
const checkServer = async () => {
  try {
    await axios.get('http://localhost:4000');
    return true;
  } catch (e) {
    return false;
  }
};

(async () => {
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.error('❌ Server not running on http://localhost:4000');
    console.error('   Start it with: node server/index.js');
    process.exit(1);
  }
  
  await testEmailEndpoint();
})();
