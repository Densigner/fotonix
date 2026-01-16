# Email Receiving Setup Guide

## Issue: No replies received in inbox

**Problem**: Email receiver service exists but IMAP credentials not configured.

## Quick Setup

### 1. Add IMAP credentials to `.env`

Add these lines to your `.env` file:

```bash
# IMAP Configuration for receiving emails
IMAP_HOST=mail.fotonix.co.uk
IMAP_PORT=993
IMAP_USER=catchall@fotonix.co.uk
IMAP_PASSWORD=your_imap_password_here
IMAP_TLS=true
```

**Important**: Use a catch-all email address that receives ALL emails sent to @fotonix.co.uk

### 2. Configure Catch-All on Your Mail Server

SSH into your VPS:

```bash
ssh user@51.75.78.118
```

Edit Postfix virtual aliases:

```bash
sudo nano /etc/postfix/virtual
```

Add catch-all forwarding:

```
@fotonix.co.uk catchall@fotonix.co.uk
```

Update Postfix:

```bash
sudo postmap /etc/postfix/virtual
sudo postfix reload
```

### 3. Create the catchall mailbox

```bash
# If using virtual mailboxes
sudo mkdir -p /var/mail/vhosts/fotonix.co.uk/catchall
sudo chown -R vmail:vmail /var/mail/vhosts/fotonix.co.uk/catchall

# Or if using system users
sudo useradd -m catchall
sudo passwd catchall
```

### 4. Test IMAP connection

```bash
# Test IMAP login
telnet mail.fotonix.co.uk 993
# Or use openssl
openssl s_client -connect mail.fotonix.co.uk:993 -crlf
```

### 5. Start the email receiver service

```powershell
# In Windows PowerShell
node server/start-email-receiver.js
```

You should see:
```
📧 Email Receiver Service
========================
📧 Starting email receiver service...
   IMAP Host: mail.fotonix.co.uk
   IMAP User: catchall@fotonix.co.uk
✅ IMAP connection ready
📬 Inbox opened - X total messages
```

### 6. Run as background service (Production)

**Windows (using pm2)**:
```powershell
npm install -g pm2
pm2 start server/start-email-receiver.js --name email-receiver
pm2 startup
pm2 save
```

**Linux (systemd service)**:
```bash
sudo nano /etc/systemd/system/email-receiver.service
```

```ini
[Unit]
Description=Fotonix Email Receiver Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/fotonix.co.uk
ExecStart=/usr/bin/node /var/www/fotonix.co.uk/server/start-email-receiver.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable email-receiver
sudo systemctl start email-receiver
sudo systemctl status email-receiver
```

## How It Works

1. **Email arrives** at mail server (e.g., reply to `contact.fffff@fotonix.co.uk`)
2. **Catch-all forwards** to `catchall@fotonix.co.uk` mailbox
3. **IMAP service polls** every time new mail arrives
4. **Parser extracts** from, to, subject, body
5. **Database saves** to `email_messages` table with:
   - `direction = 'inbound'`
   - `business_email_id` matched to recipient address
   - `from_address` = sender
   - `to_address` = your business email
   - `status = 'received'`
6. **UI displays** in inbox

## Verification

### Check if emails are being received

```sql
SELECT id, from_address, to_address, subject, direction, received_at 
FROM email_messages 
WHERE direction = 'inbound' 
ORDER BY received_at DESC 
LIMIT 10;
```

### View receiver logs

```powershell
# If running directly
node server/start-email-receiver.js

# If using pm2
pm2 logs email-receiver
```

### Test receiving

1. Send email from personal account to `contact.fffff@fotonix.co.uk`
2. Check receiver logs for "📨 New mail notification received"
3. Check database for new inbound message
4. Check inbox UI for received email

## Troubleshooting

### "IMAP_PASSWORD not set"
Add IMAP credentials to `.env` file

### "Connection refused" or "ETIMEDOUT"
- Check firewall allows port 993
- Verify mail server running: `telnet mail.fotonix.co.uk 993`
- Check IMAP is enabled in Dovecot/Courier

### "Authentication failed"
- Verify IMAP username/password correct
- Test login: `telnet mail.fotonix.co.uk 143`
- Check mail server logs: `/var/log/mail.log`

### "No new messages received"
- Verify catch-all configured: `sudo postmap -q "test@fotonix.co.uk" virtual`
- Check mailbox: `sudo ls -la /var/mail/vhosts/fotonix.co.uk/catchall/`
- Test email delivery: `echo "test" | mail -s "test" catchall@fotonix.co.uk`

### Emails received but wrong business_email_id
The service matches `to_address` to `business_emails.email_address`. Verify:
```sql
SELECT email_address FROM business_emails WHERE email_address = 'contact.fffff@fotonix.co.uk';
```

## Alternative: Webhook Approach

If IMAP polling is too slow, configure your mail server to POST to a webhook:

### 1. Create webhook endpoint (already exists in code)
```javascript
// server/routes/email/receive-webhook.js
router.post('/receive-webhook', async (req, res) => {
  // Parse incoming email from mail server POST
  // Save to email_messages table
});
```

### 2. Configure Postfix to POST on receive
```bash
# Install webhook forwarder
pip install postfix-webhook

# Configure in /etc/postfix/master.cf
webhook unix - n n - - pipe
  flags=F user=webhook argv=/usr/local/bin/postfix-webhook
    --url=https://fotonix.co.uk/api/email/receive-webhook
```

### 3. Advantages
- Instant (no polling delay)
- Lower server load
- Scales better

## Next Steps

1. ✅ Fix missing database column (provider_message_id) - DONE
2. ⚠️ Add SPF/DKIM/DMARC records to stop spam (see EMAIL_DELIVERABILITY_SETUP.md)
3. ⚠️ Add IMAP credentials to .env
4. Start email receiver service
5. Test sending and receiving
