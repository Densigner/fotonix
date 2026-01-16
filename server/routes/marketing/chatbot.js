/**
 * Chatbot API Routes
 * 
 * Handles AI chatbot interactions, qualified leads, and conversation analytics
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');

/**
 * POST /api/chatbot/lead
 * Capture qualified lead from AI chatbot
 */
router.post('/lead', async (req, res) => {
  try {
    const {
      email,
      name,
      businessType,
      monthlyRevenue,
      currentAffiliates,
      mainConcern,
      leadScore,
      conversationData,
      sessionId,
      source,
      timestamp,
      userAgent
    } = req.body;

    // Validate required fields
    if (!email || !sessionId) {
      return res.status(400).json({
        error: 'Email and session ID are required',
        success: false
      });
    }

    // Check if lead already exists
    const existingLead = await db.query(
      'SELECT id FROM leads WHERE email = $1',
      [email]
    );

    let leadId;

    if (existingLead.rows.length > 0) {
      // Update existing lead with chatbot data
      leadId = existingLead.rows[0].id;
      
      await db.query(`
        UPDATE leads SET
          first_name = COALESCE($2, first_name),
          lead_score = GREATEST(COALESCE(lead_score, 0), $3),
          updated_at = NOW()
        WHERE id = $1
      `, [leadId, name, leadScore || 0]);
      
    } else {
      // Create new lead
      const newLead = await db.query(`
        INSERT INTO leads (email, first_name, first_source, lead_score, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING id
      `, [email, name, source, leadScore || 0]);
      
      leadId = newLead.rows[0].id;
    }

    // Store chatbot qualification data
    await db.query(`
      INSERT INTO chatbot_conversations (
        lead_id, session_id, business_type, monthly_revenue, current_affiliates,
        main_concern, lead_score, conversation_data, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (session_id) DO UPDATE SET
        lead_id = EXCLUDED.lead_id,
        business_type = EXCLUDED.business_type,
        monthly_revenue = EXCLUDED.monthly_revenue,
        current_affiliates = EXCLUDED.current_affiliates,
        main_concern = EXCLUDED.main_concern,
        lead_score = EXCLUDED.lead_score,
        conversation_data = EXCLUDED.conversation_data,
        updated_at = NOW()
    `, [
      leadId,
      sessionId,
      businessType,
      monthlyRevenue,
      currentAffiliates,
      mainConcern,
      leadScore || 0,
      JSON.stringify(conversationData || {}),
      userAgent
    ]);

    // Add lead source tracking
    await db.query(`
      INSERT INTO lead_sources (lead_id, source, lead_magnet, timestamp, user_agent)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (lead_id, source) DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        user_agent = EXCLUDED.user_agent
    `, [leadId, 'ai-chatbot', 'qualified-conversation', timestamp, userAgent]);

    // Track conversion event
    await db.query(`
      INSERT INTO conversion_events (lead_id, event_type, event_value, timestamp, session_id)
      VALUES ($1, 'chatbot_qualification', $2, $3, $4)
    `, [leadId, JSON.stringify({ leadScore, businessType }), timestamp, sessionId]);

    // Update daily stats
    await db.query(`
      INSERT INTO daily_stats (date, metric, value, source)
      VALUES (CURRENT_DATE, 'chatbot_leads', 1, 'ai-chatbot')
      ON CONFLICT (date, metric, source)
      DO UPDATE SET value = daily_stats.value + 1
    `);

    // Send personalized follow-up email based on qualification
    await sendChatbotFollowUpEmail(email, {
      name,
      businessType,
      leadScore,
      mainConcern
    });

    res.json({
      success: true,
      message: 'Qualified lead captured successfully',
      leadId: leadId,
      leadScore: leadScore
    });

  } catch (error) {
    console.error('Error capturing chatbot lead:', error);
    res.status(500).json({
      error: 'Failed to capture qualified lead',
      success: false
    });
  }
});

/**
 * POST /api/chatbot/interaction
 * Track chatbot interaction events
 */
