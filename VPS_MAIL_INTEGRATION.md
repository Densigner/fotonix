# 🚀 VPS Mail Server Integration Guide

## Overview
This guide covers all the website changes needed to integrate your Fotonix platform with an OVH VPS mail server. The integration provides enterprise-grade email delivery with complete control over your mail infrastructure.

## 📋 Pre-Requirements
- OVH VPS with mail server setup (Postfix + Dovecot + OpenDKIM)
- DNS records configured (A, MX, SPF, DKIM, DMARC)
- Mail server running and accessible on ports 25, 587, 465
- PostgreSQL database with email tables migrated

## 🔧 Website Changes Made

### 1. New Email API Routes (`/server/routes/emails.js`)
**Purpose**: Complete email management API for your VPS mail server
**Endpoints**:
- `POST /api/emails/send` - Send individual emails
- `POST /api/emails/send-bulk` - Send bulk campaigns  
- `GET /api/emails/messages/:id` - Get message status
- `GET /api/emails/stats` - Email statistics
- `POST /api/emails/webhook` - Handle delivery events
- `POST /api/emails/suppressions` - Manage email suppressions

### 2. SMTP Test Routes (`/server/routes/smtp-test.js`)
**Purpose**: Test and validate VPS mail server connectivity
**Endpoints**:
- `GET /api/smtp/test-connection` - Test SMTP connection
- `POST /api/smtp/test-email` - Send test email

### 3. Enhanced SMTP Service (`/src/email/smtp.js`)
**Changes**:
- Added environment variable fallback for VPS config
- Enhanced connection verification and error handling
- Added test functions for connectivity and email sending
- Improved TLS/STARTTLS configuration for VPS setup

### 4. Updated Campaign System (`/server/campaigns.js`)
**Changes**:
- Integrated with VPS mail server for actual email sending
- Added bulk campaign support via email API
- Enhanced error handling and fallback mechanisms
- Added proper message tracking and headers

### 5. Database Configuration
**Files**:
- `setup-vps-mail-server.sql` - SQL script to configure SMTP credentials
- Existing email tables support full email lifecycle tracking

### 6. Environment Configuration
**File**: `.env.vps-mail` - Template for VPS mail server settings
**Variables**:
```bash
MAIL_HOST=mail.your-domain.com
MAIL_PORT=587
MAIL_USERNAME=noreply@your-domain.com
MAIL_PASSWORD=your-secure-password
MAIL_FROM_NAME=Fotonix
MAIL_FROM_ADDRESS=noreply@your-domain.com
MAIL_USE_TLS=false
MAIL_USE_STARTTLS=true
WEBHOOK_SECRET=your-webhook-secret-here
MAIL_RATE_LIMIT=60
```

## 🚀 Setup Instructions

### Step 1: Configure Environment Variables
Copy `.env.vps-mail` to `.env` and update with your VPS details:
```bash
cp .env.vps-mail .env
# Edit .env with your actual VPS mail server settings
```

### Step 2: Update Database
Run the VPS integration setup:
```bash
node setup-vps-mail-integration.js
```

### Step 3: Test Connection
Test your VPS mail server connectivity:
```bash
# Test SMTP connection
curl http://localhost:5002/api/smtp/test-connection

# Send test email
curl -X POST http://localhost:5002/api/smtp/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"your-test-email@example.com"}'
```

### Step 4: Update DNS Records
Ensure your domain has proper DNS configuration:

**A Record**:
```
mail.your-domain.com. IN A YOUR_VPS_IP
```

**MX Record**:
```
your-domain.com. IN MX 10 mail.your-domain.com.
```

**SPF Record**:
```
your-domain.com. IN TXT "v=spf1 ip4:YOUR_VPS_IP ~all"
```

**DKIM Record** (get from your VPS):
```
default._domainkey.your-domain.com. IN TXT "v=DKIM1; k=rsa; p=YOUR_DKIM_PUBLIC_KEY"
```

