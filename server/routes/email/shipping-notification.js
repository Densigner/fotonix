const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();

// Create transporter - using environment variables for SMTP
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Generate shipping notification HTML email
const generateShippingEmailHTML = (data) => {
  const {
    customerName,
    orderId,
    courierName,
    trackingNumber,
    trackingUrl,
    shippingAddress,
    numLayers,
    notes
  } = data;

  const trackingSection = trackingNumber ? `
    <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <h3 style="margin: 0 0 12px 0; color: #166534; font-size: 16px;">📦 Track Your Package</h3>
      <p style="margin: 0 0 8px 0; color: #374151;">
        <strong>Courier:</strong> ${courierName}
      </p>
      <p style="margin: 0 0 12px 0; color: #374151;">
        <strong>Tracking Number:</strong> 
        <code style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px; font-family: monospace;">${trackingNumber}</code>
      </p>
      ${trackingUrl ? `
        <a href="${trackingUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6, #ec4899); color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
          Track Your Package →
        </a>
      ` : ''}
    </div>
  ` : `
    <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; color: #166534;">
        <strong>Courier:</strong> ${courierName}
      </p>
    </div>
  `;

  const notesSection = notes ? `
    <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <h3 style="margin: 0 0 8px 0; color: #92400e; font-size: 14px;">📝 Note from Fotonix</h3>
      <p style="margin: 0; color: #78350f; font-size: 14px;">${notes}</p>
    </div>
  ` : '';

  const addressHtml = shippingAddress ? `
    <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <h3 style="margin: 0 0 12px 0; color: #374151; font-size: 14px;">🏠 Shipping To</h3>
      <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
        ${shippingAddress.name}<br>
        ${shippingAddress.addressLine1}<br>
        ${shippingAddress.addressLine2 ? shippingAddress.addressLine2 + '<br>' : ''}
        ${shippingAddress.city}<br>
        <strong>${shippingAddress.postcode}</strong>
      </p>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Stencils Have Been Shipped!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <img src="https://fotonix.co.uk/images/finaleditlogo.png" alt="Fotonix" style="height: 50px; width: auto;">
    </div>

    <!-- Main Card -->
    <div style="background: white; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
      <!-- Header Banner -->
      <div style="background: linear-gradient(135deg, #8b5cf6, #ec4899); padding: 32px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 12px;">🚚</div>
        <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 700;">Your Stencils Are On Their Way!</h1>
      </div>

      <!-- Content -->
      <div style="padding: 32px;">
        <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
          Hi ${customerName},
        </p>
        
        <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
          Great news! Your custom stencil order <strong>#${orderId}</strong> has been shipped and is on its way to you!
        </p>

        <!-- Order Summary -->
        <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h3 style="margin: 0 0 8px 0; color: #7c3aed; font-size: 14px;">🎨 Your Order</h3>
          <p style="margin: 0; color: #6b7280; font-size: 14px;">
            <strong>${numLayers}</strong> custom laser-cut stencil layer${numLayers !== 1 ? 's' : ''}<br>
            <span style="font-size: 12px;">Order ID: #${orderId}</span>
          </p>
        </div>

        ${trackingSection}
        
        ${notesSection}
        
        ${addressHtml}

        <!-- What's Next -->
        <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 24px;">
          <h3 style="margin: 0 0 12px 0; color: #374151; font-size: 16px;">🎉 What's Next?</h3>
          <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 1.8;">
            <li>Your stencils are precision laser-cut from high-quality mylar</li>
            <li>Each layer is numbered for easy alignment</li>
            <li>Use the Fotonix app to see the paint colours for each layer</li>
            <li>We can't wait to see your creation!</li>
          </ul>
        </div>

        <!-- App Promo -->
        <div style="background: linear-gradient(135deg, #8b5cf6, #ec4899); border-radius: 12px; padding: 24px; margin-top: 24px; text-align: center;">
          <h3 style="margin: 0 0 8px 0; color: white; font-size: 18px;">📱 Get the Fotonix App</h3>
          <p style="margin: 0 0 16px 0; color: rgba(255,255,255,0.9); font-size: 14px;">
            View your order & create more stencils on the go!
          </p>
          <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
            <a href="https://play.google.com/store/apps/details?id=com.densigner.fotonix" target="_blank" style="display: inline-block; background: white; color: #7c3aed; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              ▶ Google Play
            </a>
            <a href="https://apps.apple.com/us/app/fotonix/id6748742850" target="_blank" style="display: inline-block; background: white; color: #7c3aed; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 14px;">
               App Store
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 32px 20px; color: #9ca3af; font-size: 12px;">
      <p style="margin: 0 0 8px 0;">
        Questions? Contact us at <a href="mailto:support@fotonix.co.uk" style="color: #8b5cf6;">support@fotonix.co.uk</a>
      </p>
      <p style="margin: 0;">
        © ${new Date().getFullYear()} Fotonix. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `;
};

