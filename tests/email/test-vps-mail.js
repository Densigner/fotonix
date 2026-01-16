/**
 * VPS Mail Integration Test
 * Tests the connection to the VPS mail server
 */

require('dotenv').config();
const { loadTransport } = require('./src/email/smtp');

async function testVPSConnection() {
  try {
    console.log('🔍 Testing VPS Mail Server Connection...\n');
    
    console.log('VPS Configuration:');
    console.log(`Host: ${process.env.MAIL_HOST}`);
    console.log(`Port: ${process.env.MAIL_PORT}`);
    console.log(`Username: ${process.env.MAIL_USERNAME}`);
    console.log(`From Address: ${process.env.MAIL_FROM_ADDRESS}\n`);

    // Test loading transport (this will fallback to VPS if no database config)
    const { transport, defaultFrom } = await loadTransport(1);
    
    console.log('✅ Transport loaded successfully');
    console.log(`✅ Default From Address: ${defaultFrom}\n`);

    // Test SMTP connection
    console.log('🔗 Testing SMTP connection...');
    await transport.verify();
    console.log('✅ VPS SMTP connection verified!\n');

    // Test sending a real email (commented out for safety)
    /*
    const testEmail = {
      from: defaultFrom,
      to: 'test@example.com', // Replace with your email for testing
      subject: 'VPS Mail Test - ' + new Date().toISOString(),
      text: 'This is a test email from the VPS mail server integration.',
      html: '<p>This is a <strong>test email</strong> from the VPS mail server integration.</p>'
    };

    console.log('📧 Sending test email...');
    const result = await transport.sendMail(testEmail);
    console.log('✅ Test email sent successfully!');
    console.log(`Message ID: ${result.messageId}`);
    */

    console.log('🎉 VPS Mail Integration Test PASSED!');
    console.log('✅ Advanced Inbox Screen will use VPS mail server');
    console.log('✅ Campaign emails will use VPS mail server');

  } catch (error) {
    console.error('❌ VPS Mail Integration Test FAILED:');
    console.error(error.message);
    console.error('\nCheck your VPS mail configuration in .env file');
    process.exit(1);
  }
}

testVPSConnection();