/**
 * Lead Capture Routes
 * 
 * Handles email submissions from exit-intent popup and other lead magnets
 * Stores leads and triggers email automation sequences
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const nodemailer = require('nodemailer');
const path = require('path');

// Email transporter (configure with your email service)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * POST /api/leads/capture
 * Capture a new lead from exit-intent or other sources
 */
router.post('/capture', async (req, res) => {
  try {
    const { email, source, leadMagnet, timestamp, userAgent, referrer } = req.body;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format',
        success: false 
      });
    }

    // Check if lead already exists
    const existingLead = await db.query(
      'SELECT id, created_at FROM leads WHERE email = $1',
      [email]
    );

    let leadId;
    
    if (existingLead.rows.length > 0) {
      // Update existing lead with new source if different
      leadId = existingLead.rows[0].id;
      
      await db.query(`
        INSERT INTO lead_sources (lead_id, source, lead_magnet, timestamp, user_agent, referrer)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (lead_id, source) DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        user_agent = EXCLUDED.user_agent,
        referrer = EXCLUDED.referrer
      `, [leadId, source, leadMagnet, timestamp, userAgent, referrer]);
      
    } else {
      // Create new lead
      const newLead = await db.query(`
        INSERT INTO leads (email, first_source, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        RETURNING id
      `, [email, source]);
      
      leadId = newLead.rows[0].id;
      
      // Add source tracking
      await db.query(`
        INSERT INTO lead_sources (lead_id, source, lead_magnet, timestamp, user_agent, referrer)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [leadId, source, leadMagnet, timestamp, userAgent, referrer]);
    }

    // Send welcome email with lead magnet
    if (leadMagnet === 'affiliate-revenue-playbook') {
      await sendAffiliatePlaybookEmail(email);
    }

    // Update lead capture stats
    await updateCaptureStats(source);

    res.json({
      success: true,
      message: 'Lead captured successfully',
      leadId: leadId
    });

  } catch (error) {
    console.error('Error capturing lead:', error);
    res.status(500).json({ 
      error: 'Failed to capture lead',
      success: false 
    });
  }
});

/**
 * POST /api/leads/download-link
 * Get download link for lead magnet
 */
router.post('/download-link', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Verify email exists in leads
    const lead = await db.query(
      'SELECT id FROM leads WHERE email = $1',
      [email]
    );
    
    if (lead.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Email not found in our records',
        success: false 
      });
    }

    // Generate or get existing download link
    const downloadUrl = `/assets/lead-magnets/affiliate-revenue-playbook.pdf`;
    
    res.json({
      success: true,
      downloadUrl,
      message: 'Your Affiliate Revenue Playbook is ready for download!'
    });

  } catch (error) {
    console.error('Error getting download link:', error);
    res.status(500).json({ 
      error: 'Failed to get download link',
      success: false 
    });
  }
});

/**
 * GET /api/leads/stats
 * Get lead capture statistics for dashboard
 */
router.get('/stats', async (req, res) => {
  try {
    // Total leads
    const totalLeads = await db.query('SELECT COUNT(*) FROM leads');
    
    // Today's leads
    const todayLeads = await db.query(`
      SELECT COUNT(*) FROM leads 
      WHERE DATE(created_at) = CURRENT_DATE
    `);
    
    // Leads by source (last 30 days)
    const sourceStats = await db.query(`
      SELECT ls.source, COUNT(*) as count
      FROM lead_sources ls
      JOIN leads l ON ls.lead_id = l.id
      WHERE l.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY ls.source
      ORDER BY count DESC
    `);
    
    // Recent leads
    const recentLeads = await db.query(`
      SELECT l.email, l.first_source, l.created_at
      FROM leads l
      ORDER BY l.created_at DESC
      LIMIT 10
    `);
    
    // Conversion rates by source
    const conversionRates = await db.query(`
      SELECT 
        ls.source,
        COUNT(DISTINCT ls.lead_id) as conversions,
        COUNT(DISTINCT v.id) as visits,
        ROUND(
          COUNT(DISTINCT ls.lead_id) * 100.0 / NULLIF(COUNT(DISTINCT v.id), 0), 2
        ) as conversion_rate
      FROM lead_sources ls
      LEFT JOIN page_visits v ON v.source = ls.source 
        AND DATE(v.timestamp) = DATE(ls.timestamp)
      WHERE ls.timestamp >= NOW() - INTERVAL '7 days'
      GROUP BY ls.source
      ORDER BY conversion_rate DESC
    `);

    res.json({
      total: parseInt(totalLeads.rows[0].count),
      today: parseInt(todayLeads.rows[0].count),
      sources: sourceStats.rows.reduce((acc, row) => {
        acc[row.source] = parseInt(row.count);
        return acc;
      }, {}),
      recent: recentLeads.rows,
      conversionRates: conversionRates.rows
    });

  } catch (error) {
    console.error('Error getting lead stats:', error);
    res.status(500).json({ 
      error: 'Failed to get statistics',
      success: false 
    });
  }
});

/**
 * Send affiliate playbook email
 */
async function sendAffiliatePlaybookEmail(email) {
  try {
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@fotonix.co.uk',
      to: email,
      subject: '🎉 Your FREE £10,000 Affiliate Revenue Playbook is here!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your Affiliate Revenue Playbook</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px;">🎉 Your Playbook is Ready!</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">The £10,000 Affiliate Revenue Playbook</p>
          </div>

          <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
            <h2 style="color: #2d3748; margin-top: 0;">What's Inside Your Playbook:</h2>
            <ul style="color: #4a5568; padding-left: 20px;">
              <li>✅ The "Magnetic Affiliate" recruitment system that fills your program with top performers</li>
              <li>✅ Commission structures that attract and retain high-converting affiliates</li>
              <li>✅ 7 email templates with proven 40%+ open rates</li>
              <li>✅ Complete legal compliance checklist (avoid costly mistakes)</li>
              <li>✅ Performance tracking spreadsheet templates</li>
              <li>✅ Case study: How one business went from £0 to £10k/month in 90 days</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://fotonix.co.uk/assets/lead-magnets/affiliate-revenue-playbook.pdf" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 18px; display: inline-block;">
              📥 Download Your Playbook Now
            </a>
          </div>

          <div style="background: #e6f3ff; border-left: 4px solid #3182ce; padding: 20px; margin: 25px 0;">
            <h3 style="color: #2d3748; margin-top: 0;">💡 Ready to Take Action?</h3>
            <p style="margin-bottom: 15px;">While you're implementing these strategies, why not see how Fotonix can automate your entire affiliate program?</p>
            <p style="margin-bottom: 0;">
              <a href="https://fotonix.co.uk" style="color: #3182ce; text-decoration: none; font-weight: bold;">
                → See How Fotonix Works (Free Trial Available)
              </a>
            </p>
          </div>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px; text-align: center; color: #718096; font-size: 14px;">
            <p>Questions? Simply reply to this email - we read every message!</p>
            <p style="margin-bottom: 0;">
              Best regards,<br>
              The Fotonix Team<br>
              <a href="https://fotonix.co.uk" style="color: #3182ce;">fotonix.co.uk</a>
            </p>
          </div>

        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Affiliate playbook sent to: ${email}`);
    
  } catch (error) {
    console.error('Error sending affiliate playbook email:', error);
    // Don't throw - we don't want to fail the lead capture if email fails
  }
}

/**
 * Update capture statistics
 */
async function updateCaptureStats(source) {
  try {
    await db.query(`
      INSERT INTO daily_stats (date, metric, value, source)
      VALUES (CURRENT_DATE, 'lead_captures', 1, $1)
      ON CONFLICT (date, metric, source) 
      DO UPDATE SET value = daily_stats.value + 1
    `, [source]);
  } catch (error) {
    console.error('Error updating capture stats:', error);
  }
}

module.exports = router;