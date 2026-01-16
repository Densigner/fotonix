const nodemailer = require('nodemailer');
const { query } = require('../db/client');

async function loadTransport(tenantId, fromAddress = null) {
  // First try to load from database
  try {
    // If specific fromAddress requested, try to find exact match first
    let sqlQuery = `select * from smtp_credentials where tenant_id=$1`;
    let params = [tenantId];
    
    if (fromAddress) {
      sqlQuery += ` and from_address=$2`;
      params.push(fromAddress);
    }
    sqlQuery += ` order by id asc limit 1`;
    
    let { rows } = await query(sqlQuery, params);
    
    // If no exact match and fromAddress was specified, fall back to default
    if (rows.length === 0 && fromAddress) {
      const { rows: fallbackRows } = await query(
        `select * from smtp_credentials where tenant_id=$1 order by id asc limit 1`, 
        [tenantId]
      );
      rows = fallbackRows;
    }
    
    if (rows.length > 0) {
      const c = rows[0];
      
      if (c.provider !== 'smtp') {
        throw new Error(`Only 'smtp' provider implemented in this demo`);
      }

      const transport = nodemailer.createTransport({
        host: c.host,
        port: c.port,
        secure: !!c.use_tls, // true for 465, false for other ports
        auth: c.username ? { 
          user: c.username, 
          pass: (c.password_encrypted == null ? undefined : String(c.password_encrypted)) 
        } : undefined,
        tls: c.use_starttls ? { 
          ciphers: 'SSLv3',
          rejectUnauthorized: false // Allow self-signed certificates for VPS setup
        } : undefined,
        connectionTimeout: 60000, // 1 minute
        greetingTimeout: 30000, // 30 seconds
        socketTimeout: 60000, // 1 minute
      });

      const defaultFrom = c.from_name ? `${c.from_name} <${c.from_address}>` : c.from_address;
      
      // If a specific fromAddress was requested and it's different from stored config,
      // override the from address but keep same SMTP credentials
      const actualFrom = fromAddress ? 
        (c.from_name ? `${c.from_name} <${fromAddress}>` : fromAddress) : 
        defaultFrom;
      
      // Verify the connection
      await transport.verify();
      console.log('✅ SMTP connection verified for tenant:', tenantId, 'from:', actualFrom);
      
      return { transport, defaultFrom: actualFrom, config: c };
    }
  } catch (dbError) {
    console.warn('Database SMTP config failed, falling back to environment variables:', dbError.message);
  }

  // Fallback to environment variables for VPS mail server
  if (!process.env.MAIL_HOST) {
    throw new Error('No SMTP credentials configured for tenant and no environment fallback');
  }

  const transport = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT) || 587,
    secure: process.env.MAIL_USE_TLS === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD
    },
    tls: process.env.MAIL_USE_STARTTLS === 'true' ? { 
      ciphers: 'SSLv3',
      rejectUnauthorized: false // Allow self-signed certificates for VPS setup
    } : undefined,
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
  });

  const defaultFrom = process.env.MAIL_FROM_NAME ? 
    `${process.env.MAIL_FROM_NAME} <${fromAddress || process.env.MAIL_FROM_ADDRESS}>` : 
    (fromAddress || process.env.MAIL_FROM_ADDRESS);

  // Verify the connection
  await transport.verify();
  console.log('✅ SMTP connection verified using environment variables');

  return { 
    transport, 
    defaultFrom, 
    config: {
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      provider: 'smtp'
    }
  };
}

// Function to test SMTP connection
async function testConnection(tenantId = null) {
  try {
    const { transport, config } = await loadTransport(tenantId || 1);
    const result = await transport.verify();
    await transport.close();
    
    return {
      success: true,
      config: {
        host: config.host,
        port: config.port,
        provider: config.provider
      },
      message: 'SMTP connection successful'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'SMTP connection failed'
    };
  }
}

// Function to send a test email
async function sendTestEmail(tenantId, toEmail, subject = 'Test Email from VPS Mail Server') {
  try {
    const { transport, defaultFrom } = await loadTransport(tenantId);
    
    const info = await transport.sendMail({
      from: defaultFrom,
      to: toEmail,
      subject: subject,
      html: `
        <h2>🎉 VPS Mail Server Test</h2>
        <p>Congratulations! Your VPS mail server is working correctly.</p>
        <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
        <p><strong>Tenant ID:</strong> ${tenantId}</p>
        <hr>
        <p><small>This is a test email from your Fotonix VPS mail server.</small></p>
      `,
      text: `VPS Mail Server Test\n\nCongratulations! Your VPS mail server is working correctly.\n\nSent at: ${new Date().toISOString()}\nTenant ID: ${tenantId}\n\nThis is a test email from your Fotonix VPS mail server.`
    });

    await transport.close();
    
    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
      message: 'Test email sent successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'Test email failed to send'
    };
  }
}

module.exports = { loadTransport, testConnection, sendTestEmail };