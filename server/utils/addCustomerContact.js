/**
 * Shared helper: add a customer to the contacts table and "customers" audience segment
 * on order completion. Uses the same PostgreSQL connection pattern as the route files.
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Default tenant ID for the Fotonix store
const DEFAULT_TENANT_ID = 1;

/**
 * Add a customer to the contacts table and "customers" audience segment.
 * Upserts — if the contact already exists, bumps their engagement score.
 *
 * @param {object} opts
 * @param {string} opts.email      - Customer email (required)
 * @param {string} [opts.firstName]  - Customer first name
 * @param {string} [opts.lastName]   - Customer last name
 * @param {string} [opts.source]     - Where the contact came from (e.g. 'pbn_order', 'stencil_order')
 * @param {string} [opts.orderId]    - The order that triggered this
 * @param {number} [opts.tenantId]   - Tenant ID (defaults to 1)
 */
async function addCustomerToContacts({ email, firstName, lastName, source, orderId, tenantId }) {
  if (!email) return;

  const tid = tenantId || DEFAULT_TENANT_ID;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Upsert contact
    const contactResult = await client.query(`
      INSERT INTO contacts (tenant_id, email, first_name, last_name, engagement_score, custom_fields, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 0.7, $5, NOW(), NOW())
      ON CONFLICT (tenant_id, email) DO UPDATE SET
        engagement_score = GREATEST(contacts.engagement_score, 0.7),
        first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), contacts.first_name),
        last_name  = COALESCE(NULLIF(EXCLUDED.last_name, ''), contacts.last_name),
        custom_fields = contacts.custom_fields || EXCLUDED.custom_fields,
        updated_at = NOW()
      RETURNING id
    `, [
      tid,
      email.toLowerCase().trim(),
      firstName || '',
      lastName || '',
      JSON.stringify({ source: source || 'order', order_id: orderId || null })
    ]);

    const contactId = contactResult.rows[0]?.id;
    if (!contactId) {
      await client.query('COMMIT');
      return;
    }

    // 2. Ensure "customers" audience segment exists
    const segmentResult = await client.query(`
      INSERT INTO audience_segments (tenant_id, name, description, created_at, updated_at)
      VALUES ($1, 'customers', 'Customers who have placed an order', NOW(), NOW())
      ON CONFLICT (tenant_id, name) DO UPDATE SET updated_at = NOW()
      RETURNING id
    `, [tid]);

    const segmentId = segmentResult.rows[0]?.id;
    if (!segmentId) {
      await client.query('COMMIT');
      return;
    }

    // 3. Link contact to "customers" segment
    await client.query(`
      INSERT INTO audience_segment_members (segment_id, contact_id, added_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (segment_id, contact_id) DO NOTHING
    `, [segmentId, contactId]);

    await client.query('COMMIT');
    console.log(`✅ Added customer ${email} to "customers" contact group`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    // Don't throw — contact insertion failure should never block an order
    console.error('⚠️  Failed to add customer to contacts (non-fatal):', error.message);
  } finally {
    client.release();
  }
}

module.exports = { addCustomerToContacts };
