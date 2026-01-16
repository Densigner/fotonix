/**
 * Email Tracking Routes
 * Tracks email opens (via pixel) and clicks (via redirect)
 */

const express = require('express');
const router = express.Router();

// Check if Firebase Admin is initialized
let db;
try {
  const admin = require('firebase-admin');
  db = admin.database();
} catch (error) {
  console.warn('⚠️  Firebase Admin not available for email tracking');
}

// Transparent 1x1 GIF pixel (base64 encoded)
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * Track email opens via 1x1 pixel
 * GET /api/email/track/open/:trackingId
 */
router.get('/open/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    
    // Return pixel immediately (don't make recipient wait)
    res.writeHead(200, {
      'Content-Type': 'image/gif',
      'Content-Length': TRACKING_PIXEL.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Expires': '0',
      'Pragma': 'no-cache'
    });
    res.end(TRACKING_PIXEL);
    
    if (!db) return;
    
    // Log the open asynchronously (don't block response)
    setImmediate(async () => {
      try {
        const trackingRef = db.ref(`emailTracking/${trackingId}`);
        const snapshot = await trackingRef.once('value');
        
        if (!snapshot.exists()) {
          console.warn('⚠️  Unknown tracking ID:', trackingId);
          return;
        }
        
        const data = snapshot.val();
        const now = Date.now();
        const isFirstOpen = !data.opened;
        
        // Update individual tracking record
        await trackingRef.update({
          opened: true,
          openCount: (data.openCount || 0) + 1,
          lastOpened: now,
          firstOpenedAt: data.firstOpenedAt || now
        });
        
        // Update campaign stats (only count unique opens)
        if (isFirstOpen) {
          const statsRef = db.ref(
            `stores/${data.storeId}/emailAutomation/stats/${data.campaignId}/${data.emailId}`
          );
          
          await statsRef.transaction((stats) => {
            if (!stats) {
              return {
                sent: 1,
                opened: 1,
                clicked: 0
              };
            }
            
            stats.opened = (stats.opened || 0) + 1;
            return stats;
          });
          
          console.log(`✅ Email opened: ${data.campaignId}/${data.emailId} by ${data.recipientEmail}`);
        } else {
          console.log(`📬 Re-opened: ${data.campaignId}/${data.emailId} (count: ${data.openCount + 1})`);
        }
      } catch (error) {
        console.error('❌ Error logging email open:', error);
      }
    });
    
  } catch (error) {
    console.error('❌ Tracking pixel error:', error);
    // Always return pixel even on error
    res.writeHead(200, {
      'Content-Type': 'image/gif',
      'Content-Length': TRACKING_PIXEL.length
    });
    res.end(TRACKING_PIXEL);
  }
});

/**
 * Track link clicks via redirect
 * GET /api/email/track/click/:trackingId?url=...
 */
router.get('/click/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    const { url } = req.query; // Original destination URL
    
    // Redirect immediately (don't make user wait)
    if (url) {
      res.redirect(302, decodeURIComponent(url));
    } else {
      res.status(400).send('Missing URL parameter');
      return;
    }
    
    if (!db) return;
    
    // Log the click asynchronously
    setImmediate(async () => {
      try {
        const trackingRef = db.ref(`emailTracking/${trackingId}`);
        const snapshot = await trackingRef.once('value');
        
        if (!snapshot.exists()) {
          console.warn('⚠️  Unknown tracking ID:', trackingId);
          return;
        }
        
        const data = snapshot.val();
        const now = Date.now();
        const isFirstClick = !data.clicked;
        
        // Update individual tracking record
        await trackingRef.update({
          clicked: true,
          clickCount: (data.clickCount || 0) + 1,
          lastClicked: now,
          firstClickedAt: data.firstClickedAt || now,
          lastClickedUrl: decodeURIComponent(url)
        });
        
        // Update campaign stats (only count unique clicks)
        if (isFirstClick) {
          const statsRef = db.ref(
            `stores/${data.storeId}/emailAutomation/stats/${data.campaignId}/${data.emailId}`
          );
          
          await statsRef.transaction((stats) => {
            if (!stats) {
              return {
                sent: 1,
                opened: 1,
                clicked: 1
              };
            }
            
            stats.clicked = (stats.clicked || 0) + 1;
            return stats;
          });
          
          console.log(`✅ Link clicked: ${data.campaignId}/${data.emailId} by ${data.recipientEmail}`);
        } else {
          console.log(`🔗 Re-clicked: ${data.campaignId}/${data.emailId} (count: ${data.clickCount + 1})`);
        }
      } catch (error) {
        console.error('❌ Error logging click:', error);
      }
    });
    
  } catch (error) {
    console.error('❌ Click tracking error:', error);
    // Always redirect even on error
    const fallbackUrl = req.query.url || 'https://fotonix.co.uk';
    res.redirect(302, decodeURIComponent(fallbackUrl));
  }
});

/**
 * Get tracking stats for a specific email
 * GET /api/email/track/stats/:storeId/:campaignId/:emailId
 */
router.get('/stats/:storeId/:campaignId/:emailId', async (req, res) => {
  try {
    if (!db) {
      return res.json({ sent: 0, opened: 0, clicked: 0 });
    }
    
    const { storeId, campaignId, emailId } = req.params;
    
    const statsRef = db.ref(`stores/${storeId}/emailAutomation/stats/${campaignId}/${emailId}`);
    const snapshot = await statsRef.once('value');
    
    const stats = snapshot.val() || { sent: 0, opened: 0, clicked: 0 };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
