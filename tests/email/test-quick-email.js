#!/usr/bin/env node

/**
 * Quick Real Email Test
 * Replace YOUR_EMAIL with your actual email address
 */

const fetch = require('node-fetch');

// 🔧 CHANGE THIS TO YOUR EMAIL ADDRESS
const YOUR_EMAIL = 'joshmarsden28@gmail.com';

async function sendQuickTest() {
  console.log('📧 Sending real test email via VPS mail server...\n');
  
  if (YOUR_EMAIL === 'your.email@example.com') {
    console.log('❌ Please edit test-quick-email.js and change YOUR_EMAIL to your actual email address');
    console.log('   Then run: node test-quick-email.js');
    return;
  }
  
  const testEmailData = {
    to: YOUR_EMAIL,
    subject: '🎉 VPS Mail Server Test - Success!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #4CAF50; border-radius: 10px;">
        <h1 style="color: #4CAF50; text-align: center;">🎉 VPS Mail Server Working!</h1>
        
        <p><strong>Congratulations!</strong> This email was successfully sent through your custom VPS mail server.</p>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>✅ Confirmed Working:</h3>
          <ul>
            <li>VPS Mail Server (mail.fotonix.co.uk)</li>
            <li>SMTP Authentication</li>
            <li>DNS Configuration</li>
            <li>Email Delivery</li>
            <li>Website Integration</li>
          </ul>
        </div>
        
        <p><strong>Technical Details:</strong></p>
        <ul>
          <li>VPS: vps-603c4873.vps.ovh.net (51.75.78.118)</li>
          <li>Mail Server: mail.fotonix.co.uk:587</li>
          <li>From: noreply@fotonix.co.uk</li>
          <li>Sent: ${new Date().toLocaleString()}</li>
        </ul>
        
        <p style="color: #4CAF50; font-weight: bold;">Your VPS mail server is fully operational! 🚀</p>
      </div>
    `,
    text: `
🎉 VPS Mail Server Test - Success!

Congratulations! This email was successfully sent through your custom VPS mail server.

✅ Confirmed Working:
• VPS Mail Server (mail.fotonix.co.uk)
• SMTP Authentication
• DNS Configuration  
• Email Delivery
• Website Integration

Technical Details:
• VPS: vps-603c4873.vps.ovh.net (51.75.78.118)
• Mail Server: mail.fotonix.co.uk:587
• From: noreply@fotonix.co.uk
• Sent: ${new Date().toLocaleString()}

Your VPS mail server is fully operational! 🚀
    `.trim()
  };
  
  try {
    console.log(`📤 Sending to: ${YOUR_EMAIL}`);
    console.log('📡 Via VPS: mail.fotonix.co.uk');
    
    const response = await fetch('http://localhost:4000/api/tenants/1/campaigns/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testEmailData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log('\n✅ EMAIL SENT SUCCESSFULLY!');
      console.log(`📧 Message ID: ${result.messageId}`);
      console.log(`📬 Recipient: ${result.to}`);
      console.log(`🌐 VPS Host: ${result.vpsHost}`);
      
      console.log('\n🔍 Check your email inbox now!');
      console.log('📱 Email should arrive within 1-2 minutes');
      console.log('⚠️  If not in inbox, check spam folder');
      
      console.log('\n🎊 VPS MAIL SERVER FULLY OPERATIONAL! 🎊');
      
    } else {
      console.log('❌ Failed to send email:', result.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Make sure the server is running with: npm run start:server');
    }
  }
}

sendQuickTest().catch(console.error);