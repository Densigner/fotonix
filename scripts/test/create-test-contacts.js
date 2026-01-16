require('dotenv').config();
const { Client } = require('pg');

// Database connection using DATABASE_URL from .env
const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/fotonix'
});

async function createTestContacts() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Sample contact data with varied engagement levels
    const contacts = [
      {
        tenant_id: 12345,
        email: 'john.smith@example.com',
        first_name: 'John',
        last_name: 'Smith',
        is_vip: true,
        engagement_score: 0.85
      },
      {
        tenant_id: 12345,
        email: 'sarah.jones@example.com',
        first_name: 'Sarah',
        last_name: 'Jones',
        is_vip: false,
        engagement_score: 0.72
      },
      {
        tenant_id: 12345,
        email: 'mike.wilson@example.com',
        first_name: 'Mike',
        last_name: 'Wilson',
        is_vip: false,
        engagement_score: 0.45
      },
      {
        tenant_id: 12345,
        email: 'lisa.brown@example.com',
        first_name: 'Lisa',
        last_name: 'Brown',
        is_vip: true,
        engagement_score: 0.91
      },
      {
        tenant_id: 12345,
        email: 'david.taylor@example.com',
        first_name: 'David',
        last_name: 'Taylor',
        is_vip: false,
        engagement_score: 0.63
      },
      {
        tenant_id: 12345,
        email: 'emma.davis@example.com',
        first_name: 'Emma',
        last_name: 'Davis',
        is_vip: false,
        engagement_score: 0.38
      },
      {
        tenant_id: 12345,
        email: 'alex.martin@example.com',
        first_name: 'Alex',
        last_name: 'Martin',
        is_vip: true,
        engagement_score: 0.79
      },
      {
        tenant_id: 12345,
        email: 'jennifer.white@example.com',
        first_name: 'Jennifer',
        last_name: 'White',
        is_vip: false,
        engagement_score: 0.56
      },
      {
        tenant_id: 12345,
        email: 'robert.clark@example.com',
        first_name: 'Robert',
        last_name: 'Clark',
        is_vip: false,
        engagement_score: 0.29
      },
      {
        tenant_id: 12345,
        email: 'amanda.lee@example.com',
        first_name: 'Amanda',
        last_name: 'Lee',
        is_vip: true,
        engagement_score: 0.88
      }
    ];

    // Insert contacts
    console.log('Creating test contacts...');
    for (const contact of contacts) {
      await client.query(`
        INSERT INTO contacts (tenant_id, email, first_name, last_name, is_vip, engagement_score)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (tenant_id, email) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          is_vip = EXCLUDED.is_vip,
          engagement_score = EXCLUDED.engagement_score
      `, [contact.tenant_id, contact.email, contact.first_name, contact.last_name, contact.is_vip, contact.engagement_score]);
    }

    // Create a sample audience segment
    console.log('Creating sample audience segment...');
    const segmentResult = await client.query(`
      INSERT INTO audience_segments (tenant_id, name, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (tenant_id, name) DO UPDATE SET
        description = EXCLUDED.description
      RETURNING id
    `, [1, 'VIP Members', 'High-value customers with premium status']);

    const segmentId = segmentResult.rows[0].id;

    // Add VIP contacts to the segment
    console.log('Adding VIP contacts to segment...');
    const vipContactsResult = await client.query(`
      SELECT id FROM contacts 
      WHERE tenant_id = $1 AND is_vip = true
    `, [12345]);

    for (const contact of vipContactsResult.rows) {
      await client.query(`
        INSERT INTO audience_segment_members (segment_id, contact_id)
        VALUES ($1, $2)
        ON CONFLICT (segment_id, contact_id) DO NOTHING
      `, [segmentId, contact.id]);
    }

    // Add some contact activities for engagement tracking
    console.log('Creating sample contact activities...');
    const allContactsResult = await client.query(`
      SELECT id FROM contacts WHERE tenant_id = $1
    `, [12345]);

    for (const contact of allContactsResult.rows) {
      // Create some random activities
      const activityTypes = ['email_open', 'email_click', 'email_bounce', 'email_complaint'];
      const numActivities = Math.floor(Math.random() * 5) + 1;
      
      for (let i = 0; i < numActivities; i++) {
        const activityType = activityTypes[Math.floor(Math.random() * activityTypes.length)];
        const daysAgo = Math.floor(Math.random() * 30);
        const activityDate = new Date(Date.now() - (daysAgo * 24 * 60 * 60 * 1000));
        
        await client.query(`
          INSERT INTO contact_activities (contact_id, activity_type, activity_data, created_at)
          VALUES ($1, $2, $3, $4)
        `, [
          contact.id, 
          activityType, 
          JSON.stringify({ source: 'test_campaign', timestamp: activityDate.toISOString() }),
          activityDate
        ]);
      }
    }

    // Update engagement scores based on activities
    console.log('Updating engagement scores...');
    await client.query('SELECT update_contact_engagement_score()');

    console.log('✅ Test contacts created successfully!');
    console.log(`Created ${contacts.length} contacts`);
    console.log('Created 1 audience segment with VIP members');
    console.log('Added random contact activities for engagement tracking');
    
  } catch (error) {
    console.error('❌ Error creating test contacts:', error);
  } finally {
    await client.end();
  }
}

createTestContacts();