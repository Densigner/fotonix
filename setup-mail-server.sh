#!/bin/bash

# 🚀 OVH VPS Mail Server Setup Script (Ubuntu User Version)
# VPS Details: vps-603c4873.vps.ovh.net (51.75.78.118)
# OS: Ubuntu 25.04
# Domain: fotonix.co.uk
# User: ubuntu (will use sudo for admin tasks)

echo "🚀 Starting Fotonix Mail Server Setup on OVH VPS"
echo "================================================"
echo "VPS: vps-603c4873.vps.ovh.net (51.75.78.118)"
echo "Domain: fotonix.co.uk"
echo "Mail Server: mail.fotonix.co.uk"
echo "User: ubuntu (using sudo)"
echo ""

# Check if running as ubuntu user
if [ "$USER" != "ubuntu" ]; then
    echo "❌ Please run this script as ubuntu user"
    exit 1
fi

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install required packages
echo "📦 Installing mail server packages..."
sudo apt install -y postfix dovecot-core dovecot-imapd dovecot-pop3d dovecot-lmtpd \
               opendkim opendkim-tools postfix-policyd-spf-python \
               certbot nginx ufw fail2ban \
               mailutils mutt telnet netcat-openbsd

# Configure hostname
echo "🌐 Setting up hostname..."
sudo hostnamectl set-hostname mail.fotonix.co.uk
echo "127.0.0.1 mail.fotonix.co.uk mail" | sudo tee -a /etc/hosts

# Configure Postfix
echo "📧 Configuring Postfix..."
cat > /etc/postfix/main.cf << 'EOF'
# Basic Configuration
myhostname = mail.fotonix.co.uk
mydomain = fotonix.co.uk
myorigin = $mydomain
mydestination = $myhostname, localhost.$mydomain, localhost, $mydomain
relayhost = 
mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128
mailbox_size_limit = 0
recipient_delimiter = +
inet_interfaces = all
inet_protocols = all

# Virtual mailbox configuration
virtual_mailbox_domains = $mydomain
virtual_mailbox_base = /var/mail/virtual
virtual_mailbox_maps = hash:/etc/postfix/virtual_mailbox
virtual_alias_maps = hash:/etc/postfix/virtual_alias
virtual_minimum_uid = 100
virtual_uid_maps = static:5000
virtual_gid_maps = static:5000

# SMTP Authentication
smtpd_sasl_type = dovecot
smtpd_sasl_path = private/auth
smtpd_sasl_auth_enable = yes
smtpd_sasl_security_options = noanonymous
smtpd_sasl_local_domain = $mydomain
broken_sasl_auth_clients = yes

# TLS Configuration
smtpd_tls_cert_file = /etc/ssl/certs/ssl-cert-snakeoil.pem
smtpd_tls_key_file = /etc/ssl/private/ssl-cert-snakeoil.key
smtpd_use_tls = yes
smtpd_tls_session_cache_database = btree:${data_directory}/smtpd_scache
smtp_tls_session_cache_database = btree:${data_directory}/smtp_scache
smtpd_tls_security_level = may
smtpd_tls_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1
smtp_tls_security_level = may

# SMTP Restrictions
smtpd_helo_restrictions = permit_mynetworks,
                         permit_sasl_authenticated,
                         reject_invalid_helo_hostname,
                         reject_non_fqdn_helo_hostname
                         
smtpd_recipient_restrictions = permit_mynetworks,
                              permit_sasl_authenticated,
                              reject_unauth_destination,
                              reject_invalid_hostname,
                              reject_non_fqdn_hostname,
                              reject_non_fqdn_sender,
                              reject_non_fqdn_recipient,
                              reject_unknown_sender_domain,
                              reject_unknown_recipient_domain,
                              reject_rbl_client zen.spamhaus.org,
                              permit

smtpd_sender_restrictions = permit_mynetworks,
                           permit_sasl_authenticated,
                           reject_non_fqdn_sender,
                           reject_unknown_sender_domain

# Rate limiting
smtpd_error_sleep_time = 1s
smtpd_soft_error_limit = 10
smtpd_hard_error_limit = 20
smtpd_client_connection_count_limit = 20
smtpd_client_connection_rate_limit = 30
smtpd_client_message_rate_limit = 20

