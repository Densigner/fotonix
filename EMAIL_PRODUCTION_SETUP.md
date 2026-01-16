# Email System - Production Setup Checklist

## ✅ COMPLETED - VPS Email Infrastructure

### Current Working Setup
- **VPS:** mail.fotonix.co.uk (51.75.78.118)
- **Email receiving:** Fully operational via Postfix → Webhook → PostgreSQL
- **Test email received successfully:** ID #2 in database

---

## 🔧 REQUIRED CHANGES FOR PRODUCTION

### 1. Database Configuration - `.env` File
**CRITICAL:** Your `.env` is currently pointing to the VPS database for development.

**Current (Development):**
```
DATABASE_URL=postgres://fotonix:fotonixpass@51.75.78.118:5432/fotonix_dev
```

**For Production, choose ONE option:**

#### Option A: Use VPS as Primary Database (Recommended)
- Keep VPS database exposed on port 5432
- Change local `.env` back to local database for development
- Update production `.env` to point to VPS

**Production `.env`:**
```
DATABASE_URL=postgres://fotonix:fotonixpass@127.0.0.1:5432/fotonix_dev
```

**Local Development `.env`:**
```
DATABASE_URL=postgres://fotonix:fotonixpass@127.0.0.1:5432/fotonix_dev
```

#### Option B: Keep VPS Exposed (Current Setup)
- **Security Risk:** PostgreSQL exposed to internet
- **Required:** Whitelist only trusted IPs in firewall
- Add to VPS: `sudo ufw allow from YOUR_IP to any port 5432`

#### Option C: SSH Tunnel (Most Secure)
- Close VPS PostgreSQL port: `sudo ufw delete allow 5432/tcp`
- Connect via SSH tunnel from local:
```bash
ssh -L 5432:127.0.0.1:5432 ubuntu@51.75.78.118
```
- Local `.env` stays: `DATABASE_URL=postgres://fotonix:fotonixpass@127.0.0.1:5432/fotonix_dev`

---

### 2. DNS Configuration for Email Deliverability

**CRITICAL:** Without these DNS records, your outbound emails will be marked as spam or rejected.

#### Required DNS Records (Add to your domain registrar):

**SPF Record** - Authorizes VPS to send emails:
```
Type: TXT
Name: @
Value: v=spf1 ip4:51.75.78.118 ~all
```

**DKIM Record** - Email signature authentication:
1. Generate DKIM keys on VPS:
```bash
ssh ubuntu@51.75.78.118
sudo apt-get install opendkim opendkim-tools
sudo opendkim-genkey -D /etc/opendkim/keys/ -d fotonix.co.uk -s default
sudo cat /etc/opendkim/keys/default.txt
```

2. Add the output as DNS TXT record:
```
Type: TXT
Name: default._domainkey
Value: (copy from the command output above)
```

**DMARC Record** - Email policy:
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:noreply@fotonix.co.uk
```

**Already Configured ✅:**
```
MX Record: mail.fotonix.co.uk (Priority: 10)
```

---

### 3. PostgreSQL Security Hardening

**If keeping port 5432 exposed:**

1. **Change default password:**
```bash
ssh ubuntu@51.75.78.118
sudo -u postgres psql -c "ALTER USER fotonix WITH PASSWORD 'NEW_SECURE_PASSWORD';"
```

2. **Update `.env` files** with new password

3. **Restrict connections to specific IPs** in `/etc/postgresql/17/main/pg_hba.conf`:
```
# Replace this line:
host    all             all             0.0.0.0/0               md5

# With specific IPs only:
host    all             all             YOUR_OFFICE_IP/32       md5
host    all             all             YOUR_HOME_IP/32         md5
```

4. **Restart PostgreSQL:**
```bash
sudo systemctl restart postgresql@17-main
```

---

### 4. Email Service Monitoring

**Set up monitoring for:**
- Postfix mail queue: `mailq` (should be empty)
- Webhook service: `sudo systemctl status fotonix-email-api`
- PostgreSQL: `sudo systemctl status postgresql@17-main`
- Disk space for email storage

**Create monitoring script:**
```bash
#!/bin/bash
# /usr/local/bin/email-health-check.sh

