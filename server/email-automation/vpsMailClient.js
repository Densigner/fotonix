/**
 * VPS Mail Client
 * 
 * Handles actual email sending via VPS SMTP server
 * Processes queued emails and sends them using configured mail client
 */

const nodemailer = require('nodemailer');
const admin = require('firebase-admin');
const crypto = require('crypto');
const db = admin.database();

class VPSMailClient {
  constructor() {
    this.transporter = null;
    this.isInitialized = false;
  }

  /**
   * Initialize SMTP transporter with VPS credentials
   */
  async initialize() {
    try {
      // Fetch SMTP configuration from Firebase
      const smtpConfigRef = db.ref('system/smtpConfig');
      const snapshot = await smtpConfigRef.once('value');
      const config = snapshot.val();

      if (!config) {
        console.error('❌ SMTP configuration not found in database');
        return false;
      }

      this.transporter = nodemailer.createTransport({
        host: config.host || 'smtp.fotonix.co.uk',
        port: config.port || 587,
        secure: config.secure || false,
        auth: {
          user: config.user,
          pass: config.password
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verify connection
      await this.transporter.verify();
      this.isInitialized = true;
      console.log('✅ VPS Mail Client initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize VPS Mail Client:', error);
      return false;
    }
  }

  /**
   * Send email with template
   */
  async sendEmail(emailData) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const { to, subject, template, data, storeId, campaignId, emailId, customerId } = emailData;

      // Load store branding
      const storeBranding = await this.getStoreBranding(storeId);
      
      // Load email template
      let emailHtml = await this.renderTemplate(template, {
        ...data,
        branding: storeBranding
      });

      // Generate tracking ID and inject tracking
      if (campaignId && emailId) {
        const trackingId = await this.generateTrackingId(storeId, campaignId, emailId, to);
        
        // Create tracking record
        await this.createTrackingRecord(trackingId, {
          storeId,
          campaignId,
          emailId,
          recipientEmail: to,
          customerId: customerId || null,
          sentAt: Date.now()
        });
        
        // Inject tracking pixel and wrap links
        emailHtml = this.injectTrackingPixel(emailHtml, trackingId);
        emailHtml = this.injectClickTracking(emailHtml, trackingId);
        
        // Increment sent count
        await this.incrementSentCount(storeId, campaignId, emailId);
      }

      // Send email
      const info = await this.transporter.sendMail({
        from: `"${storeBranding.storeName}" <${storeBranding.fromEmail || 'noreply@fotonix.co.uk'}>`,
        to,
        subject,
        html: emailHtml
      });

      console.log(`✅ Email sent: ${info.messageId}`);
      
      // Log to analytics
      await this.logEmailSent(emailData, info.messageId);
      
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get store branding configuration
   */
  async getStoreBranding(storeId) {
    try {
      const brandingRef = db.ref(`stores/${storeId}/branding`);
      const snapshot = await brandingRef.once('value');
      
      return snapshot.val() || {
        storeName: 'Fotonix Store',
        logo: '',
        primaryColor: '#8B5CF6',
        fromEmail: 'noreply@fotonix.co.uk'
      };
    } catch (error) {
      console.error('Error fetching store branding:', error);
      return {
        storeName: 'Fotonix Store',
        logo: '',
        primaryColor: '#8B5CF6',
        fromEmail: 'noreply@fotonix.co.uk'
      };
    }
  }

  /**
   * Render email template with data
   */
  async renderTemplate(templateName, data) {
    // Load template from database or file system
    const templateRef = db.ref(`emailTemplates/${templateName}`);
    const snapshot = await templateRef.once('value');
    
    let template = snapshot.val()?.html || this.getDefaultTemplate(templateName);
    
    // Replace placeholders with actual data
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      template = template.replace(regex, data[key] || '');
    });

    // Wrap in base email layout
    return this.wrapInLayout(template, data.branding);
  }

  /**
   * Get default template if custom template not found
   */
  getDefaultTemplate(templateName) {
    const templates = {
      thank_you: `
        <h1 style="color: {{primaryColor}};">Thank you for your order!</h1>
        <p>We're thrilled you chose {{storeName}}.</p>
        <p>Your order is being processed and will be shipped soon.</p>
      `,
      usage_guide: `
        <h1>Getting Started with Your {{product_name}}</h1>
        <p>Here's how to make the most of your new purchase:</p>
        <ul>
          <li>Step 1: Unbox carefully</li>
          <li>Step 2: Follow the included instructions</li>
          <li>Step 3: Enjoy your product!</li>
        </ul>
      `,
      recommended_addon: `
        <h1>Complete Your Collection</h1>
        <p>Based on your recent purchase, we think you'll love these:</p>
        {{recommended_products}}
      `,
      request_review: `
        <h1>How are you enjoying your {{product_name}}?</h1>
        <p>We'd love to hear your thoughts!</p>
        <a href="{{review_link}}" style="background: {{primaryColor}}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Leave a Review</a>
      `,
      vip_discount: `
        <h1>VIP Discount Just For You! 🎁</h1>
        <p>As a valued customer, here's an exclusive 20% discount on your next purchase.</p>
        <p style="font-size: 24px; font-weight: bold; color: {{primaryColor}};">CODE: {{discount_code}}</p>
      `,
      we_miss_you: `
        <h1>We Miss You! 💜</h1>
        <p>It's been a while since your last visit. We have some exciting new products you might love.</p>
      `,
      product_suggestion: `
        <h1>New Products You Might Love</h1>
        <p>Based on your past purchases, we've picked these just for you:</p>
        {{suggested_products}}
      `,
      personalized_offer: `
        <h1>Special Offer Just For You</h1>
        <p>We've created a personalized discount code to welcome you back:</p>
        <p style="font-size: 24px; font-weight: bold; color: {{primaryColor}};">{{offer_code}}</p>
      `,
      cart_reminder: `
        <h1>You Left Something Behind...</h1>
        <p>Don't worry, we saved your cart for you!</p>
        {{cart_items}}
        <a href="{{cart_link}}">Complete Your Order</a>
      `,
      need_help: `
        <h1>Need Help Completing Your Order?</h1>
        <p>We noticed you didn't complete your purchase. Is there anything we can help with?</p>
        <p>Reply to this email or chat with us live.</p>
      `,
      cart_discount: `
        <h1>Here's 10% Off to Complete Your Order</h1>
        <p>Use code <strong>{{discount_code}}</strong> at checkout.</p>
        {{cart_items}}
      `,
      deluxe_upgrade: `
        <h1>Upgrade to the Deluxe Version?</h1>
        <p>Get even more features with the deluxe edition:</p>
        {{upgrade_features}}
      `,
      accessory_offer: `
        <h1>Add This Accessory at 20% Off</h1>
        <p>Perfect companion for your recent purchase:</p>
        {{accessory_details}}
      `,
      customers_also_bought: `
        <h1>Customers Also Bought...</h1>
        <p>People who bought {{product_name}} also loved these:</p>
        {{related_products}}
      `,
      check_in_7day: `
        <h1>How's It Going?</h1>
        <p>We hope you're enjoying your {{product_name}}!</p>
        <p>Have any questions or feedback? We're here to help.</p>
      `,
      photo_incentive: `
        <h1>Share a Photo & Get 10% Off! 📸</h1>
        <p>We'd love to see your {{product_name}} in action!</p>
        <p>Send us a photo and get 10% off your next purchase.</p>
      `,
      cross_sell_30day: `
        <h1>Want a Matching Piece?</h1>
        <p>Create a complete collection with these matching products:</p>
        {{matching_products}}
      `,
      anniversary_reminder: `
        <h1>This Time Last Year...</h1>
        <p>You purchased {{product_name}} and we hope it's still bringing you joy!</p>
      `,
      upgrade_offer: `
        <h1>Here's an Upgraded Version</h1>
        <p>We've released an improved version of your {{product_name}}:</p>
        {{upgrade_details}}
      `,
      matching_products: `
        <h1>Complete Your Collection</h1>
        <p>These products perfectly complement your previous purchase:</p>
        {{matched_products}}
      `
    };

    return templates[templateName] || '<p>Email template not found</p>';
  }

  /**
   * Wrap template in base email layout
   */
  wrapInLayout(content, branding) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email from ${branding.storeName}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f4;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 30px; text-align: center; background: linear-gradient(135deg, ${branding.primaryColor} 0%, ${this.adjustColor(branding.primaryColor, -20)} 100%);">
                    ${branding.logo ? `<img src="${branding.logo}" alt="${branding.storeName}" style="max-width: 200px; height: auto;">` : `<h2 style="color: white; margin: 0;">${branding.storeName}</h2>`}
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px; color: #333;">
                    ${content}
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 30px; text-align: center; background: #f9f9f9; border-top: 1px solid #eee;">
                    <p style="margin: 0 0 10px; font-size: 12px; color: #666;">
                      © ${new Date().getFullYear()} ${branding.storeName}. All rights reserved.
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #999;">
                      You received this email because you're a valued customer.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  /**
   * Adjust color brightness
   */
  adjustColor(color, amount) {
    const clamp = (num) => Math.min(Math.max(num, 0), 255);
    const num = parseInt(color.replace('#', ''), 16);
    const r = clamp((num >> 16) + amount);
    const g = clamp(((num >> 8) & 0x00FF) + amount);
    const b = clamp((num & 0x0000FF) + amount);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  /**
   * Generate unique tracking ID
   */
  generateTrackingId(storeId, campaignId, emailId, recipientEmail) {
    const data = `${storeId}-${campaignId}-${emailId}-${recipientEmail}-${Date.now()}-${Math.random()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Create tracking record in Firebase
   */
  async createTrackingRecord(trackingId, data) {
    try {
      const trackingRef = db.ref(`emailTracking/${trackingId}`);
      await trackingRef.set({
        ...data,
        opened: false,
        clicked: false,
        openCount: 0,
        clickCount: 0,
        lastOpened: null,
        lastClicked: null,
        firstOpenedAt: null,
        firstClickedAt: null
      });
    } catch (error) {
      console.error('Error creating tracking record:', error);
    }
  }

  /**
   * Inject tracking pixel into HTML
   */
  injectTrackingPixel(html, trackingId) {
    const serverUrl = process.env.SERVER_URL || 'http://localhost:4000';
    const pixelUrl = `${serverUrl}/api/email/track/open/${trackingId}`;
    const trackingPixel = `<img src="${pixelUrl}" width="1" height="1" style="display:block;width:1px;height:1px;border:0;outline:0;" alt="" />`;
    
    // Try to inject before </body>, otherwise append to end
    if (html.includes('</body>')) {
      return html.replace('</body>', `${trackingPixel}</body>`);
    } else {
      return html + trackingPixel;
    }
  }

  /**
   * Inject click tracking into all links
   */
  injectClickTracking(html, trackingId) {
    const serverUrl = process.env.SERVER_URL || 'http://localhost:4000';
    
    // Find all <a> tags with href
    const linkRegex = /<a\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi;
    
    return html.replace(linkRegex, (match, beforeHref, originalUrl, afterHref) => {
      // Don't track certain links
      if (
        originalUrl.includes('unsubscribe') ||
        originalUrl.includes('/track/') ||
        originalUrl.startsWith('mailto:') ||
        originalUrl.startsWith('#')
      ) {
        return match;
      }
      
      // Create tracking URL
      const trackingUrl = `${serverUrl}/api/email/track/click/${trackingId}?url=${encodeURIComponent(originalUrl)}`;
      
      return `<a ${beforeHref}href="${trackingUrl}"${afterHref}>`;
    });
  }

  /**
   * Increment sent count in campaign stats
   */
  async incrementSentCount(storeId, campaignId, emailId) {
    try {
      const statsRef = db.ref(`stores/${storeId}/emailAutomation/stats/${campaignId}/${emailId}`);
      
      await statsRef.transaction((stats) => {
        if (!stats) {
          return {
            sent: 1,
            opened: 0,
            clicked: 0
          };
        }
        
        stats.sent = (stats.sent || 0) + 1;
        return stats;
      });
    } catch (error) {
      console.error('Error incrementing sent count:', error);
    }
  }

  /**
   * Log email sent to analytics
   */
  async logEmailSent(emailData, messageId) {
    try {
      const { storeId, template, customerId } = emailData;
      
      const logRef = db.ref(`stores/${storeId}/emailAnalytics/${template}`).push();
      await logRef.set({
        messageId,
        customerId,
        sentAt: Date.now(),
        status: 'sent'
      });
    } catch (error) {
      console.error('Error logging email:', error);
    }
  }

  /**
   * Process email queue
   */
  async processQueue() {
    try {
      const queueRef = db.ref('emailQueue');
      const snapshot = await queueRef.orderByChild('status').equalTo('scheduled').once('value');
      
      if (!snapshot.exists()) {
        return;
      }

      const emails = snapshot.val();
      const now = Date.now();

      for (const [emailId, emailData] of Object.entries(emails)) {
        if (emailData.scheduledFor <= now) {
          // Get customer email
          const customerRef = db.ref(`customers/${emailData.customerId}`);
          const customerSnapshot = await customerRef.once('value');
          const customer = customerSnapshot.val();

          if (customer && customer.email) {
            // Send email
            const result = await this.sendEmail({
              ...emailData,
              to: customer.email
            });

            // Update queue status
            await db.ref(`emailQueue/${emailId}`).update({
              status: result.success ? 'sent' : 'failed',
              sentAt: Date.now(),
              error: result.error || null
            });
          }
        }
      }
    } catch (error) {
      console.error('Error processing email queue:', error);
    }
  }

  /**
   * Start queue processor (runs every minute)
   */
  startQueueProcessor() {
    console.log('📧 Starting email queue processor...');
    
    // Process immediately
    this.processQueue();
    
    // Then every minute
    setInterval(() => {
      this.processQueue();
    }, 60000); // 60 seconds
  }
}

// Export singleton instance
const vpsMailClient = new VPSMailClient();
module.exports = vpsMailClient;
