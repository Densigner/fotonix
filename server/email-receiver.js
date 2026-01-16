/**
 * Email Receiver Service - Polls IMAP for incoming emails
 * Inserts them into the email_messages table
 */

const Imap = require('imap');
const { simpleParser } = require('mailparser');
const { Pool } = require('pg');

class EmailReceiver {
  constructor(config) {
    this.config = config;
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    this.imap = null;
    this.isConnected = false;
  }

  async start() {
    console.log('📧 Starting email receiver service...');
    console.log('   IMAP Host:', this.config.host);
    console.log('   IMAP User:', this.config.user);
    
    this.imap = new Imap({
      user: this.config.user,
      password: this.config.password,
      host: this.config.host,
      port: this.config.port || 993,
      tls: this.config.tls !== false,
      tlsOptions: { rejectUnauthorized: false }
    });

    this.imap.once('ready', () => {
      console.log('✅ IMAP connection ready');
      this.isConnected = true;
      this.openInbox();
    });

    this.imap.once('error', (err) => {
      console.error('❌ IMAP error:', err.message);
      this.isConnected = false;
    });

    this.imap.once('end', () => {
      console.log('📭 IMAP connection ended');
      this.isConnected = false;
      // Reconnect after 30 seconds
      setTimeout(() => this.start(), 30000);
    });

    this.imap.connect();
  }

  openInbox() {
    this.imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        console.error('❌ Failed to open inbox:', err.message);
        return;
      }
      
      console.log(`📬 Inbox opened - ${box.messages.total} total messages`);
      
      // Listen for new mail
      this.imap.on('mail', () => {
        console.log('📨 New mail notification received');
        this.fetchNewMessages();
      });

      // Fetch unseen messages on startup
      this.fetchNewMessages();
    });
  }

  async fetchNewMessages() {
    try {
      const search = this.imap.seq.search(['UNSEEN'], (err, results) => {
        if (err) {
          console.error('❌ Search error:', err.message);
          return;
        }

        if (!results || results.length === 0) {
          console.log('   No new unseen messages');
          return;
        }

        console.log(`📥 Found ${results.length} unseen messages`);

        const fetch = this.imap.seq.fetch(results, {
          bodies: '',
          markSeen: true
        });

        fetch.on('message', (msg, seqno) => {
          console.log(`   Processing message #${seqno}`);
          
          msg.on('body', (stream, info) => {
            simpleParser(stream, async (err, parsed) => {
              if (err) {
                console.error(`   ❌ Parse error for message #${seqno}:`, err.message);
                return;
              }

              try {
                await this.saveMessage(parsed);
                console.log(`   ✅ Saved message #${seqno}: ${parsed.subject}`);
              } catch (saveErr) {
                console.error(`   ❌ Failed to save message #${seqno}:`, saveErr.message);
              }
            });
          });
        });

        fetch.once('error', (err) => {
          console.error('❌ Fetch error:', err.message);
        });

        fetch.once('end', () => {
          console.log('✅ Finished processing new messages');
        });
      });
    } catch (error) {
      console.error('❌ fetchNewMessages error:', error.message);
    }
  }

  async saveMessage(parsed) {
    const toAddress = parsed.to?.value?.[0]?.address || parsed.to?.text || '';
    const fromAddress = parsed.from?.value?.[0]?.address || parsed.from?.text || '';
    const subject = parsed.subject || '(no subject)';
    const htmlContent = parsed.html || '';
    const textContent = parsed.text || '';
    const messageId = parsed.messageId || '';
    const inReplyTo = parsed.inReplyTo || null;
    const references = parsed.references || [];

    // Find which business email this was sent to
    const businessEmailResult = await this.pool.query(
      'SELECT id, member_uid FROM business_emails WHERE email_address = $1 LIMIT 1',
      [toAddress]
    );

    let businessEmailId = null;
    let memberUid = null;
    
    if (businessEmailResult.rows.length > 0) {
      businessEmailId = businessEmailResult.rows[0].id;
      memberUid = businessEmailResult.rows[0].member_uid;
      console.log(`   📧 Email for business: ${toAddress} (member: ${memberUid})`);
    } else {
      console.log(`   ⚠️  Email to unknown address: ${toAddress}`);
    }

    // Insert into email_messages table
    const result = await this.pool.query(`
      INSERT INTO email_messages 
      (
        tenant_id,
        business_email_id,
        from_address,
        to_address,
        subject,
        html,
        text,
        direction,
        status,
        message_id,
        in_reply_to,
        email_references,
        received_at,
        is_read,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'inbound', 'received', $8, $9, $10, NOW(), false, NOW(), NOW())
      RETURNING id
    `, [
      'default', // tenant_id
      businessEmailId,
      fromAddress,
      toAddress,
      subject,
      htmlContent,
      textContent,
      messageId,
      inReplyTo,
      JSON.stringify(references)
    ]);

    return result.rows[0].id;
  }

  stop() {
    if (this.imap) {
      this.imap.end();
    }
    this.pool.end();
  }
}

module.exports = EmailReceiver;