# DKIM
milter_default_action = accept
milter_protocol = 2
smtpd_milters = inet:localhost:8891
non_smtpd_milters = inet:localhost:8891
EOF

# Configure Postfix master.cf for submission port
echo "📧 Configuring Postfix submission port..."
cat >> /etc/postfix/master.cf << 'EOF'

# Submission port 587
submission inet n       -       y       -       -       smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=encrypt
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_tls_auth_only=yes
  -o smtpd_reject_unlisted_recipient=no
  -o smtpd_client_restrictions=permit_sasl_authenticated,reject
  -o smtpd_helo_restrictions=permit_sasl_authenticated,reject
  -o smtpd_sender_restrictions=permit_sasl_authenticated,reject
  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject_unauth_destination
  -o milter_macro_daemon_name=ORIGINATING

# SMTPS port 465
smtps     inet  n       -       y       -       -       smtpd
  -o syslog_name=postfix/smtps
  -o smtpd_tls_wrappermode=yes
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_reject_unlisted_recipient=no
  -o smtpd_client_restrictions=permit_sasl_authenticated,reject
  -o smtpd_helo_restrictions=permit_sasl_authenticated,reject
  -o smtpd_sender_restrictions=permit_sasl_authenticated,reject
  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject_unauth_destination
  -o milter_macro_daemon_name=ORIGINATING
EOF

# Create virtual mailbox directories
echo "📁 Creating virtual mailbox directories..."
mkdir -p /var/mail/virtual/fotonix.co.uk
useradd -r -u 5000 -g mail -d /var/mail/virtual -s /sbin/nologin -c "Virtual Mailbox" vmail
chown -R vmail:mail /var/mail/virtual
chmod -R 770 /var/mail/virtual

# Create virtual mailbox maps
echo "📧 Creating virtual mailbox maps..."
cat > /etc/postfix/virtual_mailbox << 'EOF'
noreply@fotonix.co.uk fotonix.co.uk/noreply/
support@fotonix.co.uk fotonix.co.uk/support/
marketing@fotonix.co.uk fotonix.co.uk/marketing/
sales@fotonix.co.uk fotonix.co.uk/sales/
admin@fotonix.co.uk fotonix.co.uk/admin/
billing@fotonix.co.uk fotonix.co.uk/billing/
security@fotonix.co.uk fotonix.co.uk/security/
api@fotonix.co.uk fotonix.co.uk/api/
alerts@fotonix.co.uk fotonix.co.uk/alerts/
monitoring@fotonix.co.uk fotonix.co.uk/monitoring/
EOF

# Create virtual alias maps (optional - for forwarding)
cat > /etc/postfix/virtual_alias << 'EOF'
webmaster@fotonix.co.uk admin@fotonix.co.uk
postmaster@fotonix.co.uk admin@fotonix.co.uk
abuse@fotonix.co.uk admin@fotonix.co.uk
EOF

# Generate postfix maps
postmap /etc/postfix/virtual_mailbox
postmap /etc/postfix/virtual_alias

# Configure Dovecot
echo "📥 Configuring Dovecot..."
cat > /etc/dovecot/dovecot.conf << 'EOF'
# Basic Configuration
protocols = imap pop3 lmtp
listen = *, ::
base_dir = /var/run/dovecot/
instance_name = dovecot

# Logging
log_path = /var/log/dovecot.log
info_log_path = /var/log/dovecot-info.log
debug_log_path = /var/log/dovecot-debug.log

# SSL Configuration
ssl = required
ssl_cert = </etc/ssl/certs/ssl-cert-snakeoil.pem
ssl_key = </etc/ssl/private/ssl-cert-snakeoil.key
ssl_protocols = !SSLv2 !SSLv3 !TLSv1 !TLSv1.1
ssl_cipher_list = ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384

# Mail Location
mail_location = maildir:/var/mail/virtual/%d/%n/Maildir
mail_privileged_group = mail
first_valid_uid = 5000
last_valid_uid = 5000
first_valid_gid = 8
last_valid_gid = 8

