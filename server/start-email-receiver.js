/**
 * Start the email receiver service
 * This should run as a separate process to continuously poll for incoming emails
 */

require('dotenv').config();
const EmailReceiver = require('./email-receiver');

// IMAP configuration - you need to set these in your .env file
const config = {
  host: process.env.IMAP_HOST || 'mail.fotonix.co.uk',
  port: parseInt(process.env.IMAP_PORT || '993'),
  user: process.env.IMAP_USER || 'catchall@fotonix.co.uk',
  password: process.env.IMAP_PASSWORD,
  tls: process.env.IMAP_TLS !== 'false'
};

if (!config.password) {
  console.error('❌ IMAP_PASSWORD not set in .env file!');
  console.error('   Add the following to your .env:');
  console.error('   IMAP_HOST=mail.fotonix.co.uk');
  console.error('   IMAP_PORT=993');
  console.error('   IMAP_USER=catchall@fotonix.co.uk');
  console.error('   IMAP_PASSWORD=your_password_here');
  process.exit(1);
}

const receiver = new EmailReceiver(config);

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down email receiver...');
  receiver.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down email receiver...');
  receiver.stop();
  process.exit(0);
});

// Start the receiver
receiver.start();

console.log('');
console.log('📧 Email Receiver Service');
console.log('========================');
console.log('Press Ctrl+C to stop');
console.log('');
