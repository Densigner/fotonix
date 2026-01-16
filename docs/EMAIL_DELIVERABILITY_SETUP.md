# Email Deliverability Setup Guide

## Issues Identified

### 1. ✅ SMTP Sending (FIXED)
- **Problem**: Emails stuck in 'queued' status, missing `provider_message_id` column
- **Solution**: Added column via migration 008
- **Status**: SMTP connection verified, emails now being sent

### 2. ⚠️ Spam Folder Issue
**Problem**: Emails landing in spam because domain lacks authentication

Emails go to spam when they fail these checks:
- **SPF**: Sender Policy Framework - verifies sender IP is authorized
- **DKIM**: DomainKeys Identified Mail - cryptographic signature
- **DMARC**: Domain-based Message Authentication - policy for failed authentication

## DNS Records to Add

### SPF Record
**Type**: TXT  
**Host**: `@` (or `fotonix.co.uk`)  
**Value**: `v=spf1 ip4:51.75.78.118 include:_spf.google.com ~all`

**Explanation**:
- `v=spf1` - SPF version
- `ip4:51.75.78.118` - Your mail server IP (mail.fotonix.co.uk)
- `include:_spf.google.com` - If you use Google Workspace
- `~all` - Soft fail (emails from other IPs marked suspicious)

### DKIM Record
DKIM requires generating a key pair on your mail server.

**SSH into your VPS and run**:
```bash
# Generate DKIM keys
sudo apt-get install opendkim opendkim-tools
sudo mkdir -p /etc/opendkim/keys/fotonix.co.uk
cd /etc/opendkim/keys/fotonix.co.uk
sudo opendkim-genkey -s mail -d fotonix.co.uk
sudo chown opendkim:opendkim mail.private
```

**Then add DNS record**:
**Type**: TXT  
**Host**: `mail._domainkey` (or `mail._domainkey.fotonix.co.uk`)  
**Value**: (Copy from `/etc/opendkim/keys/fotonix.co.uk/mail.txt`)

Example:
```
v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...
```

### DMARC Record
**Type**: TXT  
**Host**: `_dmarc` (or `_dmarc.fotonix.co.uk`)  
**Value**: `v=DMARC1; p=quarantine; rua=mailto:dmarc@fotonix.co.uk; pct=100; adkim=s; aspf=s`

**Explanation**:
- `p=quarantine` - Put failing emails in spam (use `none` for testing, `reject` when confident)
- `rua=mailto:dmarc@fotonix.co.uk` - Send aggregate reports here
- `pct=100` - Apply policy to 100% of emails
- `adkim=s` - Strict DKIM alignment
- `aspf=s` - Strict SPF alignment

### Reverse DNS (PTR Record)
**Contact your VPS provider** to set PTR record:
- IP: `51.75.78.118`
- Points to: `mail.fotonix.co.uk`

This is usually done through your VPS control panel (OVH, DigitalOcean, etc.)

## Implementation Steps

### 1. Add SPF Record (5 minutes)
Go to your DNS provider (Cloudflare, etc.) and add:
```
Type: TXT
Name: @
Value: v=spf1 ip4:51.75.78.118 ~all
TTL: 3600
```

### 2. Generate and Add DKIM (20 minutes)
```bash
# SSH into mail.fotonix.co.uk
ssh user@51.75.78.118

# Install DKIM tools
sudo apt-get update
sudo apt-get install opendkim opendkim-tools -y

# Generate keys
sudo mkdir -p /etc/opendkim/keys/fotonix.co.uk
cd /etc/opendkim/keys/fotonix.co.uk
sudo opendkim-genkey -s mail -d fotonix.co.uk -b 2048

# Show public key to add to DNS
sudo cat mail.txt
```

Copy the value from `mail.txt` and add to DNS:
```
Type: TXT
Name: mail._domainkey
Value: v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY_HERE
TTL: 3600
```

Configure OpenDKIM in Postfix:
```bash
# Edit /etc/opendkim.conf
sudo nano /etc/opendkim.conf
```

Add:
```
Domain                  fotonix.co.uk
KeyFile                 /etc/opendkim/keys/fotonix.co.uk/mail.private
Selector                mail
```

Edit `/etc/postfix/main.cf`:
```bash
sudo nano /etc/postfix/main.cf
```

Add:
```
# DKIM
milter_default_action = accept
milter_protocol = 6
smtpd_milters = inet:127.0.0.1:8891
non_smtpd_milters = $smtpd_milters
```

Restart services:
```bash
sudo systemctl restart opendkim
sudo systemctl restart postfix
```

### 3. Add DMARC Record (2 minutes)
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@fotonix.co.uk; pct=100
TTL: 3600
```

Start with `p=none` for monitoring, then change to `p=quarantine` after a week.

### 4. Set PTR Record
Contact your VPS provider (looks like OVH based on IP) and request:
```
IP: 51.75.78.118
PTR: mail.fotonix.co.uk
```

## Verification

### Check DNS Records
```bash
# Check SPF
dig TXT fotonix.co.uk +short

# Check DKIM
dig TXT mail._domainkey.fotonix.co.uk +short

# Check DMARC
dig TXT _dmarc.fotonix.co.uk +short

# Check PTR (reverse DNS)
dig -x 51.75.78.118 +short
```

### Test Email Authentication
Send test email to these checkers:
1. **Mail Tester**: mail-tester.com - Send to their test address, get score /10
2. **MXToolbox**: mxtoolbox.com/deliverability - Check deliverability
3. **Google Postmaster**: gmail.com/postmaster - Monitor Gmail delivery

### Check Current Status
```bash
# Check if DKIM is already configured
ssh user@51.75.78.118 "sudo dpkg -l | grep opendkim"

# Check Postfix config
ssh user@51.75.78.118 "sudo postconf | grep milter"
```

## Expected Results

**Before (Current State)**:
- ❌ SPF: FAIL or SOFTFAIL
- ❌ DKIM: NONE
- ❌ DMARC: NONE
- ❌ Score: 3-5/10
- ❌ Lands in: SPAM folder

**After Setup**:
- ✅ SPF: PASS
- ✅ DKIM: PASS
- ✅ DMARC: PASS
- ✅ Score: 9-10/10
- ✅ Lands in: INBOX

## Quick Fix Priority

1. **SPF Record** (5 min) - Immediate 30% improvement
2. **PTR Record** (Request from provider) - 20% improvement
3. **DKIM** (20 min setup) - 40% improvement
4. **DMARC** (2 min) - 10% improvement + monitoring

## Troubleshooting

### Email still going to spam after setup?
1. Wait 24-48 hours for DNS propagation
2. Check mail-tester.com score
3. Verify DKIM signing is working: View email source, look for "DKIM-Signature:" header
4. Check your IP isn't blacklisted: mxtoolbox.com/blacklists.aspx

### DKIM not working?
```bash
# Test DKIM on your server
echo "test" | mail -s "DKIM Test" your-email@gmail.com
# Check email source for DKIM-Signature header
```

### Need help?
- VPS/Postfix issues: Check `/var/log/mail.log`
- DNS issues: Use `dig` commands above
- DKIM issues: Check `/var/log/opendkim.log`