**DMARC Record**:
```
_dmarc.your-domain.com. IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@your-domain.com"
```

## 📧 API Usage Examples

### Send Individual Email
```javascript
const response = await fetch('/api/emails/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: 'customer@example.com',
    subject: 'Welcome to Fotonix!',
    html: '<h1>Welcome!</h1><p>Thanks for joining us.</p>',
    templateName: 'welcome', // optional
    templateData: { firstName: 'John' } // optional
  })
});
```

### Send Bulk Campaign
```javascript
const response = await fetch('/api/emails/send-bulk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    recipients: [
      { email: 'user1@example.com', firstName: 'John' },
      { email: 'user2@example.com', firstName: 'Jane' }
    ],
    subject: 'Monthly Newsletter',
    templateName: 'newsletter',
    templateData: { month: 'December' },
    campaignId: 'newsletter-dec-2024'
  })
});
```

### Get Email Statistics
```javascript
const stats = await fetch('/api/emails/stats?timeframe=7d')
  .then(r => r.json());
console.log(stats);
// {
//   stats: { total: 150, sent: 145, failed: 3, bounced: 1, opened: 89, clicked: 23 },
//   suppressions: [{ reason: 'bounce', count: 1 }],
//   timeframe: '7d'
// }
```

## 🔍 Monitoring & Maintenance

### Email Delivery Monitoring
- Monitor `/api/emails/stats` for delivery metrics
- Check email_messages table for failed deliveries
- Review email_events for bounce/complaint patterns

### VPS Health Checks
- Use `/api/smtp/test-connection` for connectivity monitoring
- Monitor mail server logs for delivery issues
- Check disk space and memory usage on VPS

### Bounce Management
The system automatically:
- Tracks bounces and complaints via webhooks
- Adds problematic addresses to suppression list
- Prevents future sends to suppressed addresses

## 🔐 Security Considerations

### SMTP Credentials
- Store passwords encrypted in production
- Use environment variables for sensitive config
- Rotate SMTP passwords regularly

### Webhook Security
- Verify webhook signatures to prevent abuse
- Use HTTPS for webhook endpoints in production
- Rate limit webhook endpoints

### GDPR Compliance
- Honor unsubscribe requests automatically
- Maintain suppression lists indefinitely
- Provide data export/deletion capabilities

## 🎯 Production Checklist

### Before Going Live:
- [ ] DNS records properly configured and propagated
- [ ] VPS mail server hardened and secured
- [ ] SSL certificates installed and valid
- [ ] Monitoring and alerting configured
- [ ] Backup strategy in place for mail server
- [ ] Email templates tested across major clients
- [ ] Deliverability testing with Gmail/Outlook
- [ ] Webhook endpoints secured with HTTPS
- [ ] Rate limiting configured appropriately
- [ ] Bounce/complaint handling verified

### Performance Optimization:
- [ ] Configure connection pooling for high volume
- [ ] Set appropriate rate limits per your VPS capacity
- [ ] Monitor memory and CPU usage during campaigns
- [ ] Implement queue management for large sends
- [ ] Set up email warm-up schedule for new IP

## 🆘 Troubleshooting

### Common Issues:

**Connection Refused**:
- Check VPS firewall allows SMTP ports
- Verify mail server is running
- Test telnet connection to VPS

**Authentication Failed**:
- Verify username/password in database
- Check SMTP credentials in environment
- Ensure user exists in mail server

**High Bounce Rate**:
- Check SPF/DKIM/DMARC records
- Verify IP reputation
- Review email content for spam triggers

**Slow Delivery**:
- Check VPS resources (CPU/Memory)
- Review mail queue on VPS
- Adjust rate limits in configuration

## 📞 Support
For VPS-specific issues, check:
- OVH support documentation
- Mail server logs: `/var/log/maillog` or `/var/log/mail.log`
- Postfix logs for delivery details
- Dovecot logs for authentication issues

---

**Next Steps**: Once your VPS is configured, test the complete email flow end-to-end and monitor delivery rates to major providers.