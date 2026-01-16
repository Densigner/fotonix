/**
 * Test SMTP sending directly to diagnose delivery issues
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

async function testSMTP() {
  console.log('🧪 Testing SMTP Configuration\n');
  console.log('SMTP Settings:');
  console.log('  Host:', process.env.MAIL_HOST);
  console.log('  Port:', process.env.MAIL_PORT);
  console.log('  User:', process.env.MAIL_USERNAME);
  console.log('  From:', process.env.MAIL_FROM_ADDRESS);
  console.log('');

  const transport = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT) || 587,
    secure: process.env.MAIL_USE_TLS === 'true',
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    },
    debug: true, // Enable debug output
    logger: true  // Enable logger
  });

  try {
    console.log('📡 Testing SMTP connection...');
    await transport.verify();
    console.log('✅ SMTP connection verified!\n');

    console.log('📧 Sending test email...');
    const info = await transport.sendMail({
      from: `"Fotonix Test" <${process.env.MAIL_FROM_ADDRESS}>`,
      to: 'joshmarsden28@gmail.com',
      subject: 'SMTP Test - ' + new Date().toISOString(),
      text: 'This is a test email to verify SMTP is working correctly.',
      html: '<h1>SMTP Test</h1><p>This is a test email to verify SMTP is working correctly.</p>'
    });

    console.log('✅ Email sent successfully!');
    console.log('   Message ID:', info.messageId);
    console.log('   Response:', info.response);
    console.log('   Accepted:', info.accepted);
    console.log('   Rejected:', info.rejected);

  } catch (error) {
    console.error('\n❌ SMTP Error:', error.message);
    console.error('\n   Code:', error.code);
    console.error('   Command:', error.command);
    
    if (error.message.includes('authentication') || error.message.includes('auth')) {
      console.error('\n💡 Authentication failed - check MAIL_USERNAME and MAIL_PASSWORD');
    }
    
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
      console.error('\n💡 Connection refused - check MAIL_HOST and MAIL_PORT, verify firewall');
    }

    process.exit(1);
  }
}

testSMTP();
