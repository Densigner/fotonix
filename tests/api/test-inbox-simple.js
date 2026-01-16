/**
 * Simple test script to verify the inbox API is working
 */
const http = require('http');

function testInboxAPI() {
  console.log('Testing inbox API...');
  
  const options = {
    hostname: 'localhost',
    port: 4000,
    path: '/api/email/messages?tenant=fotonix-prod',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const jsonData = JSON.parse(data);
        console.log('✅ API Response:');
        console.log(JSON.stringify(jsonData, null, 2));
      } catch (error) {
        console.error('❌ Error parsing JSON:', error.message);
        console.log('Raw response:', data);
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('❌ HTTP Error:', error.message);
  });
  
  req.end();
}

testInboxAPI();