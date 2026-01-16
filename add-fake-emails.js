/**
 * Script to add fake inbound emails for testing the inbox feature
 */
require('dotenv').config();
const { Client } = require('pg');

// Database connection using DATABASE_URL from .env
const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/fotonix'
});

async function addFakeEmails() {
  try {
    await client.connect();

    // First, ensure we have a tenant
    const tenantResult = await client.query(
      `INSERT INTO tenants (name, slug) VALUES ('Fotonix Production', 'fotonix-prod') 
       ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`
    );
    const tenantId = tenantResult.rows[0].id;
    console.log(`Using tenant ID: ${tenantId}`);

    // Create some fake inbound emails
    const fakeEmails = [
      {
        from: 'customer@example.com',
        to: 'support@fotonix.co.uk',
        subject: 'Question about custom mirror pricing',
        text: 'Hi there,\n\nI\'m interested in getting a custom mirror made. Could you please send me pricing information for a 24x36 inch mirror with LED lighting?\n\nThanks!',
        html: '<p>Hi there,</p><p>I\'m interested in getting a custom mirror made. Could you please send me pricing information for a 24x36 inch mirror with LED lighting?</p><p>Thanks!</p>',
        status: 'received'
      },
      {
        from: 'john.doe@gmail.com',
        to: 'support@fotonix.co.uk',
        subject: 'Order status inquiry',
        text: 'Hello,\n\nI placed an order last week (Order #12345) and haven\'t received any updates. Could you please let me know the status?\n\nBest regards,\nJohn',
        html: '<p>Hello,</p><p>I placed an order last week (Order #12345) and haven\'t received any updates. Could you please let me know the status?</p><p>Best regards,<br>John</p>',
        status: 'received'
      },
      {
        from: 'sarah.johnson@company.com',
        to: 'sales@fotonix.co.uk',
        subject: 'Bulk order inquiry',
        text: 'Dear Sales Team,\n\nWe are looking to place a bulk order for 50 mirrors for our new hotel chain. Can we discuss volume pricing and delivery timeline?\n\nSarah Johnson\nProcurement Manager',
        html: '<p>Dear Sales Team,</p><p>We are looking to place a bulk order for 50 mirrors for our new hotel chain. Can we discuss volume pricing and delivery timeline?</p><p>Sarah Johnson<br>Procurement Manager</p>',
        status: 'received'
      },
      {
        from: 'mike.wilson@email.com',
        to: 'support@fotonix.co.uk',
        subject: 'Installation help needed',
        text: 'Hi,\n\nI received my mirror yesterday but I\'m having trouble with the installation. The LED strip doesn\'t seem to be working properly. Can someone help?\n\nMike',
        html: '<p>Hi,</p><p>I received my mirror yesterday but I\'m having trouble with the installation. The LED strip doesn\'t seem to be working properly. Can someone help?</p><p>Mike</p>',
        status: 'received'
      },
      {
        from: 'lisa.brown@design.co',
        to: 'info@fotonix.co.uk',
        subject: 'Partnership opportunity',
        text: 'Hello,\n\nI\'m an interior designer and I\'m impressed with your mirror quality. Would you be interested in discussing a partnership for my projects?\n\nLisa Brown\nSenior Interior Designer',
        html: '<p>Hello,</p><p>I\'m an interior designer and I\'m impressed with your mirror quality. Would you be interested in discussing a partnership for my projects?</p><p>Lisa Brown<br>Senior Interior Designer</p>',
        status: 'received'
      }
    ];

    // Insert fake emails
    for (const email of fakeEmails) {
      // Create a timestamp in the past few days
      const daysAgo = Math.floor(Math.random() * 7) + 1;
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - daysAgo);
      createdAt.setHours(Math.floor(Math.random() * 24));
      createdAt.setMinutes(Math.floor(Math.random() * 60));

      const result = await client.query(
        `INSERT INTO email_messages 
         (tenant_id, from_address, to_address, subject, html, text, status, created_at, meta)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          tenantId,
          email.from,
          email.to,
          email.subject,
          email.html,
          email.text,
          email.status,
          createdAt,
          JSON.stringify({ 
            direction: 'inbound',
            from_name: email.from.split('@')[0].replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            snippet: email.text.substring(0, 120) + '...'
          })
        ]
      );

      // Add received event
      await client.query(
        `INSERT INTO email_events (message_id, tenant_id, event_type, payload, occurred_at)
         VALUES ($1, $2, 'received', '{}', $3)`,
        [result.rows[0].id, tenantId, createdAt]
      );

      console.log(`Added email from ${email.from}: "${email.subject}"`);
    }

    console.log('\n✅ Successfully added fake emails to the database!');
    console.log('You can now test the inbox feature with these sample messages.');

  } catch (error) {
    console.error('Error adding fake emails:', error);
  } finally {
    await client.end();
  }
}

// Run the script
addFakeEmails();