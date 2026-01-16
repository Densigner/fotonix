require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const { z } = require('zod');
const { query } = require('./db/client');
const { renderTemplate } = require('./email/renderer');
const { startWorker } = require('./queue/worker');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
// lightweight file-backed DB helpers for dev clicks/attributions
let fileDb = null;
try { fileDb = require('../server/db'); } catch (e) { /* ignore if not present */ }
// lightweight JSON file store for attempt tracking & cache (avoids native builds)
const os = require('os');
const OpenAI = require('openai');
const sharp = require('sharp');
// affiliate clicks routes will be mounted after the app is created (see below)

const app = express();

// CORS configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3001');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-member-uid');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// Add cookie parser for PayPal/affiliate functionality
const cookieParser = require('cookie-parser');
app.use(cookieParser(process.env.COOKIE_SECRET || 'secret'));

// multer temporary upload dir
const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// allow overriding ffmpeg/ffprobe paths via env for CI or custom installs
if (process.env.FFMPEG_PATH) ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
if (process.env.FFPROBE_PATH) ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const MAX_FRAMES = parseInt(process.env.SHORTREVIEW_MAX_FRAMES || '8', 10);
const FRAME_INTERVAL = parseInt(process.env.SHORTREVIEW_FRAME_INTERVAL || '5', 10);
const SHORTREVIEW_DAILY_LIMIT = parseInt(process.env.SHORTREVIEW_DAILY_LIMIT || '3', 10);

// JSON file-backed store
const dataDir = path.join(__dirname, '..', 'data');
try { fs.mkdirSync(dataDir, { recursive: true }); } catch (e) {}
const STORE_PATH = path.join(dataDir, 'shortreview_store.json');
let STORE = { attempts: {}, cache: {}, ratings: [] };
try {
  if (fs.existsSync(STORE_PATH)) {
    STORE = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) || STORE;
  }
} catch (e) { console.warn('Failed to read store, starting fresh:', e && e.message); }

function persistStore() {
  try { fs.writeFileSync(STORE_PATH, JSON.stringify(STORE, null, 2)); } catch (e) { console.warn('Failed to persist store', e && e.message); }
}

function todayKey() { return new Date().toISOString().slice(0,10); }
function getUserIdFromReq(req) { return (req.body && (req.body.user_id || req.body.tenant_slug)) || req.ip || 'anon'; }

// Mount affiliate clicks router (optional) - DISABLED for file-based development
// The database-based route conflicts with our direct file-based route below
/*
try {
  const affiliateRouter = require('../affiliateClicks/routes/affiliateclick');
  if (affiliateRouter) app.use(affiliateRouter);
} catch (e) {
  // ignore if not present or fails in some environments
}
*/