// Generate plain text version
const generateShippingEmailText = (data) => {
  const {
    customerName,
    orderId,
    courierName,
    trackingNumber,
    trackingUrl,
    shippingAddress,
    numLayers,
    notes
  } = data;

  let text = `
Your Stencils Have Been Shipped! 🚚

Hi ${customerName},

Great news! Your custom stencil order #${orderId} has been shipped and is on its way to you!

YOUR ORDER
${numLayers} custom laser-cut stencil layer${numLayers !== 1 ? 's' : ''}
Order ID: #${orderId}

TRACKING INFORMATION
Courier: ${courierName}
`;

  if (trackingNumber) {
    text += `Tracking Number: ${trackingNumber}\n`;
    if (trackingUrl) {
      text += `Track your package: ${trackingUrl}\n`;
    }
  }

  if (notes) {
    text += `\nNOTE FROM FOTONIX\n${notes}\n`;
  }

  if (shippingAddress) {
    text += `
SHIPPING TO
${shippingAddress.name}
${shippingAddress.addressLine1}
${shippingAddress.addressLine2 ? shippingAddress.addressLine2 + '\n' : ''}${shippingAddress.city}
${shippingAddress.postcode}
`;
  }

  text += `
WHAT'S NEXT?
- Your stencils are precision laser-cut from high-quality mylar
- Each layer is numbered for easy alignment
- Use the Fotonix app to see the paint colours for each layer
- We can't wait to see your creation!

GET THE FOTONIX APP
Android: https://play.google.com/store/apps/details?id=com.densigner.fotonix
iOS: https://apps.apple.com/us/app/fotonix/id6748742850

Questions? Contact us at support@fotonix.co.uk

© ${new Date().getFullYear()} Fotonix. All rights reserved.
`;

  return text;
};

// POST /api/email/shipping-notification
router.post('/', async (req, res) => {
  try {
    const {
      to,
      customerName,
      orderId,
      courierName,
      trackingNumber,
      trackingUrl,
      shippingAddress,
      numLayers,
      notes
    } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Customer email (to) is required' });
    }

    const emailData = {
      customerName: customerName || 'Valued Customer',
      orderId: orderId || 'Unknown',
      courierName: courierName || 'Courier',
      trackingNumber: trackingNumber || '',
      trackingUrl: trackingUrl || '',
      shippingAddress: shippingAddress || null,
      numLayers: numLayers || 1,
      notes: notes || ''
    };

    const htmlContent = generateShippingEmailHTML(emailData);
    const textContent = generateShippingEmailText(emailData);

    const transporter = createTransporter();

    const mailOptions = {
      from: `"Fotonix" <${process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@fotonix.co.uk'}>`,
      to: to,
      subject: `🚚 Your Stencils Have Been Shipped! Order #${orderId}`,
      html: htmlContent,
      text: textContent
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`Shipping notification sent to ${to} for order ${orderId}:`, info.messageId);

    res.json({ 
      success: true, 
      messageId: info.messageId,
      message: 'Shipping notification email sent successfully'
    });

  } catch (error) {
    console.error('Error sending shipping notification:', error);
    res.status(500).json({ 
      error: 'Failed to send shipping notification email',
      detail: error.message 
    });
  }
});

module.exports = router;
