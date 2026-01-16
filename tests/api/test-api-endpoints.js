const http = require('http');

async function testAffiliateStatsAPI() {
  console.log('Testing affiliate stats API...');
  
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:5002/api/affiliate/stats?user=test123', (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Response status:', res.statusCode);
        console.log('Response headers:', res.headers);
        
        if (res.statusCode === 200) {
          try {
            const jsonData = JSON.parse(data);
            console.log('✅ API Response successful!');
            console.log('📊 Summary:', jsonData.summary);
            console.log('📈 Daily data points:', jsonData.daily?.length || 0);
            console.log('📊 Channels:', jsonData.channels?.length || 0);
            console.log('🔗 Top links:', jsonData.top_links?.length || 0);
            console.log('🌐 Referrers:', jsonData.referrers?.length || 0);
            resolve(jsonData);
          } catch (e) {
            console.log('❌ Invalid JSON response:', e.message);
            console.log('Raw response:', data);
            reject(e);
          }
        } else {
          console.log('❌ HTTP Error:', res.statusCode);
          console.log('Response:', data);
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      console.log('❌ Request failed:', err.message);
      reject(err);
    });

    req.setTimeout(10000, () => {
      console.log('❌ Request timeout');
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Also test member stats
async function testMemberStatsAPI() {
  console.log('\nTesting member stats API...');
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5002,
      path: '/api/member/stats',
      method: 'GET',
      headers: {
        'x-member-uid': 'current-member-id'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Response status:', res.statusCode);
        
        if (res.statusCode === 200) {
          try {
            const jsonData = JSON.parse(data);
            console.log('✅ Member stats successful!');
            console.log('💰 Total Sales:', jsonData.totalSales);
            console.log('💵 Commissions:', jsonData.commissions);
            console.log('📊 Avg Rate:', jsonData.averageCommissionRate + '%');
            resolve(jsonData);
          } catch (e) {
            console.log('❌ Invalid JSON response:', e.message);
            console.log('Raw response:', data);
            reject(e);
          }
        } else {
          console.log('❌ HTTP Error:', res.statusCode);
          console.log('Response:', data);
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      console.log('❌ Request failed:', err.message);
      reject(err);
    });

    req.setTimeout(10000, () => {
      console.log('❌ Request timeout');
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.end();
  });
}

async function runTests() {
  try {
    // Wait a bit for server to be ready
    console.log('Waiting for server to be ready...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await testAffiliateStatsAPI();
    await testMemberStatsAPI();
    
    console.log('\n🎉 All API tests passed! PostgreSQL integration is working!');
  } catch (error) {
    console.error('\n❌ Tests failed:', error.message);
  }
}

runTests();