// Mount PayPal and affiliate management routes
try {
  const createOrder = require('../server/routes/create-order');
  const captureOrder = require('../server/routes/capture-order');
  const webhook = require('../server/routes/webhook');
  const affiliates = require('../server/routes/affiliates');
  const clicks = require('../server/routes/clicks');
  const merchants = require('../server/routes/merchants');
  const products = require('../server/routes/products');
  const member = require('../server/routes/member');

  // PayPal webhook: must receive raw body to verify signature
  // Mount this route before json body parser affects it
  app.use('/api/paypal/webhook', express.raw({ type: 'application/json' }), webhook);
  
  // Mount other PayPal/affiliate routes
  app.use(createOrder);
  app.use(captureOrder);
  app.use(clicks);
  app.use('/api/affiliates', affiliates);
  app.use(merchants);
  app.use(products);
  app.use('/api/member', member);
  
  // AI Chatbot API endpoint
  app.post('/api/chatbot/message', async (req, res) => {
    try {
      const { message, conversationHistory = [], userProfile = {} } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Aggressive pre-filter for off-topic questions to save OpenAI costs
      const offTopicKeywords = /\b(world war|history|recipe|weather|movie|book|celebrity|sports|politics|religion|programming|coding|math|science|geography|animal|car|music|game|medical|health|doctor|cure|treatment|disease|symptom|medicine|drug|pain|injury|cancer|covid|virus|bacteria|infection|therapy|surgery|hospital|clinic|hemorrhoid|hermeroids|diet|fitness|exercise|vitamin|supplement|prescription)\b/i;
      const businessKeywords = /\b(business|marketing|affiliate|sales|revenue|growth|platform|fotonix|commission|conversion|funnel|email|campaign|lead|customer|profit|roi|subscription|pricing|trial)\b/i;
      
      // If message contains off-topic keywords AND doesn't contain business keywords, filter it
      if (offTopicKeywords.test(message) && !businessKeywords.test(message)) {
        return res.json({
          success: true,
          response: "I'm here specifically to help with Fotonix and growing your business through affiliate marketing. What questions do you have about our platform or affiliate marketing strategies?",
          metadata: { 
            filtered: true,
            reason: 'off-topic'
          }
        });
      }

      // Build ultra-restrictive business system prompt
      const systemPrompt = `You are Alex, a Fotonix sales consultant. You REFUSE to answer ANY question that is not about Fotonix or business/affiliate marketing.

🚫 ABSOLUTE RESTRICTIONS - YOU MUST REFUSE THESE TOPICS:
- Medical advice, health, diseases, treatments, symptoms, medications
- History, wars, politics, religion, celebrities  
- Recipes, cooking, weather, sports, entertainment
- Science, math, programming, coding, technology (unless business-related)
- Personal advice, relationships, travel, hobbies
- General knowledge questions of any kind

✅ ONLY DISCUSS: Fotonix platform, affiliate marketing, business growth, sales strategies, conversions, revenue

🔒 MANDATORY RESPONSE for off-topic questions: "I'm here specifically to help with Fotonix and growing your business through affiliate marketing. What questions do you have about our platform or affiliate marketing strategies?"

DO NOT provide any information outside of Fotonix business topics. NO EXCEPTIONS.

ABOUT FOTONIX ONLY:
- Complete business growth platform for £11.99/month
- Includes: Email campaigns, funnel builder, shop creation, link tracking, AI analytics, PayPal integration
- Saves businesses £285+/month vs buying tools separately
- 30-day free trial, no credit card required
- 2,847+ success stories, £2.4M+ in commissions paid
- 94% of members profitable within 60 days, average 247% revenue increase

SUCCESS STORIES:
- Sarah Mitchell (Fashion): £8k → £28k monthly in 3 months (12 → 247 affiliates)
- James Rodriguez (Agency): Saved 38 hours/month, 340% commission growth  
- Emma Thompson (SaaS): 0 → 156 affiliates, £15k → £47k MRR in 6 months
- Mike (Fitness): Added £12k/month with zero ad spend using influencers

OBJECTION HANDLING:
1. Price: "Compare £12/month to £2k-5k wasted on ads. Plus 30-day guarantee."
2. Time: "Setup takes 15 minutes, saves 38+ hours monthly."
3. Skepticism: "1,247 active users, £2.4M+ paid out, 4.9/5 rating"

CONVERSATION RULES:
- ONLY discuss Fotonix, affiliate marketing, business growth topics
- Redirect ALL off-topic questions back to business
- Use specific numbers and success stories
- Always guide toward free trial signup
- Be friendly but stay laser-focused on business

REMEMBER: You are NOT a general AI assistant. You are a Fotonix sales consultant ONLY.`;

      // Build conversation messages for OpenAI
      const messages = [
        { role: 'system', content: systemPrompt }
      ];

      // Add conversation history
      conversationHistory.forEach(msg => {
        messages.push({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });

      // Add current message
      messages.push({ role: 'user', content: message });

      // Add user profile context if available
      let profileContext = '';
      if (userProfile.businessType) profileContext += `Business type: ${userProfile.businessType}. `;
      if (userProfile.monthlyRevenue) profileContext += `Revenue level: ${userProfile.monthlyRevenue}. `;
      if (userProfile.currentAffiliates) profileContext += `Current affiliates: ${userProfile.currentAffiliates}. `;
      if (userProfile.mainConcern) profileContext += `Main concern: ${userProfile.mainConcern}. `;
      
      if (profileContext) {
        messages.push({ 
          role: 'system', 
          content: `User context: ${profileContext}Tailor your response accordingly.` 
        });
      }

      // Call OpenAI API using your existing setup
      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: messages,
        max_tokens: 500,
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const aiResponse = completion?.choices?.[0]?.message?.content?.trim();
      
      if (!aiResponse) {
        throw new Error('No response from AI');
      }

      // Analyze sentiment and intent for better tracking
      const containsHighIntent = /ready|yes|let's do it|sign up|start|trial|interested/i.test(message);
      const containsObjection = /expensive|cost|time|skeptical|scam|don't trust/i.test(message);
      
      res.json({
        success: true,
        response: aiResponse,
        metadata: {
          containsHighIntent,
          containsObjection,
          messageCount: conversationHistory.length + 1
        }
      });

    } catch (error) {
      console.error('Chatbot API error:', error);
      
      // Fallback response if OpenAI fails
      const fallbackResponse = "I'm having a brief technical issue. In the meantime, I'd love to tell you about our £11.99/month platform that typically saves businesses £285+ monthly. We have a 30-day free trial - would you like to learn more about the features?";
      
      res.json({
        success: true,
        response: fallbackResponse,
        metadata: { fallback: true }
      });
    }
  });
  
  // Direct route for affiliate stats (singular) - member click dashboard - PostgreSQL version
  app.get('/api/affiliate/stats', async (req, res) => {
    try {
      console.log('PostgreSQL /api/affiliate/stats route hit');
      console.log('Query user:', req.query.user);
      
      // For now, use a simple member ID mapping  
      const memberUid = 'current-member-id'; // Could enhance this later
      
      // Get member's affiliates from PostgreSQL
      const affiliatesResult = await query(
        'SELECT affiliate_code FROM affiliates WHERE member_uid = $1',
        [memberUid]
      );
      const memberAffiliateCodes = affiliatesResult.rows.map(row => row.affiliate_code);
      
      console.log('Member affiliate codes from DB:', memberAffiliateCodes);
      
      if (memberAffiliateCodes.length === 0) {
        console.log('No affiliates found for member');
        return res.json({
          summary: {
            total_clicks: 0,
            unique_visitors: 0,
            conversions: 0,
            conversion_rate: 0,
            revenue: '0.00'
          },
          daily: [],
          channels: [],
          top_links: [],
          referrers: []
        });
      }
      
      // Get clicks from PostgreSQL - count clicks for links belonging to member's affiliates
      const clicksQuery = `
        SELECT COUNT(*) as total_clicks,
               COUNT(DISTINCT lc.visitor_id) as unique_visitors
        FROM link_clicks lc
        JOIN tracked_links tl ON tl.id = lc.link_id
        WHERE tl.user_id = ANY($1)
      `;
      const clicksResult = await query(clicksQuery, [memberAffiliateCodes]);
      const totalClicks = parseInt(clicksResult.rows[0]?.total_clicks || 0);
      const uniqueVisitors = parseInt(clicksResult.rows[0]?.unique_visitors || 0);
      
      // Get attributions and orders from PostgreSQL
      const attributionsQuery = `
        SELECT 
          a.*,
          o.amount_cents,
          o.currency,
          o.status as order_status
        FROM attributions a
        JOIN orders o ON o.order_id = a.order_id
        WHERE a.affiliate_id = ANY($1)
        ORDER BY a.created_at DESC
      `;
      const attributionsResult = await query(attributionsQuery, [memberAffiliateCodes]);
      const memberAttributions = attributionsResult.rows;
      
      console.log('Member attributions found:', memberAttributions.length);
      
      const conversions = memberAttributions.length;
      const conversionRate = totalClicks > 0 ? ((conversions / totalClicks) * 100).toFixed(1) : '0.0';
      
      // Calculate revenue from attributions
      const revenue = memberAttributions.reduce((sum, attr) => {
        const amount = attr.amount_cents || 0;
        return sum + (amount / 100);
      }, 0);
      
      console.log('Calculated stats - Clicks:', totalClicks, 'Conversions:', conversions, 'Revenue:', revenue);
      
      // Get daily click data for charts
      const dailyQuery = `
        SELECT 
          DATE(lc.created_at) as date,
          COUNT(*) as clicks,
          COUNT(DISTINCT a.attribution_id) as conversions
        FROM link_clicks lc
        JOIN tracked_links tl ON tl.id = lc.link_id
        LEFT JOIN attributions a ON a.click_id::text = lc.id::text 
          AND a.affiliate_id = ANY($1)
        WHERE tl.user_id = ANY($1)
          AND lc.created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(lc.created_at)
        ORDER BY date DESC
        LIMIT 30
      `;
      const dailyResult = await query(dailyQuery, [memberAffiliateCodes]);
      const daily = dailyResult.rows.map(row => ({
        date: row.date,
        clicks: parseInt(row.clicks),
        conversions: parseInt(row.conversions || 0)
      }));
      
      // Get channel breakdown from tracked_links
      const channelsQuery = `
        SELECT 
          COALESCE(tl.channel, 'direct') as channel,
          COUNT(lc.id) as clicks,
          COUNT(DISTINCT a.attribution_id) as conversions
        FROM link_clicks lc
        JOIN tracked_links tl ON tl.id = lc.link_id
        LEFT JOIN attributions a ON a.click_id::text = lc.id::text 
          AND a.affiliate_id = ANY($1)
        WHERE tl.user_id = ANY($1)
        GROUP BY tl.channel
        ORDER BY clicks DESC
      `;
      const channelsResult = await query(channelsQuery, [memberAffiliateCodes]);
      const channels = channelsResult.rows.map(row => ({
        channel: row.channel || 'direct',
        clicks: parseInt(row.clicks),
        conversions: parseInt(row.conversions || 0)
      }));
      
      // Get top performing links
      const topLinksQuery = `
        SELECT 
          tl.slug,
          tl.title,
          tl.channel,
          COUNT(lc.id) as clicks,
          COUNT(DISTINCT a.attribution_id) as conversions,
          tl.created_at
        FROM tracked_links tl
        LEFT JOIN link_clicks lc ON lc.link_id = tl.id
        LEFT JOIN attributions a ON a.click_id::text = lc.id::text 
          AND a.affiliate_id = ANY($1)
        WHERE tl.user_id = ANY($1)
        GROUP BY tl.id, tl.slug, tl.title, tl.channel, tl.created_at
        ORDER BY clicks DESC, conversions DESC
        LIMIT 10
      `;
      const topLinksResult = await query(topLinksQuery, [memberAffiliateCodes]);
      const topLinks = topLinksResult.rows.map(row => ({
        title: row.title || `Link ${row.slug}`,
        channel: row.channel || 'direct',
        clicks: parseInt(row.clicks || 0),
        conversions: parseInt(row.conversions || 0),
        ctr: parseInt(row.clicks || 0) > 0 ? 
          (((parseInt(row.conversions || 0)) / parseInt(row.clicks || 0)) * 100).toFixed(1) : '0.0',
        created_at: row.created_at
      }));
      
      // Get referrer data from link_clicks
      const referrersQuery = `
        SELECT 
          CASE 
            WHEN lc.referrer LIKE '%facebook%' THEN 'facebook.com'
            WHEN lc.referrer LIKE '%twitter%' OR lc.referrer LIKE '%t.co%' THEN 'twitter.com'
            WHEN lc.referrer LIKE '%instagram%' THEN 'instagram.com'
            WHEN lc.referrer LIKE '%google%' THEN 'google.com'
            WHEN lc.referrer = '' OR lc.referrer IS NULL THEN 'direct'
            ELSE 'other'
          END as domain,
          COUNT(*) as clicks
        FROM link_clicks lc
        JOIN tracked_links tl ON tl.id = lc.link_id
        WHERE tl.user_id = ANY($1)
        GROUP BY domain
        ORDER BY clicks DESC
      `;
      const referrersResult = await query(referrersQuery, [memberAffiliateCodes]);
      const referrers = referrersResult.rows.map(row => ({
        domain: row.domain,
        clicks: parseInt(row.clicks)
      }));
      
      const responseData = {
        summary: {
          total_clicks: totalClicks,
          unique_visitors: uniqueVisitors,
          conversions: conversions,
          conversion_rate: parseFloat(conversionRate),
          revenue: revenue.toFixed(2)
        },
        daily,
        channels,
        top_links: topLinks,
        referrers
      };
      
      console.log('Sending PostgreSQL response:', responseData);
      res.json(responseData);
      
    } catch (e) {
      console.error('PostgreSQL /api/affiliate/stats error:', e);
      res.status(500).json({ error: e.message || 'Internal server error' });
    }
  });
} catch (e) {
  console.warn('PayPal/affiliate routes not available:', e.message);
}

// CRITICAL: Move signup endpoints outside of PayPal try-catch block
// Subscription status endpoint - checks for active trial or subscription
app.get('/api/subscriptions/status', (req, res) => {
  try {
    const userSession = req.cookies.user_session;
    
    if (!userSession) {
      return res.json({
        hasSubscription: false,
        subscriptionType: null,
        expiresAt: null,
        isActive: false,
        status: 'none'
      });
    }

    const userData = JSON.parse(userSession);
    const now = new Date();
    const trialEnd = new Date(userData.expiresAt);
    const daysLeft = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
    const isActive = daysLeft > 0;

    res.json({
      hasSubscription: isActive,
      subscriptionType: userData.status,
      expiresAt: userData.expiresAt,
      isActive: isActive,
      status: isActive ? 'trial' : 'expired',
      trialDaysLeft: daysLeft
    });

  } catch (error) {
    console.error('Subscription status error:', error);
    res.json({
      hasSubscription: false,
      subscriptionType: null,
      expiresAt: null,
      isActive: false,
      status: 'error'
    });
  }
});

// Free trial signup endpoint
app.post('/api/signup/trial', async (req, res) => {
  console.log('🚀 Trial signup request received:', req.body);
  try {
    const { email, firstName, businessType } = req.body;
    
    if (!email || !firstName || !businessType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Generate user ID and trial info
    const userId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const trialStartDate = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30); // 30-day trial

    // Create user record (in a real app, this would go to your database)
    const userData = {
      id: userId,
      email,
      firstName,
      businessType,
      status: 'trial',
      trialStartDate: trialStartDate.toISOString(),
      trialEndDate: trialEndDate.toISOString(),
      createdAt: new Date().toISOString()
    };

    console.log('Created trial user:', userData);

    // Store user session (simple cookie-based session for demo)
    res.cookie('user_session', JSON.stringify({
      userId,
      email,
      firstName,
      status: 'trial',
      expiresAt: trialEndDate.toISOString()
    }), { 
      httpOnly: true, 
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: process.env.NODE_ENV === 'production'
    });

    // Send welcome email (temporarily disabled for debugging)
    try {
      console.log(`Would send welcome email to ${email} - temporarily disabled for debugging`);
      // await sendWelcomeEmail(userData);
    } catch (emailError) {
      console.warn('Failed to send welcome email:', emailError);
      // Don't fail signup if email fails
    }

    // Return success response
    res.json({
      success: true,
      user: {
        id: userId,
        email,
        firstName,
        businessType,
        status: 'trial',
        trialDaysLeft: 30,
        trialEndDate: trialEndDate.toISOString()
      },
      redirectTo: '/member-dashboard'
    });

  } catch (error) {
    console.error('Trial signup error:', error);
    res.status(500).json({ 
      error: 'Failed to create account. Please try again.' 
    });
  }
});

// Get current user endpoint
app.get('/api/user/current', (req, res) => {
  try {
    const userSession = req.cookies.user_session;
    if (!userSession) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userData = JSON.parse(userSession);
    const now = new Date();
    const trialEnd = new Date(userData.expiresAt);
    const daysLeft = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));

    res.json({
      user: {
        ...userData,
        trialDaysLeft: daysLeft,
        isTrialActive: daysLeft > 0
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

function getAttemptsCount(userId) {
  const day = todayKey();
  return (STORE.attempts[userId] && STORE.attempts[userId][day]) || 0;
}

function incrementAttempts(userId) {
  const day = todayKey();
  STORE.attempts[userId] = STORE.attempts[userId] || {};
  STORE.attempts[userId][day] = (STORE.attempts[userId][day] || 0) + 1;
  persistStore();
  return Math.max(0, SHORTREVIEW_DAILY_LIMIT - STORE.attempts[userId][day]);
}

function attemptsLeftFor(userId) { return Math.max(0, SHORTREVIEW_DAILY_LIMIT - getAttemptsCount(userId)); }

function md5File(filePath) { const hash = crypto.createHash('md5'); const buf = fs.readFileSync(filePath); hash.update(buf); return hash.digest('hex'); }

function getCachedAnalysis(hash) { const v = STORE.cache[hash]; if (!v) return null; try { return JSON.parse(v); } catch (e) { return null; } }
function setCachedAnalysis(hash, result) { try { STORE.cache[hash] = JSON.stringify(result); persistStore(); } catch (e) { console.warn('Failed to set cache', e && e.message); } }

// zod schema for validation of the rich JSON output
const ReviewSchema = z.object({
  items: z.array(z.object({
    startSec: z.number().int().nonnegative(),
    endSec: z.number().int().nonnegative(),
    issue: z.string(),
    suggestion: z.string()
  })).min(1).max(12),
  educationalResources: z.array(z.object({ topic: z.string(), url: z.string().url() })).min(1).max(8),
  nextSteps: z.array(z.string()).min(1).max(12),
  meta: z.object({ model: z.string(), duration: z.number().int().nonnegative(), attemptsLeft: z.number().int().nonnegative() })
});

function secToTimestamp(s) {
  // Accept fractional seconds and format as HH:MM:SS.xxx for ffmpeg timestamps
  const total = Number(s) || 0;
  const hh = Math.floor(total / 3600).toString().padStart(2, '0');
  const mm = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
  const sec = (total % 60).toFixed(3).padStart(6, '0');
  return `${hh}:${mm}:${sec}`;
}

// Resize & compress extracted frames to reduce token size when embedding as data-URLs
async function toBase64Image(filePath, { width = 320, quality = 60 } = {}) {
  try {
    const buf = await sharp(filePath).resize({ width, withoutEnlargement: true }).jpeg({ quality }).toBuffer();
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch (e) {
    // fallback to reading raw file
    const b64 = fs.readFileSync(filePath, 'base64');
    return `data:image/png;base64,${b64}`;
  }
}

function cleanupPaths(paths) {
  for (const p of paths) {
    try {
      if (!p) continue;
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
          fs.readdirSync(p).forEach(f => {
            try { fs.unlinkSync(path.join(p, f)); } catch (e) {}
          });
          try { fs.rmdirSync(p); } catch (e) {}
        } else {
          try { fs.unlinkSync(p); } catch (e) {}
        }
      }
    } catch (e) {}
  }
}

function extractFrames({ inputPath, outDir, maxFrames = MAX_FRAMES, intervalSec = FRAME_INTERVAL }) {
  return new Promise((resolve, reject) => {
    try {
      fs.mkdirSync(outDir, { recursive: true });
    } catch (e) {}

    // Try to probe duration first and return frame paths with seconds
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      // helper to read produced pngs and pair with seconds
      const readFilesWithSeconds = (secondsArr) => {
        const files = fs.readdirSync(outDir)
          .filter(f => f.endsWith('.png'))
          .sort((a, b) => a.localeCompare(b))
          .map(f => path.join(outDir, f))
          .slice(0, maxFrames);
        // pair
        const paired = files.map((p, i) => ({ path: p, second: secondsArr && secondsArr[i] != null ? secondsArr[i] : Math.floor(i * intervalSec) }));
        return paired.slice(0, maxFrames);
      };

      if (err || !metadata || !metadata.format || !metadata.format.duration) {
        // fallback: let ffmpeg distribute count across duration (unknown duration)
        ffmpeg(inputPath)
          .on('end', () => {
            const seconds = []; // approximate using interval
            for (let i = 0; i < maxFrames; i++) seconds.push(i * intervalSec);
            resolve(readFilesWithSeconds(seconds));
          })
          .on('error', reject)
          .screenshots({ count: maxFrames, filename: 'frame-%03i.png', folder: outDir });
        return;
      }

      const duration = Math.max(0, Math.floor(metadata.format.duration || 0));
      // Build timemarks that cover the full video by default.
      // If the video is longer than (maxFrames-1)*intervalSec, auto-scale so
      // the `maxFrames` frames are evenly spaced from 0..duration. This ensures
      // the model sees examples from across the whole clip.
      let timemarksSec = [];
      if (duration <= 0) {
        timemarksSec.push(0);
      } else {
        const denom = Math.max(1, maxFrames - 1);
        for (let i = 0; i < Math.min(maxFrames, denom + 1); i++) {
          // use fractional seconds to avoid integer collisions (preserve spacing)
          const sec = (i / denom) * duration;
          timemarksSec.push(sec);
        }
        // Ensure uniqueness and cap to maxFrames
        timemarksSec = Array.from(new Set(timemarksSec)).slice(0, maxFrames);
        if (timemarksSec.length === 0) timemarksSec.push(0);
      }

      const timemarks = timemarksSec.map(secToTimestamp);
      console.log('ShortReview: selected timemarksSec=', timemarksSec);
      console.log('ShortReview: selected timemarks=', timemarks);

      ffmpeg(inputPath)
        .on('end', async () => {
          let paired = readFilesWithSeconds(timemarksSec);
          try { console.log('ShortReview: extracted frames count=', paired.length, 'files=', paired.map(p=>p.path)); } catch(e){}

          // If ffmpeg produced fewer frames than requested, retry with a count-based extraction
          const expected = Math.min(maxFrames, timemarksSec.length || maxFrames);
          if (paired.length < Math.max(1, expected)) {
            console.warn('ShortReview: fewer frames extracted than requested; retrying with count-based extraction');
            // remove any partial files
            try {
              fs.readdirSync(outDir).forEach(f => {
                try { fs.unlinkSync(path.join(outDir, f)); } catch (e) {}
              });
            } catch (e) {}

            await new Promise((rsolve, rreject) => {
              ffmpeg(inputPath)
                .on('end', () => {
                  const cnt = Math.min(maxFrames, Math.max(2, expected));
                  const secs = [];
                  for (let i = 0; i < cnt; i++) secs.push(Math.floor((i * duration) / Math.max(1, cnt - 1)));
                  try { console.log('ShortReview: retry produced files, secs=', secs); } catch(e){}
                  rsolve(readFilesWithSeconds(secs));
                })
                .on('error', (re) => { console.warn('ShortReview: retry screenshot failed', re && re.message); rreject(re); })
                .screenshots({ count: Math.min(maxFrames, Math.max(2, expected)), filename: 'frame-%03i.png', folder: outDir });
            }).then((retryResult) => { paired = retryResult; }).catch(() => {});
          }

          return resolve(paired);
        })
        .on('error', (e) => {
          // fallback to count method if error
          ffmpeg(inputPath)
            .on('end', () => {
              // distribute even seconds across duration
              const cnt = Math.min(maxFrames, 6);
              const secs = [];
              for (let i = 0; i < cnt; i++) secs.push(Math.floor((i * duration) / Math.max(1, cnt - 1)));
              resolve(readFilesWithSeconds(secs));
            })
            .on('error', reject)
            .screenshots({ count: Math.min(maxFrames, 6), filename: 'frame-%03i.png', folder: outDir });
        })
        .screenshots({ timestamps: timemarks, filename: 'frame-%03i.png', folder: outDir });
    });
  });
}

// NEW: analyze short video
app.post('/api/shortreview/analyze', upload.single('video'), async (req, res) => {
  // ensure ffprobe is available before attempting extraction
  try {
    await new Promise((resolve, reject) => ffmpeg.getAvailableFormats((err) => err ? reject(err) : resolve()));
  } catch (e) {
    console.error('ffprobe/ffmpeg not available:', e && e.message);
    return res.status(503).json({ error: 'Server ffmpeg/ffprobe not available. Install ffmpeg or set FFPROBE_PATH/FFMPEG_PATH.' });
  }
  const tmpVideo = req.file?.path;
  if (!tmpVideo) return res.status(400).json({ error: 'No video uploaded (field name: video)' });
  const framesDir = path.join(__dirname, '..', 'tmp', `frames-${path.basename(tmpVideo)}`);

  // compute hash of video to support caching
  let videoHash = null;
  try { videoHash = md5File(tmpVideo); } catch (e) { console.warn('Failed to hash video', e && e.message); }
  const userId = getUserIdFromReq(req);
  console.log('ShortReview request', { ts: new Date().toISOString(), userId, videoHash });

  // enforce daily attempts per user
  const leftBefore = attemptsLeftFor(userId);
  if (leftBefore <= 0) {
    return res.status(429).json({ error: 'limit_reached', remaining: 0 });
  }

  // cached result check
  if (videoHash) {
    const cached = getCachedAnalysis(videoHash);
    if (cached) {
      // include attemptsLeft in meta
      if (!cached.meta) cached.meta = {};
      cached.meta.attemptsLeft = leftBefore;
      return res.json(cached);
    }
  }

  try {
    const frameFiles = await extractFrames({ inputPath: tmpVideo, outDir: framesDir, maxFrames: MAX_FRAMES, intervalSec: FRAME_INTERVAL });
    if (!frameFiles.length) throw new Error('No frames could be extracted');

    // Convert frames to smaller JPEG data-URLs to reduce token usage
    let limitedFrames = frameFiles.slice(0, MAX_FRAMES);

    // Helper: pick `keep` elements evenly from `arr` (preserve first/last)
    function pickEvenly(arr, keep) {
      if (!Array.isArray(arr)) return arr;
      if (keep >= arr.length) return arr.slice();
      if (keep <= 0) return [];
      if (keep === 1) return [arr[Math.floor((arr.length - 1) / 2)]];
      const out = [];
      const lastIndex = arr.length - 1;
      for (let i = 0; i < keep; i++) {
        const idx = Math.round((i * lastIndex) / (keep - 1));
        out.push(arr[idx]);
      }
      return out;
    }

    // estimate tokens from base64: bytes ~= (b64len * 3)/4; tokens ~= bytes/3
    function estimateTokensFromDataUrl(dataUrl) {
      if (!dataUrl) return 0;
      const parts = dataUrl.split(',');
      const b64 = parts[1] || '';
      const bytes = Math.ceil((b64.length * 3) / 4);
      return Math.ceil(bytes / 3);
    }

    // target tokens (conservative per-request cap). Tune via env if needed.
    const MAX_REQUEST_TOKENS = parseInt(process.env.SHORTREVIEW_MAX_REQUEST_TOKENS || '200000', 10);

    // Try progressive downscaling and frame dropping to meet token cap
    const sizePresets = [ { width: 320, quality: 60 }, { width: 240, quality: 50 }, { width: 160, quality: 40 }, { width: 120, quality: 30 } ];
    let images = [];
    let success = false;
    for (const preset of sizePresets) {
      images = [];
      for (const f of limitedFrames) {
        // f may be { path, second }
        const filePath = typeof f === 'string' ? f : f.path;
        const timestamp = typeof f === 'string' ? 0 : (f.second || 0);
        const url = await toBase64Image(filePath, preset);
        images.push({ type: 'image_url', image_url: { url }, timestamp });
      }
      let totalTokens = 0;
      for (const img of images) totalTokens += estimateTokensFromDataUrl(img.image_url.url);
      // small textual overhead (~2000 tokens) for prompt/instructions
      totalTokens += 2000;
      if (totalTokens <= MAX_REQUEST_TOKENS) { success = true; break; }

  // else try reducing frame count but preserve even coverage across the clip
  if (limitedFrames.length > 2) limitedFrames = pickEvenly(limitedFrames, Math.max(2, Math.floor(limitedFrames.length / 2)));
    }

    if (!success) {
      // final attempt: aggressive minification of remaining frames
      images = [];
      for (const f of limitedFrames.slice(0,2)) {
      const filePath = typeof f === 'string' ? f : f.path;
      const timestamp = typeof f === 'string' ? 0 : (f.second || 0);
      const url = await toBase64Image(filePath, { width: 120, quality: 25 });
      images.push({ type: 'image_url', image_url: { url }, timestamp });
      }
      let totalTokens = 0; for (const img of images) totalTokens += estimateTokensFromDataUrl(img.image_url.url); totalTokens += 2000;
      if (totalTokens > MAX_REQUEST_TOKENS) {
        cleanupPaths([framesDir, tmpVideo]);
        return res.status(413).json({ error: 'payload_too_large', message: 'Unable to reduce image payload below token limits. Try a shorter video or lower SHORTREVIEW_MAX_FRAMES in server config.' });
      }
    }

    // Probe the actual video duration and round to seconds
    let durationSecs = 0;
    try {
      durationSecs = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(tmpVideo, (err, metadata) => {
          if (err) return reject(err);
          const d = metadata && metadata.format && metadata.format.duration ? Math.round(metadata.format.duration) : 0;
          return resolve(d);
        });
      });
    } catch (e) {
      console.warn('Unable to probe video duration, falling back to 0:', e && e.message);
      durationSecs = 0;
    }
    console.log('ShortReview: probed video duration (s)=', durationSecs);

    const attemptsLeft = attemptsLeftFor(userId);
    const prompt = `
You are a professional short-form video coach. Return JSON only.

Inputs available to you (user content includes this prompt plus an images array):
- images: an array of objects { "url": "data:image/...", "timestamp": <seconds> } — the thumbnail images extracted from the video and the second (integer) within the original clip where each image was taken.

Requirements (read carefully and follow exactly):
1) The JSON MUST follow this exact structure:
{
  "items": [{ "startSec": 0, "endSec": 5, "issue": "", "suggestion": "" }],
  "educationalResources": [ { "topic": "string", "url": "https://..." } ],
  "nextSteps": ["string"],
  "meta": { "model": "${MODEL}", "duration": ${durationSecs}, "attemptsLeft": ${attemptsLeft} }
}

2) Use the images' "timestamp" fields to anchor your findings. Each item.startSec and item.endSec must be integers between 0 and the video duration (meta.duration). Prefer to set startSec/endSec so they align with or are derived from available timestamps.

3) Try to return a set of items that collectively COVER the full duration from 0 to meta.duration (no large uncovered regions). If there is not enough visual evidence for a section, still include a short, high-level suggestion for that segment (e.g., "no major issues detected, consider X").

4) Return between 1 and ${MAX_FRAMES} items (aim for 3–${Math.max(3, Math.min(MAX_FRAMES, 8))} when possible). Items should be non-overlapping and ordered by startSec.

5) educationalResources must be an array of objects with "topic" and a valid "url". nextSteps must be an array of short actionable strings.

6) Do NOT include any extra prose outside the JSON. If you cannot comply, still return a valid JSON object following the schema and include a note inside nextSteps explaining limits.

Use the images and timestamps as your source of truth — do not assume the rest of the video beyond what the timestamps show, but distribute insights so the returned items represent the entire clip.
`;

  // Build user content that includes prompt and images (each image includes timestamp)
  // Send images as [{ url: 'data:...', timestamp: 12 }, ...]
  const userContentObj = { prompt, images: images.map(i => ({ url: i.image_url.url, timestamp: i.timestamp || 0 })) };

    // Make the OpenAI call after ffprobe completed and prompt constructed
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are a short-form video coach. Return strict JSON only.' },
        { role: 'user', content: JSON.stringify(userContentObj) }
      ],
    });

    const raw = completion?.choices?.[0]?.message?.content?.trim() || '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error('Model returned non-JSON. Raw output:');
      console.error(raw);
      return res.status(502).json({ error: 'Model returned non-JSON', raw });
    }

    // populate meta and validate
    parsed.meta = parsed.meta || {};
    parsed.meta.model = MODEL;
    parsed.meta.duration = durationSecs;
    // attemptsLeft is what remains AFTER charging; show pre-charge attempts in response then decrement below
    parsed.meta.attemptsLeft = Math.max(0, attemptsLeft - 1);
    // include frame extraction info so the frontend can show accurate frame counts
    try {
      parsed.meta.frameCount = Array.isArray(frameFiles) ? frameFiles.length : (images ? images.length : 0);
      if (Array.isArray(frameFiles) && frameFiles.length > 1) {
        // estimate average interval between extracted frames (seconds)
        let diffs = [];
        for (let i = 1; i < frameFiles.length; i++) {
          const a = Number(frameFiles[i - 1].second || 0);
          const b = Number(frameFiles[i].second || 0);
          diffs.push(Math.abs(b - a));
        }
        const avg = diffs.reduce((s, v) => s + v, 0) / Math.max(1, diffs.length);
        parsed.meta.frameAssumptionIntervalSec = Math.round(avg);
      } else {
        parsed.meta.frameAssumptionIntervalSec = FRAME_INTERVAL;
      }
    } catch (e) {}

    // helper: try to clean noisy model outputs (strip code fences, prose, and extract first JSON object/array)
    function cleanModelJson(s) {
      if (!s || typeof s !== 'string') return s;
      // remove triple/backtick fences and markdown
      let t = s.replace(/```json|```/g, '\n').trim();
      // remove leading non-json words up to first { or [
      const firstObj = t.indexOf('{');
      const firstArr = t.indexOf('[');
      let start = -1;
      if (firstObj === -1) start = firstArr; else if (firstArr === -1) start = firstObj; else start = Math.min(firstObj, firstArr);
      if (start > 0) t = t.slice(start);
      // find matching end for first char
      const openChar = t[0];
      const closeChar = openChar === '{' ? '}' : openChar === '[' ? ']' : null;
      if (!closeChar) return t;
      // simple stack-based find matching bracket
      let depth = 0; let endIndex = -1;
      for (let i = 0; i < t.length; i++) {
        const ch = t[i];
        if (ch === openChar) depth++;
        else if (ch === closeChar) { depth--; if (depth === 0) { endIndex = i; break; } }
      }
      if (endIndex !== -1) return t.slice(0, endIndex + 1);
      return t;
    }

    // try validation, attempt to recover if it fails
    let validationError = null;
    try {
      ReviewSchema.parse(parsed);
    } catch (e) {
      validationError = e;
      console.warn('Initial schema validation failed, attempting to clean model output');
      const cleaned = cleanModelJson(raw);
      try {
        const reparsed = JSON.parse(cleaned);
        // merge parsed replacement and required meta
        parsed = reparsed;
        parsed.meta = parsed.meta || {};
        parsed.meta.model = MODEL;
        parsed.meta.duration = durationSecs;
        parsed.meta.attemptsLeft = Math.max(0, attemptsLeftFor(userId) - 1);
        ReviewSchema.parse(parsed);
        validationError = null;
        console.log('Recovered valid JSON from cleaned model output');
      } catch (e2) {
        validationError = e2;
        console.error('Failed to recover valid JSON after cleaning', e2 && e2.message);
        // Log raw and cleaned outputs for debugging
        console.error('Model raw output:');
        console.error(raw);
        console.error('Model cleaned output:');
        console.error(cleaned);
        // respond with both raw and cleaned for debugging
        return res.status(502).json({ error: 'Model returned invalid JSON schema', raw, cleaned, validationError: String(e2) });
      }
    }

    // decrement attempts (charge) and cache result
    try {
      const remaining = incrementAttempts(userId);
      parsed.meta.attemptsLeft = remaining;
      if (videoHash) setCachedAnalysis(videoHash, parsed);
    } catch (e) {
      console.warn('Failed to increment attempts or cache:', e && e.message);
    }

    return res.json(parsed);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  } finally {
    cleanupPaths([framesDir, tmpVideo]);
  }
});

