/**
 * Maildir -> Inbox bridge.
 *
 * Real inbound mail is delivered by Postfix/Dovecot straight into each
 * mailbox's Maildir on disk (standard mail-server delivery) — the site's
 * Inbox UI reads from Postgres (email_messages) instead, and nothing ever
 * connected the two. This script is a safe, read-only bridge: it never
 * touches Postfix/Dovecot's delivery config (so it can't break the mail
 * server), it just periodically scans each mailbox's Maildir for messages
 * not yet imported (deduped by Message-ID) and feeds them through the
 * existing /api/email/receive-webhook endpoint. Runs on a cron schedule.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const fs = require('fs');
const { simpleParser } = require('mailparser');
const { Client } = require('pg');

const MAILDIR_BASE = '/var/mail/vhosts/fotonix.co.uk';
const WEBHOOK_URL = 'http://localhost:' + (process.env.PORT || 4000) + '/api/email/receive-webhook';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

async function query(sql, params = []) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
}

async function alreadyImported(messageId) {
  if (!messageId) return false;
  const r = await query('SELECT id FROM email_messages WHERE message_id = $1 LIMIT 1', [messageId]);
  return r.rows.length > 0;
}

async function importFile(mailboxName, filePath) {
  const raw = fs.readFileSync(filePath);
  const parsed = await simpleParser(raw);
  const messageId = parsed.messageId || null;

  if (await alreadyImported(messageId)) return;

  const toAddress = `${mailboxName}@fotonix.co.uk`;
  const fromAddress = (parsed.from && parsed.from.value && parsed.from.value[0] && parsed.from.value[0].address)
    || (parsed.from && parsed.from.text)
    || 'unknown@unknown';

  const references = Array.isArray(parsed.references)
    ? parsed.references
    : (parsed.references ? [parsed.references] : []);

  const resp = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-secret': WEBHOOK_SECRET },
    body: JSON.stringify({
      from: fromAddress,
      to: [toAddress],
      subject: parsed.subject || '(no subject)',
      html: parsed.html || parsed.textAsHtml || '',
      text: parsed.text || '',
      headers: {
        'message-id': messageId,
        'in-reply-to': parsed.inReplyTo || null,
        references
      }
    })
  });

  if (resp.ok) {
    console.log(`[mail-poller] imported -> ${toAddress} from ${fromAddress}: ${parsed.subject || '(no subject)'}`);
  } else {
    const detail = await resp.text().catch(() => '');
    console.error(`[mail-poller] webhook rejected ${filePath}: ${resp.status} ${detail}`);
  }
}

async function processMailbox(mailboxName) {
  const dirs = ['new', 'cur'].map(d => path.join(MAILDIR_BASE, mailboxName, 'Maildir', d));
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      const filePath = path.join(dir, file);
      try {
        if (!fs.statSync(filePath).isFile()) continue;
        await importFile(mailboxName, filePath);
      } catch (e) {
        console.error(`[mail-poller] failed on ${filePath}:`, e.message);
      }
    }
  }
}

async function main() {
  if (!WEBHOOK_SECRET) {
    console.error('[mail-poller] WEBHOOK_SECRET not set — aborting');
    process.exit(1);
  }
  if (!fs.existsSync(MAILDIR_BASE)) {
    console.error('[mail-poller] Maildir base not found:', MAILDIR_BASE);
    process.exit(1);
  }

  const mailboxes = fs.readdirSync(MAILDIR_BASE)
    .filter(name => fs.statSync(path.join(MAILDIR_BASE, name)).isDirectory());

  for (const mailbox of mailboxes) {
    await processMailbox(mailbox);
  }
}

main().catch(e => {
  console.error('[mail-poller] fatal:', e);
  process.exit(1);
});
