# Email Tracking Implementation Strategy

## Current Infrastructure Analysis

### What We Have:
1. **VPS Mail Client** (`server/email-automation/vpsMailClient.js`)
   - Nodemailer SMTP sending
   - Firebase database integration
   - Email queue processing
   - Basic analytics logging

2. **Webhook Infrastructure** (`server/routes/email/receive-webhook.js`)
   - Already set up for receiving inbound emails
   - PostgreSQL database for email storage
   - Webhook secret authentication

3. **Express Server** (`server/index.js`)
   - Routes mounted at `/api/email/receive-webhook`
   - JSON body parsing enabled

### What We Need to Add:

## 1. TRACKING PIXEL FOR OPENS

### How It Works:
- Embed a 1x1 transparent pixel image in each email
- When recipient opens email, their email client requests the image
- Our server logs the request → email was opened

### Implementation:

**A. Update `vpsMailClient.js` - Add Tracking Pixel**

```javascript
async sendEmail(emailData) {
  // ... existing code ...
  
  const { to, subject, template, data, storeId, campaignId, emailId } = emailData;
  
  // Generate unique tracking ID
  const trackingId = this.generateTrackingId(storeId, campaignId, emailId, to);
  
  // Store tracking record
  await this.createTrackingRecord(trackingId, {
    storeId,
    campaignId,
    emailId,
    recipientEmail: to,
    sentAt: Date.now()
  });
  
  // Inject tracking pixel into HTML
  const trackedHtml = this.injectTrackingPixel(emailHtml, trackingId);
  
  // ... send email with trackedHtml ...
}

generateTrackingId(storeId, campaignId, emailId, recipientEmail) {
  // Create unique, non-guessable ID
  const crypto = require('crypto');
  const data = `${storeId}-${campaignId}-${emailId}-${recipientEmail}-${Date.now()}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

injectTrackingPixel(html, trackingId) {
  // Add tracking pixel before closing </body> tag
  const pixelUrl = `${process.env.SERVER_URL}/api/email/track/open/${trackingId}`;
  const trackingPixel = `<img src="${pixelUrl}" width="1" height="1" style="display:block;width:1px;height:1px;" alt="" />`;
  
  return html.replace('</body>', `${trackingPixel}</body>`);
}

async createTrackingRecord(trackingId, data) {
  const trackingRef = db.ref(`emailTracking/${trackingId}`);
  await trackingRef.set({
    ...data,
    opened: false,
    clicked: false,
    openCount: 0,
    clickCount: 0,
    lastOpened: null,
    lastClicked: null
  });
}
```

**B. Create Tracking Route** (`server/routes/email/tracking.js`)

```javascript
const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();
const db = admin.database();

// Transparent 1x1 GIF pixel
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * Track email opens
 * GET /api/email/track/open/:trackingId
 */
router.get('/track/open/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    
    // Return pixel immediately (don't make recipient wait)
    res.writeHead(200, {
      'Content-Type': 'image/gif',
      'Content-Length': TRACKING_PIXEL.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Expires': '0'
    });
    res.end(TRACKING_PIXEL);
    
    // Log the open asynchronously
    setImmediate(async () => {
      try {
        const trackingRef = db.ref(`emailTracking/${trackingId}`);
        const snapshot = await trackingRef.once('value');
        
        if (!snapshot.exists()) {
          console.error('Unknown tracking ID:', trackingId);
          return;
        }
        
        const data = snapshot.val();
        const now = Date.now();
        
        // Update tracking record
        await trackingRef.update({
          opened: true,
          openCount: (data.openCount || 0) + 1,
          lastOpened: now,
          firstOpenedAt: data.firstOpenedAt || now
        });
        
        // Update campaign stats
        const statsRef = db.ref(
          `stores/${data.storeId}/emailAutomation/stats/${data.campaignId}/${data.emailId}`
        );
        
        await db.ref(`stores/${data.storeId}/emailAutomation/stats/${data.campaignId}/${data.emailId}`).transaction((stats) => {
          if (!stats) {
            return {
              sent: 1,
              opened: 1,
              clicked: 0
            };
          }
          
          // Only increment unique opens
          if (!data.opened) {
            stats.opened = (stats.opened || 0) + 1;
          }
          
          return stats;
        });
        
        console.log(`✅ Email opened: ${data.campaignId}/${data.emailId} by ${data.recipientEmail}`);
      } catch (error) {
        console.error('Error logging email open:', error);
      }
    });
    
  } catch (error) {
    console.error('Tracking pixel error:', error);
    res.status(200).end(TRACKING_PIXEL);
  }
});

/**
 * Track link clicks
 * GET /api/email/track/click/:trackingId
 */
router.get('/track/click/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    const { url } = req.query; // Original destination URL
    
    // Redirect immediately
    if (url) {
      res.redirect(302, url);
    } else {
      res.status(400).send('Missing URL parameter');
      return;
    }
    
    // Log the click asynchronously
    setImmediate(async () => {
      try {
        const trackingRef = db.ref(`emailTracking/${trackingId}`);
        const snapshot = await trackingRef.once('value');
        
        if (!snapshot.exists()) {
          console.error('Unknown tracking ID:', trackingId);
          return;
        }
        
        const data = snapshot.val();
        const now = Date.now();
        
        // Update tracking record
        await trackingRef.update({
          clicked: true,
          clickCount: (data.clickCount || 0) + 1,
          lastClicked: now,
          firstClickedAt: data.firstClickedAt || now,
          lastClickedUrl: url
        });
        
        // Update campaign stats
        await db.ref(`stores/${data.storeId}/emailAutomation/stats/${data.campaignId}/${data.emailId}`).transaction((stats) => {
          if (!stats) {
            return {
              sent: 1,
              opened: 1,
              clicked: 1
            };
          }
          
          // Only increment unique clicks
          if (!data.clicked) {
            stats.clicked = (stats.clicked || 0) + 1;
          }
          
          return stats;
        });
        
        console.log(`✅ Link clicked: ${data.campaignId}/${data.emailId} by ${data.recipientEmail}`);
      } catch (error) {
        console.error('Error logging click:', error);
      }
    });
    
  } catch (error) {
    console.error('Click tracking error:', error);
    res.status(302).redirect(req.query.url || 'https://fotonix.co.uk');
  }
});

