const fetch = require('node-fetch');

async function createTestAccount() {
  try {
    console.log('Creating test account for Claudes...');
    
    // Test data
    const testData = {
      username: 'claude_test',
      businessName: 'claudes',
      storeName: 'claudesshop',
      customEmail: 'claude',
      email: 'claude.test@example.com', // Personal account email (not business email)
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!'
    };
    
    console.log('Test data:', {
      ...testData,
      password: '[HIDDEN]',
      confirmPassword: '[HIDDEN]'
    });
    
    // Create Firebase user first (simulated - you'd need to do this through the UI)
    console.log('\n⚠️  Note: You need to complete the signup through the UI at http://localhost:3001');
    console.log('Use these details in the signup form:');
    console.log('- Username: claude_test');
    console.log('- Business Name: claudes');
    console.log('- Store Name: claudesshop');
    console.log('- Custom Email: claude');
    console.log('- Account Email: claude.test@example.com');
    console.log('- Password: TestPassword123!');
    
    console.log('\nThis will create these business emails:');
    console.log('- no_reply.claudesshop@fotonix.co.uk');
    console.log('- theirchoice.claudesshop@fotonix.co.uk');
    console.log('- contact.claudesshop@fotonix.co.uk');
    console.log('- claude.claudesshop@fotonix.co.uk');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createTestAccount();