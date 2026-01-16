/**
 * Migrate existing business emails from old denormalized table to new normalized schema
 */

require('dotenv').config();
const { Pool } = require('pg');

async function migrateOldEmails() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔄 Starting migration of old business emails...');

    // First check if old table exists and has data
    const oldDataCheck = await pool.query(`
      SELECT 
        member_uid, 
        business_name, 
        main_email,
        noreply_email,
        support_email,
        orders_email,
        forward_to_email,
        is_active
      FROM member_business_emails
      WHERE is_active = true
    `);

    console.log(`📊 Found ${oldDataCheck.rows.length} records in old table`);

    if (oldDataCheck.rows.length === 0) {
      console.log('✅ No old data to migrate');
      await pool.end();
      return;
    }

    let migratedCount = 0;
    let errorCount = 0;

    // Process each old record
    for (const oldRecord of oldDataCheck.rows) {
      const { 
        member_uid, 
        business_name, 
        main_email,
        noreply_email,
        support_email,
        orders_email,
        forward_to_email
      } = oldRecord;
      
      console.log(`\n📧 Processing ${business_name} (${member_uid})...`);
      console.log(`   Main: ${main_email}`);
      console.log(`   NoReply: ${noreply_email}`);
      console.log(`   Support: ${support_email}`);
      console.log(`   Orders: ${orders_email}`);

      try {
        // Check if already migrated
        const existingCheck = await pool.query(
          'SELECT id FROM business_emails WHERE member_uid = $1 AND business_name = $2 LIMIT 1',
          [member_uid, business_name]
        );

        if (existingCheck.rows.length > 0) {
          console.log(`   ⏭️  Already migrated, skipping`);
          continue;
        }

        // Create business email group
        const groupResult = await pool.query(`
          INSERT INTO business_email_groups 
          (member_uid, business_name, store_name, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, true, NOW(), NOW())
          RETURNING id
        `, [member_uid, business_name, business_name.toLowerCase().replace(/\s+/g, '-')]);

        const groupId = groupResult.rows[0].id;
        console.log(`   ✅ Created group ID: ${groupId}`);

        // Define email types to migrate
        const emailsToMigrate = [
          { email: main_email, type: 'main', displayName: business_name },
          { email: noreply_email, type: 'noreply', displayName: `${business_name} (No Reply)` },
          { email: support_email, type: 'support', displayName: `${business_name} Support` },
          { email: orders_email, type: 'orders', displayName: `${business_name} Orders` }
        ];

        // Insert each email that exists (WITHOUT group_id since table doesn't have it)
        for (const { email, type, displayName } of emailsToMigrate) {
          if (!email) continue;

          const emailResult = await pool.query(`
            INSERT INTO business_emails 
            (
              member_uid, 
              business_name, 
              email_address, 
              email_type, 
              display_name, 
              description, 
              forward_to_email, 
              is_active, 
              is_verified, 
              daily_send_limit, 
              daily_send_count,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, true, false, 100, 0, NOW(), NOW())
            RETURNING id
          `, [
            member_uid,
            business_name,
            email,
            type,
            displayName,
            `${type.charAt(0).toUpperCase() + type.slice(1)} email for ${business_name}`,
            forward_to_email
          ]);

          console.log(`   ✅ Created email: ${email} (ID: ${emailResult.rows[0].id})`);
        }

        migratedCount++;

      } catch (err) {
        console.error(`   ❌ Error migrating ${business_name}:`, err.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Migration complete!`);
    console.log(`   Migrated: ${migratedCount} business accounts`);
    console.log(`   Errors: ${errorCount}`);
    console.log('='.repeat(50));

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

// Run migration
migrateOldEmails();