# Check services
systemctl is-active --quiet postfix || echo "⚠️ Postfix is down"
systemctl is-active --quiet fotonix-email-api || echo "⚠️ Webhook is down"
systemctl is-active --quiet postgresql@17-main || echo "⚠️ PostgreSQL is down"

# Check mail queue
QUEUE_COUNT=$(mailq | grep -c "^[A-F0-9]")
if [ "$QUEUE_COUNT" -gt 10 ]; then
    echo "⚠️ Mail queue has $QUEUE_COUNT messages"
fi

# Check database connection
sudo -u postgres psql -d fotonix_dev -c "SELECT COUNT(*) FROM email_messages;" > /dev/null || echo "⚠️ Database connection failed"
```

**Add to crontab:** `*/5 * * * * /usr/local/bin/email-health-check.sh`

---

### 5. VPS Firewall Review

**Current open ports:**
```
22/tcp    - SSH
25/tcp    - SMTP (Postfix mail)
80/tcp    - HTTP
443/tcp   - HTTPS
4000/tcp  - Webhook (should be localhost only)
5432/tcp  - PostgreSQL (consider closing)
```

**Recommended changes:**
```bash
# Close PostgreSQL to internet
sudo ufw delete allow 5432/tcp

# Verify webhook is NOT exposed
sudo ufw status | grep 4000  # Should show nothing

# Verify Postfix is exposed
sudo ufw status | grep 25    # Should allow from anywhere
```

---

### 6. Business Email Setup for Users

**When users need new email addresses:**

1. **Add to VPS database:**
```sql
INSERT INTO business_emails (
    member_uid, 
    tenant_id,
    business_name, 
    email_address, 
    email_type, 
    display_name,
    is_active
) VALUES (
    'USER_FIREBASE_UID',
    'default',
    'Their Business Name',
    'their.email@fotonix.co.uk',
    'custom',
    'Display Name',
    true
);
```

2. **Or use the API endpoint** (create if doesn't exist):
```javascript
POST /api/member/business-emails
Body: {
    "memberUid": "USER_UID",
    "businessName": "Business Name",
    "emailAddress": "email@fotonix.co.uk",
    "emailType": "custom",
    "displayName": "Display Name"
}
```

---

### 7. Backup Strategy

**Email data backup:**
```bash
#!/bin/bash
# /usr/local/bin/backup-email-db.sh

BACKUP_DIR="/backups/email"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup email tables
sudo -u postgres pg_dump -d fotonix_dev -t email_messages -t business_emails > $BACKUP_DIR/email_backup_$DATE.sql

# Keep only last 30 days
find $BACKUP_DIR -name "email_backup_*.sql" -mtime +30 -delete
```

**Add to crontab:** `0 2 * * * /usr/local/bin/backup-email-db.sh`

---

### 8. Environment Variable Sync

**Files to update for production:**

1. **VPS webhook `.env`** (`/opt/fotonix-email-api/.env`):
```bash
DATABASE_URL=postgresql://fotonix:NEW_PASSWORD@127.0.0.1:5432/fotonix_dev
WEBHOOK_SECRET=CHANGE_THIS_SECRET_IN_PRODUCTION
NODE_ENV=production
```

2. **Local/Production app `.env`**:
```bash
# Database (local during dev, VPS in production)
DATABASE_URL=postgres://fotonix:fotonixpass@127.0.0.1:5432/fotonix_dev

# Email webhook secret (must match VPS)
WEBHOOK_SECRET=CHANGE_THIS_SECRET_IN_PRODUCTION

# Email settings (already configured)
MAIL_HOST=mail.fotonix.co.uk
MAIL_PORT=587
```

3. **Python webhook forwarder** (`/usr/local/bin/email-to-webhook.py`):
- Update URL if webhook moves
- Update secret key

4. **Postfix master.cf** (`/etc/postfix/master.cf`):
- Verify webhook URL points to correct endpoint
- Currently: `http://localhost:4000/api/email/receive-webhook`

---

