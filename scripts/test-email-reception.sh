#!/bin/bash

echo "=========================================="
echo "Testing Email Reception System"
echo "=========================================="
echo ""

# Test 1: Check if Python script exists
echo "1. Checking if forwarder script exists..."
if ssh root@51.75.78.118 "test -f /usr/local/bin/email-to-webhook.py"; then
    echo "   ✅ Script exists"
else
    echo "   ❌ Script not found!"
    exit 1
fi

# Test 2: Check Postfix configuration
echo ""
echo "2. Checking Postfix configuration..."
ssh root@51.75.78.118 "grep -A 2 'fotonix.co.uk' /etc/postfix/virtual || echo '❌ No virtual alias found'"

# Test 3: Check Postfix logs for recent activity
echo ""
echo "3. Checking recent Postfix logs..."
ssh root@51.75.78.118 "tail -20 /var/log/mail.log | grep -i 'fotonix\|email-to-webhook' || echo 'No recent email activity'"

# Test 4: Send a test email through the system
echo ""
echo "4. Testing webhook receiver locally..."
echo "   Creating test email..."

cat > /tmp/test-email.txt << 'EOF'
From: test@example.com
To: contact.fffff@fotonix.co.uk
Subject: Test Email - System Check
Date: $(date -R)
Message-ID: <test-$(date +%s)@example.com>

This is a test email to verify the webhook receiver.
If you see this in your inbox, the system is working!
EOF

echo "   Sending to local webhook..."
curl -X POST http://localhost:4000/api/email/receive-webhook \
  -H "Content-Type: application/json" \
  -d "{
    \"from\": \"test@example.com\",
    \"to\": \"contact.fffff@fotonix.co.uk\",
    \"subject\": \"Test Email - System Check\",
    \"text\": \"This is a test email to verify the webhook receiver.\",
    \"html\": \"<p>This is a test email to verify the webhook receiver.</p>\",
    \"message_id\": \"<test-$(date +%s)@example.com>\"
  }"

echo ""
echo ""
echo "=========================================="
echo "Next Steps:"
echo "=========================================="
echo "1. Send a real email from Gmail to contact.fffff@fotonix.co.uk"
echo "2. Check VPS mail logs: ssh root@51.75.78.118 'tail -f /var/log/mail.log'"
echo "3. Check webhook logs: Look for POST requests in your Node server logs"
echo "4. Verify DNS MX records: dig MX fotonix.co.uk"
echo ""
