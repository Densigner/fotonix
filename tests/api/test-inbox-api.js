/**
 * Simple test script to verify the inbox API is working
 */
const http = require('http');

function testInboxAPI() {
  return new Promise((resolve, reject) => {
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
          resolve(jsonData);
        } catch (error) {
          console.error('❌ Error parsing JSON:', error.message);
          console.log('Raw response:', data);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ HTTP Error:', error.message);
      reject(error);
    });
    
    req.end();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('✅ API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    // Test getting a specific message
    if (data.items && data.items.length > 0) {
      const messageId = data.items[0].id;
      console.log(`\nTesting message detail for ID ${messageId}...`);
      
      const detailResponse = await fetch(`http://localhost:4000/api/email/messages/${messageId}?tenant=fotonix-prod`);
      
      if (!detailResponse.ok) {
        throw new Error(`Detail HTTP ${detailResponse.status}: ${detailResponse.statusText}`);
      }
      
      const detailData = await detailResponse.json();
      console.log('✅ Message Detail:');
      console.log(JSON.stringify(detailData, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

testInboxAPI();