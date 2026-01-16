#!/bin/bash
# Configure Postfix to forward incoming emails to webhook
# Run this on your VPS: mail.fotonix.co.uk (51.75.78.118)

echo "📧 Configuring Email Webhook Integration"
echo "========================================"
echo ""

# Your webhook URL (update if using different domain/port)
WEBHOOK_URL="https://fotonix.co.uk/api/email/receive-webhook"
WEBHOOK_SECRET="fotonix-webhook-secret-2024"

echo "Webhook URL: $WEBHOOK_URL"
echo "Webhook Secret: $WEBHOOK_SECRET"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
apt-get update
apt-get install -y python3 python3-pip curl jq

# Install Python script for forwarding emails to webhook
echo "📝 Creating email forwarder script..."
cat > /usr/local/bin/email-to-webhook.py << 'PYTHON_SCRIPT'
#!/usr/bin/env python3
"""
Email to Webhook Forwarder
Reads email from stdin (Postfix pipe) and POSTs to webhook
"""

import sys
import json
import email
import requests
from email import policy
from email.parser import BytesParser

def parse_email(raw_email):
    """Parse raw email into structured data"""
    msg = BytesParser(policy=policy.default).parsebytes(raw_email)
    
    # Extract headers
    from_addr = msg.get('From', '')
    to_addrs = msg.get('To', '').split(',')
    subject = msg.get('Subject', '')
    message_id = msg.get('Message-ID', '')
    in_reply_to = msg.get('In-Reply-To', '')
    references = msg.get('References', '').split()
    
    # Extract body
    html_body = None
    text_body = None
    
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            if content_type == 'text/plain' and text_body is None:
                text_body = part.get_content()
            elif content_type == 'text/html' and html_body is None:
                html_body = part.get_content()
    else:
        content_type = msg.get_content_type()
        if content_type == 'text/plain':
            text_body = msg.get_content()
        elif content_type == 'text/html':
            html_body = msg.get_content()
    
    return {
        'from': from_addr,
        'to': [addr.strip() for addr in to_addrs],
        'subject': subject,
        'html': html_body or '',
        'text': text_body or '',
        'headers': {
            'message-id': message_id,
            'in-reply-to': in_reply_to,
            'references': references
        }
    }

def main():
    """Read email from stdin and POST to webhook"""
    # Read raw email from stdin
    raw_email = sys.stdin.buffer.read()
    
    # Parse email
    email_data = parse_email(raw_email)
    
    # Log received email
    with open('/var/log/email-webhook.log', 'a') as log:
        log.write(f"Received email: From={email_data['from']}, To={email_data['to']}, Subject={email_data['subject']}\n")
    
    # POST to webhook
    webhook_url = sys.argv[1] if len(sys.argv) > 1 else 'https://fotonix.co.uk/api/email/receive-webhook'
    webhook_secret = sys.argv[2] if len(sys.argv) > 2 else 'fotonix-webhook-secret-2024'
    
    headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': webhook_secret
    }
    
    try:
        response = requests.post(webhook_url, json=email_data, headers=headers, timeout=10)
        
        with open('/var/log/email-webhook.log', 'a') as log:
            log.write(f"Webhook response: {response.status_code} - {response.text}\n")
        
        sys.exit(0 if response.status_code == 200 else 1)
    
    except Exception as e:
        with open('/var/log/email-webhook.log', 'a') as log:
            log.write(f"Webhook error: {str(e)}\n")
        sys.exit(1)

if __name__ == '__main__':
    main()
PYTHON_SCRIPT

chmod +x /usr/local/bin/email-to-webhook.py

# Install required Python packages
pip3 install requests

echo "✅ Email forwarder script created"
echo ""

# Configure Postfix to use the forwarder
echo "⚙️  Configuring Postfix..."

# Backup existing config
cp /etc/postfix/master.cf /etc/postfix/master.cf.backup.$(date +%Y%m%d)

# Add webhook transport to master.cf
if ! grep -q "webhook" /etc/postfix/master.cf; then
    echo "" >> /etc/postfix/master.cf
    echo "# Email Webhook Transport" >> /etc/postfix/master.cf
    echo "webhook unix - n n - - pipe" >> /etc/postfix/master.cf
    echo "  flags=F user=nobody argv=/usr/local/bin/email-to-webhook.py $WEBHOOK_URL $WEBHOOK_SECRET" >> /etc/postfix/master.cf
    echo "✅ Added webhook transport to master.cf"
else
    echo "⚠️  Webhook transport already exists in master.cf"
fi

# Configure virtual aliases to route all @fotonix.co.uk emails through webhook
echo "📝 Configuring virtual aliases..."

# Backup existing virtual file
if [ -f /etc/postfix/virtual ]; then
    cp /etc/postfix/virtual /etc/postfix/virtual.backup.$(date +%Y%m%d)
fi

# Create/update virtual file with webhook routing
cat > /etc/postfix/virtual << EOF
# Route all @fotonix.co.uk emails through webhook
# This allows multi-tenant email receiving

# Catch-all for @fotonix.co.uk domain
@fotonix.co.uk webhook@fotonix.co.uk

# Webhook mailbox forwards to webhook transport
webhook@fotonix.co.uk webhook:
EOF

# Update transport map
cat > /etc/postfix/transport << EOF
# Transport map for webhook
webhook: webhook:
EOF

# Update Postfix main.cf to use transport map
if ! grep -q "transport_maps" /etc/postfix/main.cf; then
    echo "transport_maps = hash:/etc/postfix/transport" >> /etc/postfix/main.cf
fi

# Update maps
postmap /etc/postfix/virtual
postmap /etc/postfix/transport

echo "✅ Virtual aliases configured"
echo ""

# Reload Postfix
echo "🔄 Reloading Postfix..."
postfix reload

echo "✅ Postfix reloaded"
echo ""

# Create log file with proper permissions
touch /var/log/email-webhook.log
chmod 666 /var/log/email-webhook.log

echo "✅ Email webhook integration complete!"
echo ""
echo "📋 Test by sending email to any address @fotonix.co.uk"
echo "📋 Check logs: tail -f /var/log/email-webhook.log"
echo "📋 Check Postfix logs: tail -f /var/log/mail.log"
echo ""
echo "🔧 To test the forwarder directly:"
echo "   echo 'test' | /usr/local/bin/email-to-webhook.py"