# Authentication
auth_mechanisms = plain login
auth_username_chars = abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ01234567890.-_@

# Passdb and Userdb
passdb {
  driver = passwd-file
  args = /etc/dovecot/passwd
}

userdb {
  driver = static
  args = uid=5000 gid=8 home=/var/mail/virtual/%d/%n
}

# Services
service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
  unix_listener auth-userdb {
    mode = 0600
    user = vmail
    group = mail
  }
  user = dovecot
}

service auth-worker {
  user = vmail
}

service lmtp {
  unix_listener /var/spool/postfix/private/dovecot-lmtp {
    group = postfix
    mode = 0600
    user = postfix
  }
}

# Protocols
protocol imap {
  mail_plugins = 
}

protocol pop3 {
  mail_plugins = 
}

protocol lda {
  mail_plugins = 
}
EOF

# Create Dovecot password file
echo "🔐 Creating Dovecot password file..."
touch /etc/dovecot/passwd

# Function to add email users
add_email_user() {
    local email=$1
    local password=$2
    echo "Adding user: $email"
    
    # Create directory structure
    mkdir -p "/var/mail/virtual/fotonix.co.uk/${email%%@*}/Maildir/{new,cur,tmp}"
    chown -R vmail:mail "/var/mail/virtual/fotonix.co.uk/${email%%@*}"
    
    # Add to Dovecot passwd file
    echo "$email:{PLAIN}$password:5000:8::/var/mail/virtual/fotonix.co.uk/${email%%@*}::" >> /etc/dovecot/passwd
}

# Add default email accounts
echo "👥 Creating default email accounts..."
add_email_user "noreply@fotonix.co.uk" "$(openssl rand -base64 32 | tr -d '=' | cut -c1-16)"
add_email_user "support@fotonix.co.uk" "$(openssl rand -base64 32 | tr -d '=' | cut -c1-16)"
add_email_user "marketing@fotonix.co.uk" "$(openssl rand -base64 32 | tr -d '=' | cut -c1-16)"
add_email_user "sales@fotonix.co.uk" "$(openssl rand -base64 32 | tr -d '=' | cut -c1-16)"
add_email_user "admin@fotonix.co.uk" "$(openssl rand -base64 32 | tr -d '=' | cut -c1-16)"

# Set permissions
chmod 600 /etc/dovecot/passwd

# Configure OpenDKIM
echo "🔐 Configuring OpenDKIM..."
cat > /etc/opendkim.conf << 'EOF'
# Basic settings
Syslog yes
SyslogSuccess yes
LogWhy yes
Canonicalization relaxed/simple
Mode sv
SubDomains no

# Security settings
UserID opendkim:opendkim
UMask 007

# Host and port
Socket inet:8891@localhost
PidFile /run/opendkim/opendkim.pid

# Trusted hosts
ExternalIgnoreList refile:/etc/opendkim/trusted.hosts
InternalHosts refile:/etc/opendkim/trusted.hosts

# Key settings
KeyTable refile:/etc/opendkim/key.table
SigningTable refile:/etc/opendkim/signing.table

# Other
OversignHeaders From
EOF

# Create OpenDKIM directories
mkdir -p /etc/opendkim/keys/fotonix.co.uk
chown -R opendkim:opendkim /etc/opendkim
chmod go-rw /etc/opendkim/keys

# Create OpenDKIM trusted hosts
cat > /etc/opendkim/trusted.hosts << 'EOF'
127.0.0.1
localhost
51.75.78.118
*.fotonix.co.uk
fotonix.co.uk
EOF

# Create OpenDKIM key table
cat > /etc/opendkim/key.table << 'EOF'
default._domainkey.fotonix.co.uk fotonix.co.uk:default:/etc/opendkim/keys/fotonix.co.uk/default.private
EOF

# Create OpenDKIM signing table
cat > /etc/opendkim/signing.table << 'EOF'
*@fotonix.co.uk default._domainkey.fotonix.co.uk
EOF

# Generate DKIM keys
echo "🔑 Generating DKIM keys..."
cd /etc/opendkim/keys/fotonix.co.uk
opendkim-genkey -s default -d fotonix.co.uk
chown opendkim:opendkim default.private default.txt
chmod 600 default.private