## 📋 Pre-Production Checklist

- [ ] Add SPF DNS record
- [ ] Add DKIM DNS record  
- [ ] Add DMARC DNS record
- [ ] Change PostgreSQL password
- [ ] Restrict PostgreSQL connections (or close port 5432)
- [ ] Update all `.env` files with new credentials
- [ ] Set up email monitoring script
- [ ] Set up database backup script
- [ ] Test sending email from each business email address
- [ ] Test receiving email to each business email address
- [ ] Verify emails appear in inbox UI
- [ ] Check email deliverability (not marked as spam)
- [ ] Document user onboarding process for new business emails

---

## 🚨 Current Security Warnings

1. **PostgreSQL exposed to internet** - Port 5432 is open to 0.0.0.0/0
2. **Default password in use** - `fotonixpass` should be changed
3. **No DKIM/SPF/DMARC** - Outbound emails likely marked as spam
4. **No automated backups** - Email data not backed up
5. **No monitoring alerts** - Won't know if services go down

---

## 📞 Testing Commands

**Test email reception:**
```bash
# Send test email to any @fotonix.co.uk address
echo "Test body" | mail -s "Test Subject" contact.fffff@fotonix.co.uk

# Check if received in database
ssh ubuntu@51.75.78.118
sudo -u postgres psql -d fotonix_dev -c "SELECT id, from_address, subject, created_at FROM email_messages ORDER BY id DESC LIMIT 5;"
```

**Test webhook health:**
```bash
ssh ubuntu@51.75.78.118
curl http://localhost:4000/health
# Should return: {"status":"ok","timestamp":"..."}
```

**Check mail logs:**
```bash
ssh ubuntu@51.75.78.118
sudo tail -f /var/log/mail.log
```

**Check webhook logs:**
```bash
ssh ubuntu@51.75.78.118
sudo journalctl -u fotonix-email-api -f
```

---

## 📧 Current Working Email System

**Inbound Flow:**
1. Gmail → MX record → mail.fotonix.co.uk (VPS)
2. Postfix receives email on port 25
3. Postfix routes via transport map to webhook transport
4. Python script `/usr/local/bin/email-to-webhook.py` parses email
5. Python POSTs to `http://localhost:4000/api/email/receive-webhook`
6. Node.js webhook saves to PostgreSQL `fotonix_dev.email_messages`
7. Frontend displays in inbox via API `/api/email/messages`

**Verified Working:**
- ✅ Email ID #2: "Ninja please" from joshmarsden28@gmail.com received successfully
- ✅ Business email matching: contact.fffff@fotonix.co.uk
- ✅ Database storage: VPS PostgreSQL
- ✅ API retrieval: GET /api/email/messages

---

## 🔗 Important File Locations on VPS

```
/opt/fotonix-email-api/webhook-standalone.js    - Webhook server
/opt/fotonix-email-api/.env                      - Webhook config
/usr/local/bin/email-to-webhook.py               - Email forwarder
/etc/systemd/system/fotonix-email-api.service    - Webhook systemd service
/etc/postfix/main.cf                             - Postfix config
/etc/postfix/master.cf                           - Postfix transports
/etc/postfix/transport                           - Email routing rules
/etc/postgresql/17/main/postgresql.conf          - PostgreSQL config
/etc/postgresql/17/main/pg_hba.conf              - PostgreSQL access rules
/var/log/mail.log                                - Postfix logs
```

---

## 🎯 Recommended Production Architecture

```
Internet
    ↓
Gmail/External Mail Servers
    ↓
[MX: mail.fotonix.co.uk - Port 25]
    ↓
Postfix (VPS)
    ↓
Transport Map
    ↓
Python Forwarder Script
    ↓
Node.js Webhook (localhost:4000)
    ↓
PostgreSQL (localhost:5432)
    ↑
Production App Server (via SSH tunnel or VPN)
    ↑
Users' Browsers
```

**Key Security:**
- PostgreSQL NOT exposed to internet
- Webhook NOT exposed to internet  
- Only Postfix (port 25) and SSH (port 22) exposed
- All app-to-database via SSH tunnel
