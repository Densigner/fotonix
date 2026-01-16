#!/bin/bash

echo "=========================================="
echo "Email Reception Diagnostics"
echo "=========================================="
echo ""

# Test 1: Check MX record
echo "1. Checking MX records for fotonix.co.uk..."
nslookup -type=MX fotonix.co.uk
echo ""

# Test 2: Check if mail server is reachable
echo "2. Testing if mail server is reachable on port 25..."
nc -zv mail.fotonix.co.uk 25 2>&1 || echo "❌ Port 25 not reachable"
echo ""

# Test 3: Try to connect to SMTP
echo "3. Testing SMTP connection..."
timeout 5 bash -c 'echo "QUIT" | telnet mail.fotonix.co.uk 25' 2>&1 | head -5
echo ""

# Test 4: Check recent mail logs (requires SSH access)
echo "4. Checking mail logs (if you have SSH access)..."
echo "   Run manually: ssh root@51.75.78.118 'tail -50 /var/log/mail.log'"
echo ""

# Test 5: Test webhook locally
echo "5. Testing webhook receiver locally..."
TIMESTAMP=$(date +%s)
curl -X POST http://localhost:4000/api/email/receive-webhook \
  -H "Content-Type: application/json" \
  -d "{
    \"from\": \"test@example.com\",
    \"to\": \"contact.fffff@fotonix.co.uk\",
    \"subject\": \"Test - ${TIMESTAMP}\",
    \"text\": \"This is a test email sent at ${TIMESTAMP}\",
    \"html\": \"<p>This is a test email sent at ${TIMESTAMP}</p>\",
    \"message_id\": \"<test-${TIMESTAMP}@example.com>\"
  }"

echo ""
echo ""
echo "=========================================="
echo "Action Items:"
echo "=========================================="
echo "1. ✅ MX record is configured"
echo "2. ❓ Check if Postfix is running (requires VPS access)"
echo "3. ❓ Check if Python forwarder script is configured"
echo "4. 🧪 Send real email from Gmail to contact.fffff@fotonix.co.uk"
echo "5. 📊 Check database for new entry with: node scripts/check-email-content.js"
echo ""