# Configure firewall
echo "🔥 Configuring firewall..."
ufw allow ssh
ufw allow 25/tcp   # SMTP
ufw allow 587/tcp  # Submission
ufw allow 465/tcp  # SMTPS
ufw allow 993/tcp  # IMAPS
ufw allow 995/tcp  # POP3S
ufw allow 80/tcp   # HTTP (for Let's Encrypt)
ufw allow 443/tcp  # HTTPS
ufw --force enable

# Configure Fail2Ban
echo "🛡️ Configuring Fail2Ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s

[postfix]
enabled = true
port = smtp,465,587
logpath = /var/log/mail.log

[dovecot]
enabled = true
port = pop3,pop3s,imap,imaps,submission,465,sieve
logpath = /var/log/mail.log
EOF

# Start and enable services
echo "🚀 Starting services..."
systemctl enable postfix dovecot opendkim fail2ban
systemctl start postfix dovecot opendkim fail2ban

# Create SSL certificates with Let's Encrypt (requires domain pointing to server)
echo "🔒 Setting up Let's Encrypt SSL..."
certbot certonly --standalone --agree-tos --no-eff-email \
    --email admin@fotonix.co.uk \
    -d mail.fotonix.co.uk

# Update Postfix and Dovecot to use Let's Encrypt certs
if [ -f /etc/letsencrypt/live/mail.fotonix.co.uk/fullchain.pem ]; then
    echo "📜 Updating SSL certificates..."
    postconf -e 'smtpd_tls_cert_file = /etc/letsencrypt/live/mail.fotonix.co.uk/fullchain.pem'
    postconf -e 'smtpd_tls_key_file = /etc/letsencrypt/live/mail.fotonix.co.uk/privkey.pem'
    
    sed -i 's|ssl_cert = <.*|ssl_cert = </etc/letsencrypt/live/mail.fotonix.co.uk/fullchain.pem|' /etc/dovecot/dovecot.conf
    sed -i 's|ssl_key = <.*|ssl_key = </etc/letsencrypt/live/mail.fotonix.co.uk/privkey.pem|' /etc/dovecot/dovecot.conf
    
    systemctl reload postfix dovecot
fi

# Display setup summary
echo ""
echo "🎉 Mail Server Setup Complete!"
echo "================================"
echo ""
echo "📧 Email Accounts Created:"
grep '@fotonix.co.uk' /etc/dovecot/passwd | cut -d: -f1
echo ""
echo "🔑 DKIM Public Key (add to DNS):"
echo "Record Name: default._domainkey.fotonix.co.uk"
echo "Record Type: TXT"
echo "Record Value:"
cat /etc/opendkim/keys/fotonix.co.uk/default.txt
echo ""
echo "📋 Required DNS Records:"
echo "========================"
echo "A Record:     mail.fotonix.co.uk → 51.75.78.118"
echo "MX Record:    fotonix.co.uk → 10 mail.fotonix.co.uk"
echo "SPF Record:   fotonix.co.uk TXT 'v=spf1 ip4:51.75.78.118 ~all'"
echo "DKIM Record:  (see above)"
echo "DMARC Record: _dmarc.fotonix.co.uk TXT 'v=DMARC1; p=quarantine; rua=mailto:admin@fotonix.co.uk'"
echo ""
echo "🔐 Email Passwords:"
echo "==================="
echo "Check /etc/dovecot/passwd for generated passwords"
echo ""
echo "⚙️ Configuration Files:"
echo "======================="
echo "Postfix:   /etc/postfix/main.cf"
echo "Dovecot:   /etc/dovecot/dovecot.conf"
echo "OpenDKIM:  /etc/opendkim.conf"
echo "Passwords: /etc/dovecot/passwd"
echo ""
echo "🧪 Test Commands:"
echo "================"
echo "telnet localhost 25"
echo "telnet localhost 587"
echo "systemctl status postfix dovecot opendkim"
echo ""
echo "✅ Mail server is ready!"
echo "Don't forget to update your DNS records!"
EOF