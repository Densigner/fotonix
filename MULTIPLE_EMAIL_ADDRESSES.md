# 📧 Multiple Email Addresses Support

## ✅ **Your Current Configuration Will Work!**

Your VPS configuration supports **unlimited email addresses** within the fotonix.co.uk domain:

```bash
MAIL_HOST=mail.fotonix.co.uk
MAIL_PORT=587
MAIL_USERNAME=noreply@fotonix.co.uk    # Main authentication user
MAIL_PASSWORD=secure-password-here      # Password for authentication
MAIL_FROM_NAME=Fotonix
MAIL_FROM_ADDRESS=noreply@fotonix.co.uk # Default FROM address
```

## 🎯 **How Multiple Addresses Work**

### **Method 1: Dynamic FROM Address (Recommended)**
Use your `noreply@fotonix.co.uk` credentials to send from ANY address on your domain:

```javascript
// Send from support@fotonix.co.uk
await fetch('/api/emails/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: 'customer@example.com',
    from: 'support@fotonix.co.uk',          // 🎯 Custom FROM address
    subject: 'Customer Support Response',
    html: '<h1>Hello from Support!</h1>'
  })
});

// Send from marketing@fotonix.co.uk
await fetch('/api/emails/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: 'subscriber@example.com',
    from: 'marketing@fotonix.co.uk',        // 🎯 Different FROM address
    subject: 'Monthly Newsletter',
    html: '<h1>Newsletter Content</h1>'
  })
});

// Send from sales@fotonix.co.uk  
await fetch('/api/emails/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: 'lead@example.com',
    from: 'sales@fotonix.co.uk',            // 🎯 Another FROM address
    subject: 'Sales Follow-up',
    html: '<h1>Thanks for your interest!</h1>'
  })
});
```

### **Method 2: Database Configuration (Advanced)**
For dedicated SMTP credentials per email address:

```sql
-- Multiple SMTP configurations in database
INSERT INTO smtp_credentials (tenant_id, provider, host, port, username, password_encrypted, from_name, from_address, use_tls, use_starttls) VALUES
(1, 'smtp', 'mail.fotonix.co.uk', 587, 'noreply@fotonix.co.uk', 'password1', 'Fotonix', 'noreply@fotonix.co.uk', false, true),
(1, 'smtp', 'mail.fotonix.co.uk', 587, 'support@fotonix.co.uk', 'password2', 'Fotonix Support', 'support@fotonix.co.uk', false, true),
(1, 'smtp', 'mail.fotonix.co.uk', 587, 'marketing@fotonix.co.uk', 'password3', 'Fotonix Marketing', 'marketing@fotonix.co.uk', false, true);
```

## 📬 **Common Fotonix Email Addresses**

Here are typical email addresses you might want to use:

```bash
# Customer Service
noreply@fotonix.co.uk          # Automated emails
support@fotonix.co.uk          # Customer support
help@fotonix.co.uk             # Help desk

# Business Functions  
sales@fotonix.co.uk            # Sales team
marketing@fotonix.co.uk        # Marketing campaigns
newsletter@fotonix.co.uk       # Newsletter campaigns

# Administrative
admin@fotonix.co.uk            # Admin notifications
billing@fotonix.co.uk          # Billing/payments
security@fotonix.co.uk         # Security alerts

# Technical
api@fotonix.co.uk              # API notifications
alerts@fotonix.co.uk           # System alerts
monitoring@fotonix.co.uk       # Monitoring reports
```

## 🔧 **VPS Mail Server Setup for Multiple Addresses**

### **1. Create Email Accounts on VPS**
On your Ubuntu VPS, create actual email accounts:

```bash
# SSH into your VPS (vps-603c4873.vps.ovh.net)
ssh root@51.75.78.118

# Create email users (run on VPS)
adduser --system --group --home /var/mail/noreply --shell /bin/false noreply
adduser --system --group --home /var/mail/support --shell /bin/false support  
adduser --system --group --home /var/mail/marketing --shell /bin/false marketing
adduser --system --group --home /var/mail/sales --shell /bin/false sales

# Set passwords for email accounts
passwd noreply
passwd support
passwd marketing  
passwd sales
```

### **2. Postfix Virtual Aliases (Alternative)**
Or use virtual aliases (all emails go to one account):

```bash
# Edit /etc/postfix/virtual on VPS
echo "support@fotonix.co.uk noreply@fotonix.co.uk" >> /etc/postfix/virtual
echo "marketing@fotonix.co.uk noreply@fotonix.co.uk" >> /etc/postfix/virtual
echo "sales@fotonix.co.uk noreply@fotonix.co.uk" >> /etc/postfix/virtual

# Update postfix  
postmap /etc/postfix/virtual
systemctl reload postfix
```

## 🎯 **Recommendation: Use Method 1**

For your use case, **Method 1 (Dynamic FROM)** is recommended because:

✅ **Simple Setup**: One SMTP user handles all addresses  
✅ **Easy Management**: No need to manage multiple passwords  
✅ **Flexible**: Add new email addresses instantly  
✅ **Cost Effective**: Single authentication account  
✅ **Reliable**: One connection, multiple FROM addresses

## 📧 **Example Usage in Your App**

```javascript
// In your React components or server routes:

// Customer support email
const sendSupportEmail = async (customerEmail, message) => {
  return fetch('/api/emails/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: customerEmail,
      from: 'support@fotonix.co.uk',
      subject: 'Re: Your Support Request',
      html: `<p>Hi,</p><p>${message}</p><p>Best regards,<br>Fotonix Support Team</p>`
    })
  });
};

// Marketing campaign
const sendMarketingEmail = async (subscribers, campaign) => {
  return fetch('/api/emails/send-bulk', {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipients: subscribers,
      from: 'marketing@fotonix.co.uk',  // 🎯 Custom FROM
      subject: campaign.subject,
      html: campaign.html,
      campaignId: campaign.id
    })
  });
};
```

## 🛡️ **Security & Deliverability**

### **SPF Record** (handles all @fotonix.co.uk addresses):
```dns
fotonix.co.uk. IN TXT "v=spf1 ip4:51.75.78.118 include:_spf.google.com ~all"
```

### **DKIM Signing** (one key signs all addresses):
```dns  
default._domainkey.fotonix.co.uk. IN TXT "v=DKIM1; k=rsa; p=YOUR_DKIM_PUBLIC_KEY"
```

### **DMARC Policy** (covers entire domain):
```dns
_dmarc.fotonix.co.uk. IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@fotonix.co.uk"
```

## ✅ **Summary**

Your current VPS configuration with:
- **Authentication**: `noreply@fotonix.co.uk`  
- **Host**: `mail.fotonix.co.uk`
- **Port**: `587` (STARTTLS)

Will support **unlimited email addresses** on your domain. The system automatically:
- ✅ Authenticates with your noreply credentials
- ✅ Sends from any @fotonix.co.uk address you specify  
- ✅ Tracks all emails in the database
- ✅ Handles bounces and complaints properly
- ✅ Maintains reputation for entire domain

**You're all set for multiple email addresses! 🚀**