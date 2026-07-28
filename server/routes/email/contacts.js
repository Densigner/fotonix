const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

// Import database connection (real Postgres client — NOT server/db.js, which is
// the flat-JSON-file store used for clicks/orders and has no query() export)
const { query } = require('../../../src/db/client');

// Configure multer for CSV uploads
const upload = multer({ 
  dest: 'tmp/uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Single-tenant platform — always use the Fotonix store tenant
async function getTenantId(_memberUid) {
  return 1;
}

// Sync PBN signups and funnel events into contacts table
async function syncPBNCustomers(tenantId) {
  const result = await query(`
    INSERT INTO contacts (tenant_id, email, first_name, engagement_score, custom_fields, source, created_at, updated_at)
    SELECT
      $1,
      uev.email,
      COALESCE(
        (SELECT po.shipping_address->>'name'
         FROM pbn_orders po
         WHERE po.shipping_address->>'email' = uev.email
         ORDER BY po.created_at DESC LIMIT 1),
        ''
      ) AS first_name,
      CASE
        WHEN EXISTS(SELECT 1 FROM contact_events WHERE email = uev.email AND event_type = 'pbn_order_completed') THEN 0.90
        WHEN EXISTS(SELECT 1 FROM contact_events WHERE email = uev.email AND event_type = 'pbn_checkout_started') THEN 0.70
        WHEN EXISTS(SELECT 1 FROM contact_events WHERE email = uev.email AND event_type = 'pbn_generated')       THEN 0.50
        ELSE 0.30
      END AS engagement_score,
      jsonb_build_object(
        'source',      'pbn_signup',
        'user_type',   uev.user_type,
        'is_verified', uev.is_verified,
        'signed_up',   uev.created_at
      ) AS custom_fields,
      'pbn_signup',
      uev.created_at,
      NOW()
    FROM (
      SELECT DISTINCT ON (email) *
      FROM user_email_verification
      ORDER BY email, created_at DESC
    ) uev
    ON CONFLICT (tenant_id, email) DO UPDATE SET
      engagement_score = EXCLUDED.engagement_score,
      first_name       = CASE WHEN contacts.first_name = '' THEN EXCLUDED.first_name ELSE contacts.first_name END,
      custom_fields    = contacts.custom_fields || EXCLUDED.custom_fields,
      updated_at       = NOW()
  `, [tenantId]);
  return result.rowCount;
}

// Sync conversion leads to contacts table
async function syncConversionLeads(tenantId) {
  const syncQuery = `
    INSERT INTO contacts (tenant_id, email, first_name, engagement_score, custom_fields, created_at)
    SELECT 
      $1 as tenant_id,
      cl.email,
      COALESCE((cl.captured_data->>'firstName'), (cl.captured_data->>'name'), '') as first_name,
      CASE 
        WHEN cl.lead_score >= 80 THEN 0.9
        WHEN cl.lead_score >= 60 THEN 0.7
        WHEN cl.lead_score >= 40 THEN 0.5
        ELSE 0.3
      END as engagement_score,
      jsonb_build_object(
        'source', cl.source,
        'lead_score', cl.lead_score,
        'intent_level', cl.intent_level,
        'captured_data', cl.captured_data
      ) as custom_fields,
      cl.created_at
    FROM (
      SELECT DISTINCT ON (email) *
      FROM conversion_leads
      WHERE email IS NOT NULL AND email != ''
      ORDER BY email, created_at DESC
    ) cl
    WHERE cl.email NOT IN (
      SELECT email FROM contacts WHERE tenant_id = $1
    )
    ON CONFLICT (tenant_id, email) DO NOTHING
  `;
  
  const result = await query(syncQuery, [tenantId]);
  return result.rowCount;
}

// Sync Stencil Forge users (from unified users table) to contacts
async function syncStencilUsers(tenantId) {
  const syncQuery = `
    INSERT INTO contacts (tenant_id, email, first_name, display_name, engagement_score, is_vip, custom_fields, created_at)
    SELECT 
      $1 as tenant_id,
      u.email,
      COALESCE(u.username, '') as first_name,
      u.display_name,
      CASE 
        WHEN u.user_state = 'vip' THEN 0.95
        WHEN u.user_state = 'repeat_customer' THEN 0.85
        WHEN u.user_state = 'customer' THEN 0.7
        WHEN u.user_state = 'free_user' THEN 0.5
        ELSE 0.3
      END as engagement_score,
      u.user_state = 'vip' as is_vip,
      jsonb_build_object(
        'firebase_uid', u.firebase_uid,
        'user_state', u.user_state,
        'total_orders', u.total_orders,
        'total_spent', u.total_spent,
        'signup_source', u.signup_source,
        'last_order_at', u.last_order_at,
        'subscribed_marketing', u.subscribed_marketing
      ) as custom_fields,
      u.created_at
    FROM users u
    WHERE u.email NOT IN (
      SELECT email FROM contacts WHERE tenant_id = $1
    )
    AND u.email IS NOT NULL
    AND u.email != ''
    AND u.subscribed_marketing = true
  `;
  
  const result = await query(syncQuery, [tenantId]);
  return result.rowCount;
}

// GET /api/contacts - Get all contacts for tenant
router.get('/', async (req, res) => {
  try {
    const memberUid = req.headers['x-member-uid'];
    if (!memberUid) {
      return res.status(401).json({ error: 'Member UID required' });
    }

    const tenantId = await getTenantId(memberUid);

    // Sync all sources into contacts
    await syncPBNCustomers(tenantId);
    const syncedLeads = await syncConversionLeads(tenantId);
    await syncStencilUsers(tenantId).catch(() => {});

    // Pagination + filters
    const page    = parseInt(req.query.page)  || 1;
    const limit   = parseInt(req.query.limit) || 50;
    const offset  = (page - 1) * limit;
    const search  = req.query.search  || '';
    const segment = req.query.segment || '';

    let contactsQuery = `
      SELECT
        c.id, c.email, c.first_name, c.last_name, c.display_name,
        c.is_vip,
        false AS is_blocked,
        c.engagement_score,
        'monthly' AS contact_frequency,
        c.custom_fields, c.source,
        c.created_at, c.updated_at,
        COALESCE(
          (SELECT json_agg(s.name)
           FROM audience_segment_members m
           JOIN audience_segments s ON s.id = m.segment_id
           WHERE m.contact_id = c.id),
          '[]'::json
        ) AS segments
      FROM contacts c
      WHERE c.tenant_id = $1
    `;

    const queryParams = [tenantId];
    let paramIndex = 2;

    if (search) {
      contactsQuery += ` AND (c.email ILIKE $${paramIndex} OR c.first_name ILIKE $${paramIndex} OR c.last_name ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (segment === 'vip') {
      contactsQuery += ` AND c.is_vip = true`;
    } else if (segment === 'high_engagement') {
      contactsQuery += ` AND c.engagement_score >= 0.7`;
    } else if (segment === 'low_engagement') {
      contactsQuery += ` AND c.engagement_score < 0.4`;
    } else if (segment && segment !== 'all') {
      // PBN named segment — join via audience_segment_members
      contactsQuery += `
        AND c.id IN (
          SELECT m.contact_id FROM audience_segment_members m
          JOIN audience_segments s ON s.id = m.segment_id
          WHERE s.name = $${paramIndex} AND s.tenant_id = $1
        )`;
      queryParams.push(segment);
      paramIndex++;
    }

    contactsQuery += ` ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const contacts = await query(contactsQuery, queryParams);

    const countResult = await query(`SELECT COUNT(*) FROM contacts WHERE tenant_id = $1`, [tenantId]);
    const totalCount  = parseInt(countResult.rows[0].count);

    res.json({
      contacts: contacts.rows,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      },
      syncedLeads
    });

  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// GET /api/contacts/mine - contacts attributed to the requesting member
// (e.g. an affiliate's own funnel signups) — unlike GET /, this is scoped
// down to member_uid, not the whole tenant. See src/Bible/emails/gotchas.md
// for the same-header-trust caveat this shares with every other route here.
router.get('/mine', async (req, res) => {
  try {
    const memberUid = req.headers['x-member-uid'];
    if (!memberUid) {
      return res.status(401).json({ error: 'Member UID required' });
    }

    const tenantId = await getTenantId(memberUid);

    const page    = parseInt(req.query.page)  || 1;
    const limit   = parseInt(req.query.limit) || 50;
    const offset  = (page - 1) * limit;
    const search  = req.query.search  || '';
    const segment = req.query.segment || '';

    // Same search/segment filters as GET / (minus the named-audience-segment
    // join, which ContactManagement.jsx's dropdown doesn't offer as an
    // option anyway — just all/vip/high_engagement/low_engagement).
    let where = `WHERE tenant_id = $1 AND member_uid = $2`;
    const queryParams = [tenantId, memberUid];
    let paramIndex = 3;

    if (search) {
      where += ` AND (email ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }
    if (segment === 'vip') {
      where += ` AND is_vip = true`;
    } else if (segment === 'high_engagement') {
      where += ` AND engagement_score >= 0.7`;
    } else if (segment === 'low_engagement') {
      where += ` AND engagement_score < 0.4`;
    }

    const contacts = await query(
      `SELECT id, email, first_name, last_name, display_name, is_vip,
              false AS is_blocked, 'monthly' AS contact_frequency,
              engagement_score, custom_fields, source, created_at, updated_at
       FROM contacts
       ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM contacts ${where}`,
      queryParams
    );
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      contacts: contacts.rows,
      pagination: { page, limit, total: totalCount, pages: Math.ceil(totalCount / limit) },
    });
  } catch (error) {
    console.error('Error fetching my contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// POST /api/contacts - Add new contact
router.post('/', async (req, res) => {
  try {
    const memberUid = req.headers['x-member-uid'];
    if (!memberUid) {
      return res.status(401).json({ error: 'Member UID required' });
    }

    const { email, firstName, lastName, isVip = false, source } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const tenantId = await getTenantId(memberUid);

    const insertQuery = `
      INSERT INTO contacts (tenant_id, member_uid, email, first_name, last_name, is_vip, source, engagement_score)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 0.5)
      RETURNING *
    `;

    const result = await query(insertQuery, [
      tenantId,
      memberUid,
      email.toLowerCase().trim(),
      firstName || '',
      lastName || '',
      isVip,
      source || 'manual'
    ]);

    res.json(result.rows[0]);

  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: 'Contact with this email already exists' });
    }
    console.error('Error creating contact:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// POST /api/contacts/import-csv - Import contacts from CSV
router.post('/import-csv', upload.single('file'), async (req, res) => {
  try {
    const memberUid = req.headers['x-member-uid'];
    if (!memberUid) {
      return res.status(401).json({ error: 'Member UID required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    const tenantId = await getTenantId(memberUid);
    const filePath = req.file.path;
    
    const contacts = [];
    const errors = [];
    let lineNumber = 0;

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          lineNumber++;
          
          // Flexible column mapping
          const email = row.email || row.Email || row.EMAIL || row['Email Address'];
          const firstName = row.first_name || row.firstName || row['First Name'] || row.name || '';
          const lastName = row.last_name || row.lastName || row['Last Name'] || '';
          
          if (!email) {
            errors.push(`Line ${lineNumber}: Missing email address`);
            return;
          }

          // Validate email
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            errors.push(`Line ${lineNumber}: Invalid email format: ${email}`);
            return;
          }

          contacts.push({
            email: email.toLowerCase().trim(),
            firstName: (firstName || '').trim(),
            lastName: (lastName || '').trim()
          });
        })
        .on('end', async () => {
          try {
            // Remove file after processing
            fs.unlinkSync(filePath);

            if (contacts.length === 0) {
              return res.status(400).json({ 
                error: 'No valid contacts found in CSV',
                errors: errors
              });
            }

            // Batch insert with conflict resolution
            let imported = 0;
            let skipped = 0;

            for (const contact of contacts) {
              try {
                const insertQuery = `
                  INSERT INTO contacts (tenant_id, member_uid, email, first_name, last_name, engagement_score, source)
                  VALUES ($1, $2, $3, $4, $5, 0.5, 'csv_import')
                  ON CONFLICT (tenant_id, email) DO NOTHING
                  RETURNING id
                `;

                const result = await query(insertQuery, [
                  tenantId,
                  memberUid,
                  contact.email,
                  contact.firstName,
                  contact.lastName
                ]);

                if (result.rows.length > 0) {
                  imported++;
                } else {
                  skipped++;
                }
              } catch (error) {
                errors.push(`Failed to import ${contact.email}: ${error.message}`);
                skipped++;
              }
            }

            res.json({
              success: true,
              imported,
              skipped,
              errors,
              total: contacts.length
            });

          } catch (error) {
            console.error('Error processing CSV:', error);
            res.status(500).json({ error: 'Failed to process CSV file' });
          }
        })
        .on('error', (error) => {
          // Clean up file on error
          fs.unlinkSync(filePath);
          console.error('Error reading CSV:', error);
          res.status(500).json({ error: 'Failed to read CSV file' });
        });
    });

  } catch (error) {
    console.error('Error importing CSV:', error);
    res.status(500).json({ error: 'Failed to import CSV' });
  }
});

// DELETE /api/contacts/:id - Delete contact (GDPR compliant permanent removal)
router.delete('/:id', async (req, res) => {
  try {
    const memberUid = req.headers['x-member-uid'];
    if (!memberUid) {
      return res.status(401).json({ error: 'Member UID required' });
    }

    const contactId = req.params.id;
    const tenantId = await getTenantId(memberUid);

    // Get contact email before deletion for suppression list
    const contactQuery = 'SELECT email FROM contacts WHERE id = $1 AND tenant_id = $2';
    const contactResult = await query(contactQuery, [contactId, tenantId]);
    
    if (contactResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const email = contactResult.rows[0].email;

    // Begin transaction for GDPR compliant removal
    await query('BEGIN');

    try {
      // 1. Add to suppression list to prevent re-adding
      await query(
        `INSERT INTO email_suppressions (tenant_id, address, reason, detail) 
         VALUES ($1, $2, 'unsubscribed', 'User unsubscribed - GDPR removal') 
         ON CONFLICT (tenant_id, address) DO NOTHING`,
        [tenantId, email]
      );

      // 2. Remove from all segments
      await query(
        'DELETE FROM audience_segment_members WHERE contact_id = $1',
        [contactId]
      );

      // 3. Anonymize tracking data (keep analytics but remove PII)
      await query(
        `UPDATE email_tracking SET user_agent = 'anonymized', ip_address = NULL 
         WHERE message_id IN (
           SELECT id FROM email_messages WHERE to_address = $1 AND tenant_id = $2
         )`,
        [email, tenantId]
      );

      // 4. Delete the contact record
      await query('DELETE FROM contacts WHERE id = $1 AND tenant_id = $2', [contactId, tenantId]);

      await query('COMMIT');

      res.json({ 
        success: true, 
        message: 'Contact permanently removed and added to suppression list' 
      });

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// POST /api/contacts/unsubscribe - Handle unsubscribe requests (GDPR compliant)
router.post('/unsubscribe', async (req, res) => {
  try {
    const { email, token } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find tenant and contact
    const contactQuery = `
      SELECT c.id, c.tenant_id, t.name as tenant_name 
      FROM contacts c 
      JOIN tenants t ON c.tenant_id = t.id 
      WHERE c.email = $1
    `;
    const contactResult = await query(contactQuery, [email.toLowerCase().trim()]);

    if (contactResult.rows.length === 0) {
      // Even if contact not found, add to suppression list
      return res.status(200).json({ 
        success: true, 
        message: 'Unsubscribe processed successfully' 
      });
    }

    const contact = contactResult.rows[0];

    // Begin transaction for complete removal
    await query('BEGIN');

    try {
      // 1. Add to suppression list
      await query(
        `INSERT INTO email_suppressions (tenant_id, address, reason, detail) 
         VALUES ($1, $2, 'unsubscribed', 'User clicked unsubscribe link') 
         ON CONFLICT (tenant_id, address) DO NOTHING`,
        [contact.tenant_id, email]
      );

      // 2. Remove from segments
      await query(
        'DELETE FROM audience_segment_members WHERE contact_id = $1',
        [contact.id]
      );

      // 3. Anonymize tracking data
      await query(
        `UPDATE email_tracking SET user_agent = 'anonymized', ip_address = NULL 
         WHERE message_id IN (
           SELECT id FROM email_messages WHERE to_address = $1 AND tenant_id = $2
         )`,
        [email, contact.tenant_id]
      );

      // 4. Delete contact completely
      await query('DELETE FROM contacts WHERE id = $1', [contact.id]);

      await query('COMMIT');

      res.json({ 
        success: true, 
        message: 'You have been successfully unsubscribed and removed from all lists' 
      });

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error processing unsubscribe:', error);
    res.status(500).json({ error: 'Failed to process unsubscribe request' });
  }
});

// GET /api/contacts/segments - Get audience segments
router.get('/segments', async (req, res) => {
  try {
    const memberUid = req.headers['x-member-uid'];
    if (!memberUid) {
      return res.status(401).json({ error: 'Member UID required' });
    }

    const tenantId = await getTenantId(memberUid);

    const segmentsQuery = `
      SELECT
        s.id, s.name, s.description,
        COUNT(m.contact_id) AS contact_count,
        s.created_at
      FROM audience_segments s
      LEFT JOIN audience_segment_members m ON m.segment_id = s.id
      WHERE s.tenant_id = $1
      GROUP BY s.id, s.name, s.description, s.created_at
      ORDER BY s.name
    `;

    const result = await query(segmentsQuery, [tenantId]);
    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching segments:', error);
    res.status(500).json({ error: 'Failed to fetch segments' });
  }
});

module.exports = router;