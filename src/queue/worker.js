const { query } = require('../db/client');
const { loadTransport } = require('../email/smtp');

let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    // pick one queued message
    const { rows } = await query(`
      update email_messages
         set status='sending'
       where id = (
         select id from email_messages
          where status='queued'
          order by created_at asc
          limit 1
          for update skip locked
       )
      returning *;
    `);

    if (!rows.length) return; // nothing to do

    const m = rows[0];

    try {
      const { transport } = await loadTransport(m.tenant_id);
      const info = await transport.sendMail({
        from: m.from_address,
        to: m.to_address,
        subject: m.subject,
        html: m.html,
        text: m.text
      });

      await query(
        `update email_messages set status='sent', provider_message_id=$2, sent_at=now() where id=$1`,
        [m.id, info.messageId || null]
      );
      await query(
        `insert into email_events (message_id, tenant_id, event_type, payload) values ($1,$2,'sent','{}'::jsonb)`,
        [m.id, m.tenant_id]
      );
    } catch (err) {
      await query(
        `update email_messages set status='failed', error=$2 where id=$1`,
        [m.id, err.message?.slice(0, 1000) || 'send error']
      );
      await query(
        `insert into email_events (message_id, tenant_id, event_type, payload) values ($1,$2,'failure',$3::jsonb)`,
        [m.id, m.tenant_id, JSON.stringify({ error: err.message })]
      );
    }
  } finally {
    running = false;
  }
}

function startWorker() {
  setInterval(tick, 750); // lightweight poller
  console.log('Email worker started.');
}

module.exports = { startWorker };