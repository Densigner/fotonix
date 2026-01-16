const express = require('express');
const router = express.Router();
const { getClient } = require('../../paypal');
const admin = require('../../firebase-admin');
const nodemailer = require('nodemailer');

// SMTP config for order notifications
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};

/**
 * Get member's personal email address
 * First tries Firebase Auth (their login email)
 * Falls back to business_emails.forward_to_email if available
 */
async function getMemberEmail(memberUid) {
  try {
    // Try Firebase Auth first - this is their personal login email
    const userRecord = await admin.auth().getUser(memberUid);
    if (userRecord && userRecord.email) {
      console.log(`✅ Found member email from Firebase Auth: ${userRecord.email}`);
      return userRecord.email;
    }
  } catch (err) {
    console.warn('Could not get email from Firebase Auth:', err.message);
  }

  // Fallback: try to get from business_emails.forward_to_email (PostgreSQL)
  try {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query(
      'SELECT forward_to_email FROM business_emails WHERE member_uid = $1 LIMIT 1',
      [memberUid]
    );
    await pool.end();
    
    if (result.rows.length > 0 && result.rows[0].forward_to_email) {
      console.log(`✅ Found member email from business_emails: ${result.rows[0].forward_to_email}`);
      return result.rows[0].forward_to_email;
    }
  } catch (err) {
    console.warn('Could not get email from business_emails:', err.message);
  }

  return null;
}

/**
 * Get product details from Firebase to find owner
 */
async function getProductOwner(productId) {
  try {
    const db = admin.database();
    
    // Products are stored at products/{ownerId}/{productId}
    // So we need to search across all owners
    const productsRef = db.ref('products');
    const snapshot = await productsRef.once('value');
    
    if (!snapshot.exists()) return null;
    
    const allProducts = snapshot.val();
    
    // Search through all owner's products
    for (const [ownerId, ownerProducts] of Object.entries(allProducts)) {
      if (ownerProducts && ownerProducts[productId]) {
        console.log(`✅ Found product ${productId} owned by ${ownerId}`);
        return {
          ownerId,
          product: ownerProducts[productId]
        };
      }
    }
    
    return null;
  } catch (err) {
    console.error('Error fetching product owner:', err.message);
    return null;
  }
}

/**
 * Send order notification email to product owner
 */
async function sendOwnerNotification(orderData) {
  try {
    if (!SMTP_CONFIG.auth.user || !SMTP_CONFIG.auth.pass) {
      console.warn('⚠️  SMTP not configured - skipping owner notification email');
      return;
    }

    const { ownerEmail, productTitle, amount, currency, buyerEmail, orderId, paypalOrderId } = orderData;
    
    if (!ownerEmail) {
      console.warn('⚠️  No owner email found - skipping notification');
      return;
    }

    const transporter = nodemailer.createTransport(SMTP_CONFIG);
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #7c3aed;">🎉 You made a sale!</h1>
        
        <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <h2 style="margin-top: 0; color: #1f2937;">${productTitle || 'Your Product'}</h2>
          <p style="font-size: 24px; font-weight: bold; color: #059669; margin: 10px 0;">
            ${currency || '£'}${typeof amount === 'number' ? amount.toFixed(2) : amount}
          </p>
          <p style="color: #6b7280; margin: 0;">Order ID: ${orderId || paypalOrderId || 'N/A'}</p>
        </div>
        
        <h3 style="color: #1f2937;">Order Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Buyer Email</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${buyerEmail || 'Not provided'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">PayPal Order</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${paypalOrderId || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Time</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${new Date().toLocaleString('en-GB')}</td>
          </tr>
        </table>
        
        <div style="background: linear-gradient(135deg, #7c3aed, #db2777); color: white; padding: 20px; border-radius: 12px; margin-top: 20px; text-align: center;">
          <p style="margin: 0 0 10px 0;">View all your orders in your dashboard</p>
          <a href="${process.env.APP_URL || 'https://fotonix.co.uk'}/members" 
             style="display: inline-block; background: white; color: #7c3aed; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Go to Dashboard
          </a>
        </div>
        
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 30px;">
          You're receiving this because someone purchased your product on Fotonix.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Fotonix Sales" <${SMTP_CONFIG.auth.user}>`,
      to: ownerEmail,
      subject: `🎉 New Sale: ${productTitle || 'Your Product'} - ${currency || '£'}${typeof amount === 'number' ? amount.toFixed(2) : amount}`,
      html
    });

    console.log(`✅ Owner notification email sent to ${ownerEmail}`);
  } catch (error) {
    console.error('❌ Failed to send owner notification email:', error.message);
    // Don't throw - email failure shouldn't fail the order capture
  }
}

router.post('/api/paypal/capture-order', async (req, res) => {
  try {
    const { orderId, productId, ownerId: providedOwnerId } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'orderId required' });
    
    const client = getClient();
    const OrdersCaptureRequest = require('@paypal/checkout-server-sdk').orders.OrdersCaptureRequest;
    const request = new OrdersCaptureRequest(orderId);
    request.prefer('return=representation');
    const resp = await client.execute(request);
    const result = resp.result || resp;
    
    // Send notification to product owner (non-blocking)
    (async () => {
      try {
        let ownerId = providedOwnerId;
        let productTitle = 'Fotonix Product';
        
        // If productId provided, look up the owner
        if (productId) {
          const productInfo = await getProductOwner(productId);
          if (productInfo) {
            ownerId = productInfo.ownerId;
            productTitle = productInfo.product?.title || productTitle;
          }
        }
        
        if (ownerId) {
          const ownerEmail = await getMemberEmail(ownerId);
          if (ownerEmail) {
            // Extract payment details from PayPal response
            const captureData = result.purchase_units?.[0]?.payments?.captures?.[0];
            const amount = captureData?.amount?.value || result.purchase_units?.[0]?.amount?.value;
            const currency = captureData?.amount?.currency_code || result.purchase_units?.[0]?.amount?.currency_code || 'GBP';
            const buyerEmail = result.payer?.email_address;
            
            await sendOwnerNotification({
              ownerEmail,
              productTitle,
              amount: parseFloat(amount),
              currency: currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency,
              buyerEmail,
              orderId: productId,
              paypalOrderId: orderId
            });
          }
        }
      } catch (notifyErr) {
        console.error('Error in owner notification:', notifyErr.message);
      }
    })();
    
    res.json(result);
  } catch (e) {
    console.error('capture-order error', e);
    res.status(500).json({ error: String(e) });
  }
});

module.exports = router;
