const https = require('http');

async function testLinkCreation() {
  console.log('Testing link creation API...');
  
  const postData = JSON.stringify({
    user_id: "JOSHMARSUE0",
    destination_url: "https://example.com/product1",
    title: "My Test Product Link",
    product_id: "p_josh_1",
    channel: "email",
    meta: { customCommissionPct: 15.0 }
  });

  const options = {
    hostname: 'localhost',
    port: 5002,
    path: '/api/links',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Response status:', res.statusCode);
        console.log('Response body:', data);
        
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log('✅ Link creation successful!');
          const link = JSON.parse(data);
          console.log('Created link:', link);
          resolve(link);
        } else {
          console.log('❌ Link creation failed');
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      console.log('❌ Request failed:', err.message);
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

// Test link retrieval
async function testLinkRetrieval() {
  console.log('\nTesting link retrieval API...');
  
  const options = {
    hostname: 'localhost',
    port: 5002,
    path: '/api/links?user=JOSHMARSUE0',
    method: 'GET'
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Response status:', res.statusCode);
        
        if (res.statusCode === 200) {
          const links = JSON.parse(data);
          console.log('✅ Link retrieval successful!');
          console.log('Found links:', links.length);
          links.forEach(link => {
            console.log(`  - ${link.slug}: ${link.destination_url}`);
          });
          resolve(links);
        } else {
          console.log('❌ Link retrieval failed:', data);
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      console.log('❌ Request failed:', err.message);
      reject(err);
    });

    req.end();
  });
}

// Test link click simulation
async function testLinkClick(slug) {
  console.log(`\nTesting link click for slug: ${slug}...`);
  
  const options = {
    hostname: 'localhost',
    port: 5002,
    path: `/l/${slug}?t=test`,
    method: 'GET',
    headers: {
      'User-Agent': 'Test-Agent/1.0'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      console.log('Response status:', res.statusCode);
      console.log('Response headers:', res.headers);
      
      if (res.statusCode === 302 || res.statusCode === 301) {
        console.log('✅ Link redirect successful!');
        console.log('Redirected to:', res.headers.location);
        resolve(res.headers.location);
      } else if (res.statusCode === 404) {
        console.log('❌ Link not found');
        reject(new Error('Link not found'));
      } else {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log('Response body:', data);
          reject(new Error(`Unexpected response: ${res.statusCode}`));
        });
      }
    });

    req.on('error', (err) => {
      console.log('❌ Request failed:', err.message);
      reject(err);
    });

    req.end();
  });
}

async function runTests() {
  try {
    // Test 1: Create a link
    const newLink = await testLinkCreation();
    
    // Test 2: Retrieve links
    await testLinkRetrieval();
    
    // Test 3: Click the created link
    if (newLink && newLink.slug) {
      await testLinkClick(newLink.slug);
    } else {
      await testLinkClick('test-link-123'); // Use the sample link from setup
    }
    
    console.log('\n🎉 All tests completed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

runTests();