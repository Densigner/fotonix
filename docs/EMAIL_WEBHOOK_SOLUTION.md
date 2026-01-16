# Email Receiving: The RIGHT Way for Multi-Tenant

## Why IMAP Doesn't Work

You correctly identified the fatal flaws:

1. **Single Account Problem**: One `catchall@fotonix.co.uk` can't distinguish between:
   - `contact.abc123@fotonix.co.uk` (Business A)
   - `contact.xyz789@fotonix.co.uk` (Business B)
   - `support.abc123@fotonix.co.uk` (Business A support)

2. **No IMAP Setup**: You never created IMAP accounts - the `.env` was placeholder values

3. **Scaling Issues**: IMAP polling for 100+ businesses = 100+ IMAP connections

## The Solution: Email Webhook ⭐

### How It Works

```
Email arrives at mail.fotonix.co.uk
         ↓
Postfix receives it for contact.abc123@fotonix.co.uk
         ↓
Postfix pipes email to Python script
         ↓
Script parses email (from, to, subject, body)
         ↓
Script POSTs to https://fotonix.co.uk/api/email/receive-webhook
         ↓
API matches recipient to business_emails table
         ↓
Saves to email_messages with correct business_email_id
         ↓
Shows in that business owner's inbox
```

### What I Created

1. **Webhook Endpoint**: `server/routes/email/receive-webhook.js`
   - Receives POST with email data
   - Matches recipient to business_emails table
   - Saves to database with `direction='inbound'`
   - Works for ALL @fotonix.co.uk addresses

2. **VPS Setup Script**: `scripts/setup-email-webhook.sh`
   - Creates Python forwarder script
   - Configures Postfix to pipe emails
   - Routes ALL @fotonix.co.uk → webhook

3. **Test Script**: `scripts/test-email-webhook.js`
   - Simulates incoming email
   - Tests webhook endpoint
   - Verifies database insert

## Setup Steps

### 1. Restart Your Server (Load New Route)

```powershell
# Stop current server
Get-Process node | Stop-Process

# Start server
cd C:\Users\joshm\Desktop\fotonix.co.uk\fotonix.co.uk
node server/index.js
```

### 2. Test Webhook Locally

```powershell
node scripts/test-email-webhook.js
```

Should show:
```
✅ Webhook processed successfully!
✅ Email found in database:
```

### 3. Configure VPS Mail Server

SSH into your VPS:

```bash
ssh root@51.75.78.118
```

Upload and run the setup script:

```bash
# On your Windows machine
scp C:\Users\joshm\Desktop\fotonix.co.uk\fotonix.co.uk\scripts\setup-email-webhook.sh root@51.75.78.118:/root/

# On VPS
ssh root@51.75.78.118
chmod +x /root/setup-email-webhook.sh
bash /root/setup-email-webhook.sh
```

### 4. Test Real Email

Send email from your Gmail to `contact.fffff@fotonix.co.uk`

Check logs on VPS:
```bash
tail -f /var/log/email-webhook.log
tail -f /var/log/mail.log
```

Check database:
```sql
SELECT * FROM email_messages WHERE direction='inbound' ORDER BY received_at DESC LIMIT 5;
```

## Advantages Over IMAP

| Feature | IMAP Polling | Webhook |
|---------|-------------|---------|
| Multi-tenant | ❌ Can't distinguish | ✅ Matches by recipient |
| Speed | ⏱️ 30-60s delay | ⚡ Instant |
| Setup | 🔐 Need IMAP accounts | 📧 One script |
| Scale | 📉 1 connection per business | 📈 Unlimited |
| Cost | 💰 IMAP server required | 💵 Free (Postfix pipe) |

## Security

The webhook validates `X-Webhook-Secret` header:

```javascript
if (webhookSecret !== process.env.WEBHOOK_SECRET) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

Your Postfix script sends:
```
X-Webhook-Secret: fotonix-webhook-secret-2024
```

## What About the IMAP Code?

The `server/email-receiver.js` and `start-email-receiver.js` files are **obsolete**. 

You can delete them or keep for reference, but they won't be used.

## Troubleshooting

### "Cannot POST /api/email/receive-webhook"
Restart server to load new route

### Webhook receives email but wrong business
Check `business_emails` table has correct email addresses:
```sql
SELECT * FROM business_emails WHERE email_address LIKE '%fffff%';
```

### Email never reaches webhook
Check VPS logs:
```bash
tail -f /var/log/mail.log  # Postfix delivery
tail -f /var/log/email-webhook.log  # Webhook script
```

### Python script errors
Test directly:
```bash
echo "From: test@example.com
To: test@fotonix.co.uk
Subject: Test

Body" | /usr/local/bin/email-to-webhook.py
```

## Next Steps

1. ✅ Restart server
2. ✅ Test webhook locally with `test-email-webhook.js`
3. ⏳ Upload setup script to VPS
4. ⏳ Run setup script on VPS
5. ⏳ Send test email from Gmail
6. ⏳ Verify it appears in inbox

## Why This Is Better

- **No IMAP passwords needed**
- **No catch-all confusion**
- **Works for unlimited businesses**
- **Instant delivery (no polling)**
- **Each email goes to correct business owner**
- **Proper multi-tenant isolation**

The webhook approach is industry standard for multi-tenant email (Postmark, SendGrid, Mailgun all use webhooks).
