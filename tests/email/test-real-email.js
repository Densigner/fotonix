#!/usr/bin/env node

/**
 * Send Real Test Email via VPS Mail Server
 * This will send an actual email to confirm end-to-end delivery
 */

const fetch = require('node-fetch');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function sendTestEmail() {
  console.log('📧 VPS Mail Server - Real Email Test\n');
  
  // Prompt for email address
  const emailAddress = await new Promise((resolve) => {
    rl.question('Enter your email address to receive the test email: ', (answer) => {
      resolve(answer.trim());
    });
  });
  
  if (!emailAddress || !emailAddress.includes('@')) {
    console.log('❌ Invalid email address');
    rl.close();
    return;
  }
  
  console.log(`\n🚀 Sending test email to: ${emailAddress}`);
  console.log('📡 Via VPS: mail.fotonix.co.uk');
  
  const testEmailData = {
    to: emailAddress,
    subject: '🎉 VPS Mail Server Successfully Configured!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 15px; overflow: hidden;">
        <!-- Header -->
        <div style="padding: 40px 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">🎉 Success!</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">Your VPS Mail Server is Working Perfectly</p>
        </div>
        
        <!-- Content -->
        <div style="background: white; color: #333; padding: 40px 30px;">
          <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            <strong>Congratulations!</strong>
          </p>
          
          <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            This email was successfully sent through your custom VPS mail server, confirming that your complete email infrastructure is working perfectly.
          </p>
          
          <div style="background: #f8f9ff; border: 2px solid #667eea; border-radius: 10px; padding: 25px; margin: 25px 0;">
            <h3 style="margin: 0 0 15px 0; color: #667eea;">✅ What's Now Working:</h3>
            <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
              <li><strong>VPS Mail Server</strong> - Ubuntu 25.04 on OVH (mail.fotonix.co.uk)</li>
              <li><strong>SMTP Authentication</strong> - Secure email sending</li>
              <li><strong>DNS Configuration</strong> - A, MX, SPF, DKIM, DMARC records</li>
              <li><strong>Website Integration</strong> - React app can send emails</li>
              <li><strong>Email Delivery</strong> - End-to-end delivery confirmed</li>
              <li><strong>Professional Setup</strong> - Custom domain email system</li>
            </ul>
          </div>
          
          <div style="background: #fff9e6; border: 2px solid #ffd700; border-radius: 10px; padding: 20px; margin: 25px 0;">
            <h4 style="margin: 0 0 10px 0; color: #b8860b;">📊 Technical Details:</h4>
            <p style="margin: 0; line-height: 1.6; color: #666; font-size: 14px;">
              <strong>VPS Server:</strong> vps-603c4873.vps.ovh.net (51.75.78.118)<br>
              <strong>Mail Host:</strong> mail.fotonix.co.uk:587<br>
              <strong>From Address:</strong> noreply@fotonix.co.uk<br>
              <strong>Authentication:</strong> SMTP with TLS<br>
              <strong>Sent:</strong> ${new Date().toLocaleString()}
            </p>
          </div>
          
          <p style="font-size: 16px; line-height: 1.6; margin: 20px 0;">
            Your email infrastructure is now completely independent and professional. You can send transactional emails, newsletters, and notifications directly through your own VPS without relying on third-party services.
          </p>
          
          <p style="font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
            <strong>Next steps:</strong> Monitor deliverability, set up email monitoring, and consider adding additional security measures for production use.
          </p>
        </div>
        
        <!-- Footer -->
        <div style="background: #f8f9ff; padding: 20px 30px; text-align: center; color: #666; font-size: 14px;">
          <p style="margin: 0;">
            Email sent via custom VPS mail server - mail.fotonix.co.uk
          </p>
        </div>
      </div>
    `,
    text: `
🎉 VPS Mail Server Successfully Configured!

Congratulations! This email was successfully sent through your custom VPS mail server.

✅ What's Now Working:
• VPS Mail Server - Ubuntu 25.04 on OVH (mail.fotonix.co.uk)
• SMTP Authentication - Secure email sending  
• DNS Configuration - A, MX, SPF, DKIM, DMARC records
• Website Integration - React app can send emails
• Email Delivery - End-to-end delivery confirmed
• Professional Setup - Custom domain email system

📊 Technical Details:
VPS Server: vps-603c4873.vps.ovh.net (51.75.78.118)
Mail Host: mail.fotonix.co.uk:587
From Address: noreply@fotonix.co.uk
Authentication: SMTP with TLS
Sent: ${new Date().toLocaleString()}

Your email infrastructure is now completely independent and professional!

Next steps: Monitor deliverability, set up email monitoring, and consider adding additional security measures for production use.

---
Email sent via custom VPS mail server - mail.fotonix.co.uk
    `.trim()
  };
  
  try {
    console.log('📤 Sending email...');
    
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
      console.log('✅ Email sent successfully!');
      console.log(`📧 Message ID: ${result.messageId}`);
      console.log(`📬 Sent to: ${result.to}`);
      console.log(`🌐 Via VPS: ${result.vpsHost}`);
      console.log('\n🔍 Check your email inbox (including spam folder)');
      console.log('📱 The email should arrive within 1-2 minutes');
      
      // Check if it's in spam
      console.log('\n💡 Tip: If you don\'t see it in your inbox:');
      console.log('   1. Check your spam/junk folder');
      console.log('   2. Add noreply@fotonix.co.uk to your contacts');
      console.log('   3. Mark as "Not Spam" if found there');
      console.log('   4. This will improve future deliverability');
      
    } else {
      console.log('❌ Failed to send email:', result.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Make sure the server is running:');
      console.log('   npm run start:server');
    }
  }
  
  rl.close();
}

// Run the test
sendTestEmail().catch(console.error);