module.exports = router;
```

**C. Update Links in Email Templates**

```javascript
// In vpsMailClient.js

injectClickTracking(html, trackingId) {
  // Find all links and wrap with tracking
  const linkRegex = /<a\s+([^>]*href=["']([^"']+)["'][^>]*)>/gi;
  
  return html.replace(linkRegex, (match, attributes, originalUrl) => {
    // Don't track unsubscribe links or already-tracked links
    if (originalUrl.includes('unsubscribe') || originalUrl.includes('/track/')) {
      return match;
    }
    
    const trackingUrl = `${process.env.SERVER_URL}/api/email/track/click/${trackingId}?url=${encodeURIComponent(originalUrl)}`;
    return `<a ${attributes.replace(originalUrl, trackingUrl)}>`;
  });
}

// Update sendEmail method:
async sendEmail(emailData) {
  // ... existing code ...
  
  // Inject both tracking pixel and click tracking
  let trackedHtml = this.injectTrackingPixel(emailHtml, trackingId);
  trackedHtml = this.injectClickTracking(trackedHtml, trackingId);
  
  // ... send email ...
}
```

**D. Mount Tracking Routes in `server/index.js`**

```javascript
// Add at top with other route imports
const emailTracking = require('./routes/email/tracking');

// Add after other email routes
app.use('/api/email/track', emailTracking);
```

## 2. UPDATE EMAIL SENDING TO INCREMENT STATS

**In `vpsMailClient.js`:**

```javascript
async sendEmail(emailData) {
  // ... existing code ...
  
  const result = await this.transporter.sendMail({
    from: `"${storeBranding.storeName}" <${storeBranding.fromEmail || 'noreply@fotonix.co.uk'}>`,
    to,
    subject,
    html: trackedHtml
  });
  
  // Increment sent count in stats
  if (campaignId && emailId) {
    const statsRef = db.ref(
      `stores/${storeId}/emailAutomation/stats/${campaignId}/${emailId}/sent`
    );
    
    await statsRef.transaction((currentValue) => {
      return (currentValue || 0) + 1;
    });
  }
  
  return { success: true, messageId: info.messageId };
}
```

## 3. FIREBASE DATABASE STRUCTURE

```
emailTracking/
  {trackingId}/
    storeId: "user123"
    campaignId: "post-purchase"
    emailId: "thank-you"
    recipientEmail: "customer@example.com"
    sentAt: 1700000000000
    opened: true
    clicked: true
    openCount: 3
    clickCount: 1
    firstOpenedAt: 1700000100000
    lastOpened: 1700000200000
    firstClickedAt: 1700000150000
    lastClicked: 1700000150000
    lastClickedUrl: "https://..."

stores/
  {userId}/
    emailAutomation/
      campaigns/
        {campaignId}/
          enabled: true
      stats/
        {campaignId}/
          {emailId}/
            sent: 150
            opened: 95
            clicked: 42
```

## 4. ENVIRONMENT VARIABLES NEEDED

Add to `.env`:

```env
# Email Tracking
SERVER_URL=http://localhost:4000
# or for production:
# SERVER_URL=https://api.fotonix.co.uk
```

## 5. TESTING THE SYSTEM

**Test Open Tracking:**
1. Send test email with tracking
2. Open email in Gmail/Outlook
3. Check Firebase: `emailTracking/{trackingId}/opened` should be `true`
4. Check: `stores/{userId}/emailAutomation/stats/{campaignId}/{emailId}/opened` incremented

**Test Click Tracking:**
1. Click link in test email
2. Should redirect to destination
3. Check Firebase: `emailTracking/{trackingId}/clicked` should be `true`
4. Check: `stores/{userId}/emailAutomation/stats/{campaignId}/{emailId}/clicked` incremented

## 6. PRIVACY & COMPLIANCE

**Important Considerations:**
- ✅ Tracking pixels are industry standard (Gmail, Mailchimp, etc.)
- ✅ No personal data in tracking URLs (use hashed IDs)
- ⚠️ Consider GDPR - add privacy policy disclosure
- ⚠️ Provide unsubscribe option in all emails
- ⚠️ Some email clients block images by default (opens won't track until user loads images)

## 7. LIMITATIONS & ACCURACY

**Open Tracking:**
- ❌ Won't work if recipient has images disabled
- ❌ Email clients with "privacy protection" may preload images (false opens)
- ❌ Forwarded emails count as new opens
- ✅ Typical accuracy: 60-80%

**Click Tracking:**
- ✅ Very accurate (requires user action)
- ❌ Link scanners/antivirus may trigger false clicks
- ✅ Typical accuracy: 95%+

## 8. NEXT STEPS

1. Create `server/routes/email/tracking.js` file
2. Update `server/email-automation/vpsMailClient.js` with tracking methods
3. Mount tracking routes in `server/index.js`
4. Add `SERVER_URL` to `.env`
5. Test with real email sends
6. Monitor Firebase stats in dashboard

## SUMMARY

This solution uses:
- **1x1 tracking pixel** for opens
- **URL redirects** for clicks
- **Firebase transactions** for accurate counting
- **Async logging** for fast response times
- **Hashed tracking IDs** for privacy

All stats automatically populate in your Email Automation Dashboard's "View Stats" sections.