async function getTenantBySlug(slug) {
  const { rows } = await query('select * from tenants where slug=$1', [slug]);
  if (!rows.length) throw new Error('Tenant not found');
  return rows[0];
}

async function isSuppressed(tenantId, address) {
  const { rows } = await query(
    'select 1 from email_suppressions where tenant_id=$1 and lower(address)=lower($2) limit 1',
    [tenantId, address]
  );
  return !!rows.length;
}

/** POST /api/email/send */
app.post('/api/email/send', async (req, res) => {
  const schema = z.object({
    tenant_slug: z.string().min(1),
    to: z.string().email(),
    from: z.string().email().optional(),
    subject: z.string().min(1).optional(),
    html: z.string().optional(),
    text: z.string().optional(),
    template_name: z.string().optional(),
    template_vars: z.record(z.any()).optional(),
    in_reply_to_id: z.number().optional(),
    references: z.array(z.string()).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const t = await getTenantBySlug(parsed.data.tenant_slug);

    if (await isSuppressed(t.id, parsed.data.to)) {
      return res.status(400).json({ error: 'Recipient is suppressed (bounce/complaint/unsubscribe).' });
    }

    let subject = parsed.data.subject;
    let html = parsed.data.html;
    let text = parsed.data.text;
    let from = parsed.data.from;

    if (parsed.data.template_name) {
      const { rows } = await query(
        `select * from email_templates where tenant_id=$1 and name=$2 and is_active=true order by version desc limit 1`,
        [t.id, parsed.data.template_name]
      );
      if (!rows.length) return res.status(400).json({ error: 'Active template not found' });
      const tpl = rows[0];
      subject = subject || renderTemplate(tpl.subject, parsed.data.template_vars);
      html = html || renderTemplate(tpl.html, parsed.data.template_vars);
      text = text || renderTemplate(tpl.text, parsed.data.template_vars);
    }

    if (!subject) return res.status(400).json({ error: 'subject required (or via template)' });

    // default from: fetch from smtp_credentials
    if (!from) {
      const r = await query(`select from_address, from_name from smtp_credentials where tenant_id=$1 order by id asc limit 1`, [t.id]);
      if (!r.rows.length) return res.status(400).json({ error: 'No SMTP credentials configured' });
      const c = r.rows[0];
      from = c.from_name ? `${c.from_name} <${c.from_address}>` : c.from_address;
    }

    // Build metadata for replies
    const meta = {
      direction: 'outbound',
      type: parsed.data.in_reply_to_id ? 'reply' : 'new'
    };
    
    if (parsed.data.in_reply_to_id) {
      meta.in_reply_to_id = parsed.data.in_reply_to_id;
    }
    
    if (parsed.data.references) {
      meta.references = parsed.data.references;
    }

    const ins = await query(
      `insert into email_messages
        (tenant_id, template_id, from_address, to_address, subject, html, text, status, queued_at, meta)
       values ($1, null, $2, $3, $4, $5, $6, 'queued', now(), $7)
       returning id`,
      [t.id, from, parsed.data.to, subject, html || null, text || null, JSON.stringify(meta)]
    );

    // event: queued
    await query(
      `insert into email_events (message_id, tenant_id, event_type, payload)
       values ($1, $2, 'queued', '{}'::jsonb)`,
      [ins.rows[0].id, t.id]
    );

    res.json({ id: ins.rows[0].id, status: 'queued' });
  } catch (e) {
    console.error(e);
    // In development, if the error is a DB connectivity error, return an empty
    // list so the frontend can render the inbox UI without a running Postgres.
    if (process.env.NODE_ENV !== 'production' && (e.code === 'ECONNREFUSED' || String(e).includes('ECONNREFUSED'))) {
      return res.json([]);
    }
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/email/webhooks/generic */
app.post('/api/email/webhooks/generic', async (req, res) => {
  const schema = z.object({
    tenant_slug: z.string(),
    provider: z.enum(['sendgrid','mailgun','ses','smtp']).optional(),
    provider_message_id: z.string().optional(),
    event_type: z.enum(['open','click','bounce','complaint','unsubscribe','sent','failure']),
    payload: z.record(z.any()).default({})
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const t = await getTenantBySlug(parsed.data.tenant_slug);
    const pmid = parsed.data.provider_message_id || (req.body['Message-Id'] || req.body['messageId']);

    // find message by provider id, otherwise ignore
    const { rows } = await query('select id from email_messages where provider_message_id=$1 and tenant_id=$2 limit 1', [pmid, t.id]);
    if (!rows.length) return res.status(202).json({ ok: true, note: 'message not found for provider id' });

    const msgId = rows[0].id;
    await query(
      `insert into email_events (message_id, tenant_id, event_type, payload) values ($1,$2,$3,$4::jsonb)`,
      [msgId, t.id, parsed.data.event_type, JSON.stringify(parsed.data.payload)]
    );

    // minimal status sync for bounces/complaints
    if (parsed.data.event_type === 'bounce') {
      await query(`update email_messages set status='bounced' where id=$1`, [msgId]);
      const to = req.body.to || req.body.recipient || null;
      if (to) {
        await query(
          `insert into email_suppressions (tenant_id, address, reason, detail)
           values ($1,$2,'bounce','provider webhook')
           on conflict (tenant_id, address) do nothing`,
          [t.id, to]
        );
      }
    }
    if (parsed.data.event_type === 'complaint') {
      await query(`update email_messages set status='complained' where id=$1`, [msgId]);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Create a tracked link (simple helper API for dev; production should validate auth)
app.post('/api/links', express.json(), async (req, res) => {
  const { user_id, slug, destination_url, title, product_id, channel, meta } = req.body;
  if (!user_id || !destination_url) return res.status(400).json({ error: 'user_id and destination_url required' });

  // sanitize channel and generate slug if missing
  let newSlug = slug && String(slug).trim();
  if (!newSlug) {
    const base = product_id ? `p${product_id}` : 'link';
    const ch = channel ? String(channel).replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 10) : 'gen';
    newSlug = `${base}-${ch}-${crypto.randomBytes(3).toString('hex')}`;
  }

  try {
    const ins = await query(
      `insert into tracked_links (user_id, slug, destination_url, title, product_id, channel, meta) values ($1, $2, $3, $4, $5, $6, $7) returning *`,
      [user_id, newSlug, destination_url, title || null, product_id || null, channel || null, meta ? JSON.stringify(meta) : null]
    );
    res.json(ins.rows[0]);
  } catch (e) {
    console.error('Failed to create tracked link', e && e.message);
    // If slug conflict, return 409 so client can retry (or client can omit slug to let server generate)
    if (String(e).includes('duplicate key') || String(e).includes('unique')) {
      return res.status(409).json({ error: 'slug conflict' });
    }
    res.status(500).json({ error: e.message });
  }
});

// List links for a user (optional product filter)
app.get('/api/links', async (req, res) => {
  const user = req.query.user;
  const productId = req.query.product_id;
  try {
    const params = [];
    let where = '';
    if (user) {
      // allow users stored as UUID or text
      params.push(user);
      where += `where user_id::text = $${params.length}`;
    }
    if (productId) {
      params.push(productId);
      where += where ? ` and product_id = $${params.length}` : `where product_id = $${params.length}`;
    }
    const q = `select id, user_id, slug, destination_url, title, product_id, channel, meta, created_at from tracked_links ${where} order by created_at desc limit 100`;
    const { rows } = await query(q, params);
    res.json(rows);
  } catch (e) {
    console.error('Failed to list links', e && e.message);
    res.status(500).json({ error: e.message });
  }
});

// Redirect endpoint: logs click and redirects
app.get('/l/:slug', async (req, res) => {
  const { slug } = req.params;
  const channel = (req.query.t || 'unknown').toLowerCase();
  try {
    const { rows } = await query('select id, destination_url from tracked_links where slug=$1 limit 1', [slug]);
    if (!rows.length) return res.status(404).send('Link not found');
    const link = rows[0];

    // ensure visitor id cookie exists
    try {
      const cookieHeader = req.get('cookie') || '';
      const hasFid = cookieHeader.split(';').map(c => c.trim()).some(c => c.startsWith('fid='));
      let visitorId = null;
      if (hasFid) {
        visitorId = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('fid='))?.split('=')[1];
      } else {
        // generate a visitor id and set cookie (30 days)
        visitorId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
        // httpOnly cookie to avoid tampering from JS
        res.cookie('fid', visitorId, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
      }

      // log click with visitor_id when available
      try {
        await query(
          `insert into link_clicks (link_id, channel, ip_address, user_agent, referrer, visitor_id) values ($1,$2,$3,$4,$5,$6)`,
          [link.id, channel, req.ip, req.headers['user-agent'] || '', req.get('referer') || '', visitorId]
        );
      } catch (e) { console.warn('Failed to log click', e && e.message); }
    } catch (e) {
      console.warn('Visitor cookie handling failed', e && e.message);
      // fallback to logging without visitor id
      try {
        await query(
          `insert into link_clicks (link_id, channel, ip_address, user_agent, referrer) values ($1,$2,$3,$4,$5)`,
          [link.id, channel, req.ip, req.headers['user-agent'] || '', req.get('referer') || '']
        );
      } catch (e2) { console.warn('Failed to log click fallback', e2 && e2.message); }
    }

      // Create a file-backed click record (dev fallback) so affiliate flow can use a clickId cookie
      try {
        const meta = link.meta && typeof link.meta === 'object' ? link.meta : (link.meta ? JSON.parse(link.meta) : {});
        const affiliateId = link.user_id || null;
        if (fileDb && affiliateId) {
          const click = fileDb.createClick({ affiliateId, productId: link.product_id || null, linkCustomRatePct: meta && meta.customCommissionPct ? Number(meta.customCommissionPct) : undefined });
          // Set cookie so create-order picks it up (30 days)
          try { res.cookie('aff_click', click.id, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 }); } catch (e) { console.warn('Failed to set aff_click cookie', e && e.message); }
        }
      } catch (e) { console.warn('Failed to create file-backed click for affiliate flow', e && e.message); }

    return res.redirect(link.destination_url);
  } catch (e) {
    console.error(e);
    return res.status(500).send('Server error');
  }
});

// Analytics endpoint
app.get('/api/links/:slug/stats', async (req, res) => {
  const { slug } = req.params;
  try {
    const { rows: linkRows } = await query('select id from tracked_links where slug=$1', [slug]);
    if (!linkRows.length) return res.status(404).json({ error: 'Link not found' });
    const linkId = linkRows[0].id;

    const { rows } = await query(`
      select channel, count(*) as clicks, count(distinct ip_address) as unique_visitors
      from link_clicks
      where link_id=$1
      group by channel
      order by clicks desc
    `, [linkId]);

    res.json({ linkId, stats: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// simple healthcheck for dev / monitoring
app.get('/__health', (req, res) => {
  res.json({ ok: true });
});

// VPS Mail Server Integration Endpoints
app.get('/api/smtp/test-connection', async (req, res) => {
  try {
    const nodemailer = require('nodemailer');
    
    const config = {
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT || 587,
      secure: process.env.MAIL_SECURE === 'true',
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates
      }
    };
    
    const transporter = nodemailer.createTransport(config);
    
    // Test the connection
    await transporter.verify();
    
    res.json({ 
      success: true, 
      message: 'SMTP connection successful',
      config: {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.auth.user
      }
    });
  } catch (error) {
    console.error('SMTP test error:', error);
    res.json({ 
      success: false, 
      error: error.message,
      message: 'SMTP connection failed'
    });
  }
});

app.get('/api/emails/stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      total: 0,
      sent: 0,
      failed: 0,
      pending: 0
    },
    message: 'Email stats endpoint working (mock data)'
  });
});

app.post('/api/tenants/:tenantId/campaigns/test', async (req, res) => {
  try {
    const { to, html, subject } = req.body;
    const tenantId = req.params.tenantId;
    
    if (!to || !html) {
      return res.status(400).json({ error: 'to and html fields required' });
    }
    
    const nodemailer = require('nodemailer');
    
    const config = {
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT || 587,
      secure: process.env.MAIL_SECURE === 'true',
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates
      }
    };
    
    if (!config.host || !config.auth.user || !config.auth.pass) {
      return res.json({
        success: true,
        simulation: true,
        message: 'Campaign test completed (simulation mode - VPS not configured)',
        config: 'VPS mail server not configured. Set MAIL_HOST, MAIL_USERNAME, and MAIL_PASSWORD in .env'
      });
    }
    
    const transporter = nodemailer.createTransport(config);
    
    const mailOptions = {
      from: `"Fotonix" <${config.auth.user}>`,
      to: to,
      subject: subject || 'Test Email from VPS Mail Server',
      html: html,
      text: html.replace(/<[^>]*>/g, '') // Strip HTML for plain text
    };
    
    const result = await transporter.sendMail(mailOptions);
    
    res.json({
      success: true,
      message: 'Test email sent successfully via VPS mail server',
      messageId: result.messageId,
      to: to,
      vpsHost: config.host
    });
    
  } catch (error) {
    console.error('Campaign test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to send test email'
    });
  }
});

/** GET /api/email/messages */
app.get('/api/email/messages', async (req, res) => {
  const schema = z.object({
    tenant: z.string(),
    status: z.string().optional(),
    q: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(25),
    cursor: z.string().optional()
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const t = await getTenantBySlug(parsed.data.tenant);
    const params = [t.id];
    let where = 'where tenant_id=$1';
    
    // Filter for received/inbound messages by default, or specific status
    if (parsed.data.status === 'received') {
      where += ` and (status='received' or meta->>'direction'='inbound')`;
    } else if (parsed.data.status) {
      params.push(parsed.data.status);
      where += ` and status=$${params.length}`;
    } else {
      // Default to showing received messages in inbox
      where += ` and (status='received' or meta->>'direction'='inbound')`;
    }
    
    if (parsed.data.q) {
      params.push(`%${parsed.data.q}%`);
      where += ` and (from_address ilike $${params.length} or to_address ilike $${params.length} or subject ilike $${params.length})`;
    }

    // Add cursor-based pagination
    if (parsed.data.cursor) {
      params.push(parsed.data.cursor);
      where += ` and created_at < $${params.length}`;
    }
    
    params.push(parsed.data.limit);
    const { rows } = await query(
      `select id, from_address, to_address, subject, status, created_at, sent_at, meta,
              coalesce(meta->>'from_name', split_part(from_address, '@', 1)) as from_name,
              coalesce(meta->>'snippet', substring(text from 1 for 120)) as snippet,
              text is not null or html is not null as has_content
         from email_messages
       ${where}
       order by created_at desc
       limit $${params.length}`, params
    );

    // Add pagination info
    const result = {
      items: rows.map(row => ({
        ...row,
        from: row.from_address,
        to: row.to_address,
        date: row.created_at,
        received_at: row.created_at,
        preview: row.snippet
      })),
      next_cursor: rows.length === parsed.data.limit ? rows[rows.length - 1].created_at : null
    };

    res.json(result);
  } catch (e) {
    console.error(e);
    // In development, if Postgres is unavailable, return an empty list so the
    // frontend can render the inbox UI without a running database.
    if (process.env.NODE_ENV !== 'production' && (e.code === 'ECONNREFUSED' || String(e).includes('ECONNREFUSED'))) {
      return res.json({ items: [], next_cursor: null });
    }
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/email/messages/:id */
app.get('/api/email/messages/:id', async (req, res) => {
  const schema = z.object({ tenant: z.string() });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const t = await getTenantBySlug(parsed.data.tenant);
    const id = Number(req.params.id);
    const { rows } = await query(
      `select id, tenant_id, template_id, from_address, to_address, subject, html, text, status, provider_message_id, error, meta, created_at, queued_at, sent_at, opened_at, clicked_at
         from email_messages where id=$1 and tenant_id=$2 limit 1`,
      [id, t.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Message not found' });
    
    const message = rows[0];
    
    // Transform for inbox compatibility
    const result = {
      ...message,
      from: message.meta?.from_name ? 
        [{ name: message.meta.from_name, address: message.from_address }] : 
        [{ address: message.from_address }],
      to: [{ address: message.to_address }],
      headers: message.meta?.headers || {}
    };
    
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/email/messages/mark-read */
app.post('/api/email/messages/mark-read', async (req, res) => {
  const schema = z.object({
    tenant: z.string(),
    message_ids: z.array(z.number()),
    read: z.boolean()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const t = await getTenantBySlug(parsed.data.tenant);
    await query(
      `update email_messages set is_read=$1 where id = ANY($2) and tenant_id=$3`,
      [parsed.data.read, parsed.data.message_ids, t.id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/email/messages/star */
app.post('/api/email/messages/star', async (req, res) => {
  const schema = z.object({
    tenant: z.string(),
    message_ids: z.array(z.number()),
    starred: z.boolean()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const t = await getTenantBySlug(parsed.data.tenant);
    await query(
      `update email_messages set is_starred=$1 where id = ANY($2) and tenant_id=$3`,
      [parsed.data.starred, parsed.data.message_ids, t.id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/email/messages/archive */
app.post('/api/email/messages/archive', async (req, res) => {
  const schema = z.object({
    tenant: z.string(),
    message_ids: z.array(z.number())
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const t = await getTenantBySlug(parsed.data.tenant);
    await query(
      `update email_messages set is_archived=true where id = ANY($1) and tenant_id=$2`,
      [parsed.data.message_ids, t.id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

/** DELETE /api/email/messages/delete */
app.delete('/api/email/messages/delete', async (req, res) => {
  const schema = z.object({
    tenant: z.string(),
    message_ids: z.array(z.number())
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const t = await getTenantBySlug(parsed.data.tenant);
    await query(
      `delete from email_messages where id = ANY($1) and tenant_id=$2`,
      [parsed.data.message_ids, t.id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/email/labels */
app.get('/api/email/labels', async (req, res) => {
  const schema = z.object({ tenant: z.string() });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const t = await getTenantBySlug(parsed.data.tenant);
    const { rows } = await query(
      `select * from email_labels where tenant_id=$1 order by is_system desc, name asc`,
      [t.id]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/email/signatures */
app.get('/api/email/signatures', async (req, res) => {
  const schema = z.object({ tenant: z.string() });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const t = await getTenantBySlug(parsed.data.tenant);
    const { rows } = await query(
      `select * from email_signatures where tenant_id=$1 order by is_default desc, name asc`,
      [t.id]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/email/messages/:id/events */
app.get('/api/email/messages/:id/events', async (req, res) => {
  const schema = z.object({ tenant: z.string() });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const t = await getTenantBySlug(parsed.data.tenant);
    const id = Number(req.params.id);
    const { rows } = await query(
      `select id, message_id, tenant_id, event_type, payload, occurred_at
         from email_events where message_id=$1 and tenant_id=$2 order by occurred_at asc`,
      [id, t.id]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Welcome email function
async function sendWelcomeEmail(userData) {
  try {
    // Use the existing email API to send welcome email
    const welcomeEmailData = {
      tenant_slug: 'fotonix', // Replace with your actual tenant slug
      to: userData.email,
      subject: `Welcome to Fotonix, ${userData.firstName}! Your 30-Day Trial is Active 🚀`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 15px; overflow: hidden;">
          <!-- Header -->
          <div style="padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 32px; font-weight: bold;">Welcome to Fotonix!</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">Your 30-day free trial is now active</p>
          </div>
          
          <!-- Content -->
          <div style="background: white; color: #333; padding: 40px 30px;">
            <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Hi ${userData.firstName},
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Congratulations! Your Fotonix account is ready and your <strong>30-day free trial</strong> is now active.
            </p>
            
            <div style="background: #f8f9ff; border: 2px solid #667eea; border-radius: 10px; padding: 25px; margin: 25px 0;">
              <h3 style="margin: 0 0 15px 0; color: #667eea;">✨ What you get with your trial:</h3>
              <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
                <li><strong>Email Campaign Builder</strong> - Create high-converting email sequences</li>
                <li><strong>Funnel Builder</strong> - Build proven sales funnels that convert</li>
                <li><strong>Affiliate Management</strong> - Find and manage affiliates automatically</li>
                <li><strong>Link Tracking</strong> - Track every click and conversion</li>
                <li><strong>AI Analytics</strong> - Get intelligent insights to grow faster</li>
                <li><strong>24/7 Support</strong> - We're here to help you succeed</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/#member-dashboard" 
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                Access Your Dashboard →
              </a>
            </div>
            
            <div style="background: #fff9e6; border: 2px solid #ffd700; border-radius: 10px; padding: 20px; margin: 25px 0;">
              <h4 style="margin: 0 0 10px 0; color: #b8860b;">🎯 Get Results Fast:</h4>
              <p style="margin: 0; line-height: 1.6; color: #666;">
                Most of our members see their first affiliate commissions within 14 days. 
                Follow our quick setup guide in your dashboard to get started immediately!
              </p>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6; margin: 20px 0;">
              <strong>Business Type:</strong> ${userData.businessType}<br>
              <strong>Trial Ends:</strong> ${new Date(userData.trialEndDate).toLocaleDateString()}<br>
              <strong>Account Email:</strong> ${userData.email}
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; margin: 20px 0;">
              Need help getting started? Reply to this email or contact our support team - we're here to ensure you succeed!
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
              Best regards,<br>
              <strong>The Fotonix Team</strong>
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background: #f8f9ff; padding: 20px 30px; text-align: center; color: #666; font-size: 14px;">
            <p style="margin: 0;">
              This email was sent to ${userData.email} because you signed up for a Fotonix free trial.
            </p>
          </div>
        </div>
      `,
      text: `
Welcome to Fotonix, ${userData.firstName}!

Your 30-day free trial is now active and ready to use.

What you get with your trial:
• Email Campaign Builder - Create high-converting email sequences  
• Funnel Builder - Build proven sales funnels that convert
• Affiliate Management - Find and manage affiliates automatically
• Link Tracking - Track every click and conversion
• AI Analytics - Get intelligent insights to grow faster
• 24/7 Support - We're here to help you succeed

Access your dashboard: ${process.env.FRONTEND_URL || 'http://localhost:3001'}/#member-dashboard

Account Details:
Business Type: ${userData.businessType}
Trial Ends: ${new Date(userData.trialEndDate).toLocaleDateString()}
Account Email: ${userData.email}

Need help? Reply to this email or contact our support team.

Best regards,
The Fotonix Team
      `.trim()
    };

    // Use the existing email sending endpoint
    const response = await fetch(`http://localhost:${PORT}/api/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(welcomeEmailData)
    });

    if (!response.ok) {
      throw new Error(`Email API responded with status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Welcome email sending failed:', error);
    throw error;
  }
}

// Member products endpoint for StoreBuilder
app.get('/api/member/products', async (req, res) => {
  try {
    const userId = req.headers['x-member-uid'];
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }
    
    // For now, return mock products since we don't have a products table
    // In the future, this would query a products table filtered by userId
    const mockProducts = [
      { 
        id: '1', 
        title: 'Fotonix Lumina Mirror', 
        price: 29.99, 
        priceCents: 2999,
        description: 'Beautiful LED mirror with customizable lighting', 
        images: ['https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&h=400&fit=crop']
      },
      { 
        id: '2', 
        title: 'Light Up Design Pro', 
        price: 19.99, 
        priceCents: 1999,
        description: 'Custom light-up creation with premium features', 
        images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop']
      },
      { 
        id: '3', 
        title: 'Custom Cut Mirror', 
        price: 40.00, 
        priceCents: 4000,
        description: 'Precisely cut mirror to your specifications', 
        images: ['https://images.unsplash.com/photo-1586953208462-d35b1f4468bc?w=400&h=400&fit=crop']
      },
      { 
        id: '4', 
        title: 'LED Strip Kit', 
        price: 15.99, 
        priceCents: 1599,
        description: 'Complete LED strip lighting kit', 
        images: ['https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=400&fit=crop']
      },
      { 
        id: '5', 
        title: 'Smart Mirror Controller', 
        price: 89.99, 
        priceCents: 8999,
        description: 'Advanced smart mirror control system', 
        images: ['https://images.unsplash.com/photo-1586953208458-b95a79798f07?w=400&h=400&fit=crop']
      },
      { 
        id: '6', 
        title: 'Premium Reflection Film', 
        price: 25.50, 
        priceCents: 2550,
        description: 'High-quality reflective film for DIY mirrors', 
        images: ['https://images.unsplash.com/photo-1586953208455-d35b1f4468bc?w=400&h=400&fit=crop']
      }
    ];
    
    res.json(mockProducts);
  } catch (error) {
    console.error('Products API error:', error);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

// ===== STORE BUILDER API ENDPOINTS =====

// Create or update a store
app.post('/api/stores', express.json(), async (req, res) => {
  try {
    console.log('📝 POST /api/stores received:', { userId: req.body.userId, handle: req.body.handle, isPublished: req.body.isPublished });
    const { userId, handle, displayName, description, blocks, isPublished, returnsPolicy } = req.body;
    
    if (!userId || !handle) {
      return res.status(400).json({ error: 'userId and handle are required' });
    }
    
    // Clean the handle (lowercase, alphanumeric + hyphens only)
    const cleanHandle = handle.toLowerCase().replace(/[^a-z0-9-]/g, '');
    
    // Check if handle is already taken by another user
    const existingStore = await query(
      'SELECT user_id FROM stores WHERE handle = $1 AND user_id != $2', 
      [cleanHandle, userId]
    );
    
    if (existingStore.rows.length > 0) {
      return res.status(409).json({ error: 'Handle already taken' });
    }
    
    // Upsert the store (update if exists, insert if new)
    const result = await query(`
      INSERT INTO stores (user_id, handle, display_name, description, blocks, is_published, theme, logo, returns_policy, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (user_id, handle) 
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        blocks = EXCLUDED.blocks,
        is_published = EXCLUDED.is_published,
        theme = EXCLUDED.theme,
        logo = EXCLUDED.logo,
        returns_policy = EXCLUDED.returns_policy,
        updated_at = NOW()
      RETURNING *
    `, [userId, cleanHandle, displayName || '', description || '', JSON.stringify(blocks), isPublished || false, req.body.theme || null, req.body.logo || null, returnsPolicy ? JSON.stringify(returnsPolicy) : null]);
    
    res.json({ success: true, store: result.rows[0] });
  } catch (error) {
    console.error('Store save error:', error);
    res.status(500).json({ error: 'Failed to save store' });
  }
});

// Check if a handle is available
app.get('/api/stores/check-handle', async (req, res) => {
  try {
    const { handle } = req.query;
    
    if (!handle) {
      return res.status(400).json({ error: 'Handle is required' });
    }
    
    const cleanHandle = handle.toLowerCase().replace(/[^a-z0-9-]/g, '');
    
    const result = await query(
      'SELECT id FROM stores WHERE handle = $1', 
      [cleanHandle]
    );
    
    const available = result.rows.length === 0;
    
    res.json({ available, handle: cleanHandle });
  } catch (error) {
    console.error('Check handle error:', error);
    res.status(500).json({ error: 'Failed to check handle availability' });
  }
});

// Get a user's current/active store (most recent)
app.get('/api/stores/user/:userId/current', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await query(
      'SELECT * FROM stores WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1', 
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.json({ store: null });
    }
    
    res.json({ store: result.rows[0] });
  } catch (error) {
    console.error('Get current store error:', error);
    res.status(500).json({ error: 'Failed to get current store' });
  }
});

// Get a user's stores
app.get('/api/stores/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await query(
      'SELECT * FROM stores WHERE user_id = $1 ORDER BY updated_at DESC', 
      [userId]
    );
    
    res.json({ stores: result.rows });
  } catch (error) {
    console.error('Get stores error:', error);
    res.status(500).json({ error: 'Failed to get stores' });
  }
});

// Get a store by handle (public endpoint for viewing stores)
app.get('/api/stores/view/:handle', async (req, res) => {
  try {
    const { handle } = req.params;
    
    const result = await query(
      'SELECT * FROM stores WHERE handle = $1 AND is_published = true', 
      [handle]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found or not published' });
    }
    
    res.json({ store: result.rows[0] });
  } catch (error) {
    console.error('Get store error:', error);
    res.status(500).json({ error: 'Failed to get store' });
  }
});

// Delete a store
app.delete('/api/stores/:userId/:handle', async (req, res) => {
  try {
    const { userId, handle } = req.params;
    
    const result = await query(
      'DELETE FROM stores WHERE user_id = $1 AND handle = $2 RETURNING *', 
      [userId, handle]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete store error:', error);
    res.status(500).json({ error: 'Failed to delete store' });
  }
});

// Store chatbot interaction endpoint
app.post('/api/stores/:handle/chat', express.json(), async (req, res) => {
  try {
    const { handle } = req.params;
    const { message, conversationHistory = [] } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Get store configuration
    const storeResult = await query(
      'SELECT * FROM stores WHERE handle = $1 AND is_published = true', 
      [handle]
    );
    
    if (storeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    const store = storeResult.rows[0];
    const blocks = JSON.parse(store.blocks || '[]');
    
    // Find chatbot configuration
    const chatbotBlock = blocks.find(block => block.type === 'chatbot');
    if (!chatbotBlock || !chatbotBlock.data.enabled) {
      return res.status(400).json({ error: 'Chatbot not enabled for this store' });
    }
    
    const chatbotConfig = chatbotBlock.data;
    
    // Get product information for context
    const productGridBlocks = blocks.filter(block => block.type === 'productGrid');
    let products = [];
    
    for (const productBlock of productGridBlocks) {
      if (productBlock.data.products) {
        products = products.concat(productBlock.data.products);
      }
    }
    
    // Build context for AI
    const systemPrompt = `${chatbotConfig.prompt}

Store Information:
- Store Name: ${store.display_name || handle}
- Description: ${store.description || ''}

Available Products:
${products.map(p => `- ${p.title}: £${typeof p.price === 'number' ? p.price.toFixed(2) : (p.priceCents / 100).toFixed(2)} - ${p.description || 'No description'}`).join('\n')}

Instructions:
- Be helpful and friendly
- Answer questions about products
- Recommend products based on customer needs
- Keep responses concise and engaging
- If asked about products not in the list, politely explain you can only help with the available products`;

    // For now, return a simple response (in production, you'd call OpenAI API)
    const responses = [
      "Hi! I'm here to help you find the perfect products. What are you looking for?",
      "Thanks for your question! Let me help you with that.",
      "I'd be happy to recommend some great products for you!",
      "That's a great question! Based on our products, I'd suggest...",
    ];
    
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    res.json({
      response,
      botName: chatbotConfig.botName,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Store chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// Default to 5002 to match the frontend proxy configured in package.json
const PORT = process.env.PORT || 4000;

async function tryStart() {
  app.listen(PORT, () => {
    console.log(`API on http://localhost:${PORT}`);
  });

  // attempt a simple DB query to check connectivity; if it fails, log a warning
  // and don't start the worker. This allows the Express API to still run for
  // frontend development when Postgres is not available locally.
  try {
    await query('select 1');
    console.log('DB connectivity OK — starting email worker');
    startWorker();
  } catch (err) {
    console.warn('DB not available — email worker will not start. Frontend API routes that require DB will return 500 until DB is reachable.');
    console.warn(err.message || err);
  }
}

tryStart();
