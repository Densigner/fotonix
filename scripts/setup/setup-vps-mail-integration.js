#!/usr/bin/env node

/**
 * VPS Mail Server Setup Script
 * Run this after setting up your OVH VPS mail server
 */

const { query } = require('./src/db/client');
const { testConnection, sendTestEmail } = require('./src/email/smtp');

async function setupVpsMailServer() {
  console.log('🚀 Setting up VPS Mail Server integration...\n');

  try {
    // Step 1: Check if tenants table exists and create default tenant
    console.log('1️⃣  Setting up tenant...');
    await query(`
      INSERT INTO tenants (id, name, slug) 
      VALUES (1, 'Fotonix', 'fotonix')
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug
    `);
    console.log('✅ Default tenant configured');

    // Step 2: Get VPS configuration from environment or prompt
    const vpsConfig = {
      host: process.env.MAIL_HOST || 'mail.your-domain.com',
      port: parseInt(process.env.MAIL_PORT) || 587,
      username: process.env.MAIL_USERNAME || 'noreply@your-domain.com',
      password: process.env.MAIL_PASSWORD || 'your-secure-password',
      fromName: process.env.MAIL_FROM_NAME || 'Fotonix',
      fromAddress: process.env.MAIL_FROM_ADDRESS || 'noreply@your-domain.com',
      useTls: process.env.MAIL_USE_TLS === 'true',
      useStarttls: process.env.MAIL_USE_STARTTLS !== 'false',
      rateLimit: parseInt(process.env.MAIL_RATE_LIMIT) || 60
    };

    console.log('2️⃣  Configuring SMTP credentials...');
    console.log(`   📧 Host: ${vpsConfig.host}:${vpsConfig.port}`);
    console.log(`   👤 From: ${vpsConfig.fromName} <${vpsConfig.fromAddress}>`);

    // Step 3: Update SMTP credentials in database
    await query(`
      INSERT INTO smtp_credentials (
        tenant_id, provider, host, port, username, password_encrypted,
        from_name, from_address, use_tls, use_starttls, rate_limit_per_minute
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (tenant_id, from_address) DO UPDATE SET
        provider = EXCLUDED.provider,
        host = EXCLUDED.host,
        port = EXCLUDED.port,
        username = EXCLUDED.username,
        password_encrypted = EXCLUDED.password_encrypted,
        from_name = EXCLUDED.from_name,
        use_tls = EXCLUDED.use_tls,
        use_starttls = EXCLUDED.use_starttls,
        rate_limit_per_minute = EXCLUDED.rate_limit_per_minute
    `, [
      1, // tenant_id
      'smtp',
      vpsConfig.host,
      vpsConfig.port,
      vpsConfig.username,
      vpsConfig.password, // In production, encrypt this!
      vpsConfig.fromName,
      vpsConfig.fromAddress,
      vpsConfig.useTls,
      vpsConfig.useStarttls,
      vpsConfig.rateLimit
    ]);
    console.log('✅ SMTP credentials saved to database');

    // Step 4: Add email identities for DMARC compliance
    console.log('3️⃣  Setting up email identities...');
    const domain = vpsConfig.fromAddress.split('@')[1];
    
    await query(`
      INSERT INTO email_identities (tenant_id, type, identity, is_verified)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (tenant_id, identity) DO UPDATE SET
        is_verified = EXCLUDED.is_verified
    `, [1, 'domain', domain, true]);

    await query(`
      INSERT INTO email_identities (tenant_id, type, identity, is_verified)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (tenant_id, identity) DO UPDATE SET
        is_verified = EXCLUDED.is_verified
    `, [1, 'address', vpsConfig.fromAddress, true]);

    console.log(`✅ Email identities configured for ${domain}`);

    // Step 5: Test the connection
    console.log('4️⃣  Testing SMTP connection...');
    const connectionTest = await testConnection(1);
    
    if (connectionTest.success) {
      console.log('✅ SMTP connection test successful!');
      console.log(`   🔗 Connected to ${connectionTest.config.host}:${connectionTest.config.port}`);
    } else {
      console.error('❌ SMTP connection test failed:');
      console.error(`   🔥 ${connectionTest.error}`);
      console.log('\n📝 Troubleshooting tips:');
      console.log('   • Check your VPS mail server is running');
      console.log('   • Verify DNS records (A, MX, SPF, DKIM, DMARC)');
      console.log('   • Confirm firewall allows SMTP ports (25, 587, 465)');
      console.log('   • Check username/password are correct');
      return;
    }

    // Step 6: Send test email (optional)
    const testEmail = process.env.TEST_EMAIL;
    if (testEmail) {
      console.log('5️⃣  Sending test email...');
      const emailTest = await sendTestEmail(1, testEmail, 'VPS Mail Server Setup Complete! 🎉');
      
      if (emailTest.success) {
        console.log(`✅ Test email sent to ${testEmail}`);
        console.log(`   📧 Message ID: ${emailTest.messageId}`);
      } else {
        console.error(`❌ Test email failed: ${emailTest.error}`);
      }
    } else {
      console.log('5️⃣  Skipping test email (set TEST_EMAIL env var to send one)');
    }

    console.log('\n🎉 VPS Mail Server setup complete!');
    console.log('\n📊 Next steps:');
    console.log('   • Set up DNS records (SPF, DKIM, DMARC) on your domain');
    console.log('   • Configure webhook endpoints for bounce/complaint handling');
    console.log('   • Set up monitoring for your mail server');
    console.log('   • Test email delivery to major providers (Gmail, Outlook)');
    console.log('\n🔗 API Endpoints available:');
    console.log('   • POST /api/emails/send - Send individual emails');
    console.log('   • POST /api/emails/send-bulk - Send bulk campaigns');
    console.log('   • GET /api/emails/stats - Email statistics');
    console.log('   • GET /api/smtp/test-connection - Test SMTP connection');
    console.log('   • POST /api/smtp/test-email - Send test email');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the setup if called directly
if (require.main === module) {
  setupVpsMailServer()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupVpsMailServer };