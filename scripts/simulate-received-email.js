/**
 * Send a test email through the API to simulate receiving an email
 */

require('dotenv').config();
const axios = require('axios');

async function sendTestReply() {
  console.log('📧 Simulating received email from Gmail...\n');

  const testEmail = {
    from: 'joshmarsden28@gmail.com',
    to: ['contact.fffff@fotonix.co.uk'],
    subject: 'RE: Your inquiry about Fotonix services',
    html: `
      <div style="font-family: Arial, sans-serif;">
        <p>Hi there,</p>
        <p>Thanks for reaching out! I'd love to discuss your design needs.</p>
        <p>Could you please provide more details about:</p>
        <ul>
          <li>The type of project you're working on</li>
          <li>Your timeline</li>
          <li>Your budget range</li>
        </ul>
        <p>Looking forward to hearing from you!</p>
        <p>Best regards,<br>Josh</p>
      </div>
    `,
    text: `Hi there,

Thanks for reaching out! I'd love to discuss your design needs.

Could you please provide more details about:
- The type of project you're working on
- Your timeline
- Your budget range

Looking forward to hearing from you!

Best regards,
Josh`,
    headers: {
      'message-id': '<reply-' + Date.now() + '@gmail.com>',
      'in-reply-to': '<original-inquiry@fotonix.co.uk>',
      'references': ['<original-inquiry@fotonix.co.uk>']
    }
  };

  try {
    const response = await axios.post(
      'http://localhost:4000/api/email/receive-webhook',
      testEmail,
      {
        headers: {
          'X-Webhook-Secret': process.env.WEBHOOK_SECRET || 'fotonix-webhook-secret-2024'
        }
      }
    );

    console.log('✅ Email received successfully!');
    console.log('   Response:', JSON.stringify(response.data, null, 2));
    console.log('');
    console.log('📬 Check your inbox at: http://localhost:3000/email/inbox');
    console.log('   Or run: node scripts/check-inbound-emails.js');

  } catch (error) {
    console.error('❌ Failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

sendTestReply();