router.post('/interaction', async (req, res) => {
  try {
    const {
      sessionId,
      eventType,
      eventData,
      timestamp,
      userAgent
    } = req.body;

    if (!sessionId || !eventType) {
      return res.status(400).json({
        error: 'Session ID and event type are required',
        success: false
      });
    }

    // Store interaction event
    await db.query(`
      INSERT INTO chatbot_interactions (
        session_id, event_type, event_data, timestamp, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      sessionId,
      eventType,
      JSON.stringify(eventData || {}),
      timestamp,
      userAgent
    ]);

    // Update conversation stats
    await db.query(`
      INSERT INTO daily_stats (date, metric, value, source)
      VALUES (CURRENT_DATE, 'chatbot_interactions', 1, $1)
      ON CONFLICT (date, metric, source)
      DO UPDATE SET value = daily_stats.value + 1
    `, [eventType]);

    res.json({
      success: true,
      message: 'Interaction tracked successfully'
    });

  } catch (error) {
    console.error('Error tracking chatbot interaction:', error);
    res.status(500).json({
      error: 'Failed to track interaction',
      success: false
    });
  }
});

/**
 * GET /api/chatbot/analytics
 * Get chatbot performance analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    // Total conversations (unique sessions)
    const totalConversations = await db.query(`
      SELECT COUNT(DISTINCT session_id) as count
      FROM chatbot_conversations
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    // Qualified leads from chatbot
    const qualifiedLeads = await db.query(`
      SELECT COUNT(*) as count
      FROM chatbot_conversations
      WHERE lead_score >= 60
      AND created_at >= NOW() - INTERVAL '30 days'
    `);

    // Conversion rate (leads to subscriptions)
    const conversions = await db.query(`
      SELECT COUNT(*) as count
      FROM leads l
      JOIN member_subscriptions ms ON l.email = (
        SELECT email FROM auth.users WHERE uid = ms.member_uid
      )
      WHERE l.first_source = 'ai-chatbot'
      AND l.created_at >= NOW() - INTERVAL '30 days'
    `);

    // Average lead score
    const avgLeadScore = await db.query(`
      SELECT AVG(lead_score) as avg_score
      FROM chatbot_conversations
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    // Top business types
    const businessTypes = await db.query(`
      SELECT business_type, COUNT(*) as count
      FROM chatbot_conversations
      WHERE business_type IS NOT NULL
      AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY business_type
      ORDER BY count DESC
      LIMIT 5
    `);

    // Conversation drop-off points
    const dropOffPoints = await db.query(`
      SELECT event_type, COUNT(*) as count
      FROM chatbot_interactions
      WHERE event_type LIKE '%_exit'
      AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY event_type
      ORDER BY count DESC
    `);

    // Daily conversation volume
    const dailyVolume = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(DISTINCT session_id) as conversations,
        COUNT(*) FILTER (WHERE lead_score >= 60) as qualified_leads
      FROM chatbot_conversations
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    const totalConversationsCount = parseInt(totalConversations.rows[0].count);
    const qualifiedLeadsCount = parseInt(qualifiedLeads.rows[0].count);
    const conversionsCount = parseInt(conversions.rows[0].count);

    res.json({
      success: true,
      analytics: {
        totalConversations: totalConversationsCount,
        qualifiedLeads: qualifiedLeadsCount,
        conversions: conversionsCount,
        qualificationRate: totalConversationsCount > 0 
          ? ((qualifiedLeadsCount / totalConversationsCount) * 100).toFixed(2)
          : 0,
        conversionRate: qualifiedLeadsCount > 0
          ? ((conversionsCount / qualifiedLeadsCount) * 100).toFixed(2)
          : 0,
        averageLeadScore: parseFloat(avgLeadScore.rows[0].avg_score || 0).toFixed(1),
        businessTypes: businessTypes.rows,
        dropOffPoints: dropOffPoints.rows,
        dailyVolume: dailyVolume.rows
      }
    });

  } catch (error) {
    console.error('Error getting chatbot analytics:', error);
    res.status(500).json({
      error: 'Failed to get analytics',
      success: false
    });
  }
});

/**
 * Send personalized follow-up email based on chatbot qualification
 */
async function sendChatbotFollowUpEmail(email, qualification) {
  try {
    const { name, businessType, leadScore, mainConcern } = qualification;

    // Get email templates based on qualification
    const templates = {
      high: {
        subject: `${name}, ready to transform your ${businessType} affiliate program?`,
        content: `
          Hi ${name},
          
          Great chatting with you! Based on our conversation, I can see huge potential for your ${businessType} business.
          
          Since you mentioned ${mainConcern}, I've prepared a custom strategy outline just for you.
          
          Your personalized next steps:
          1. [Custom recommendation based on business type]
          2. [Specific solution for their main concern]
          3. [Timeline and expected results]
          
          Ready to get started? Reply to this email or book a quick 15-minute call here: [calendar link]
          
          Best,
          Alex
          Affiliate Growth Specialist
        `
      },
      medium: {
        subject: `Thanks for chatting, ${name}! Your affiliate growth roadmap inside...`,
        content: `
          Hi ${name},
          
          Thanks for the great conversation! I've put together a custom roadmap for your ${businessType} business.
          
          [Include relevant case study for their business type]
          [Address their specific concern]
          [Provide next steps]
          
          Questions? Just reply to this email.
          
          Cheers,
          Alex
        `
      },
      low: {
        subject: `${name}, here's that ${businessType} case study I mentioned`,
        content: `
          Hi ${name},
          
          Here's the case study I mentioned during our chat...
          
          [Relevant case study]
          [Educational content]
          [Soft call-to-action]
          
          Hope this helps!
          Alex
        `
      }
    };

    const scoreLevel = leadScore >= 80 ? 'high' : leadScore >= 60 ? 'medium' : 'low';
    const template = templates[scoreLevel];

    // In production, use your email service (SendGrid, Mailgun, etc.)
    console.log(`Would send follow-up email to ${email}:`, template);

  } catch (error) {
    console.error('Error sending chatbot follow-up email:', error);
  }
}

module.exports = router;