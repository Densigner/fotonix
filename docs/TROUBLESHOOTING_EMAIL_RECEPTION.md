To test if emails are being received:

1. **Send a test email from Gmail to: contact.fffff@fotonix.co.uk**

2. **Check VPS mail logs** (run this in a terminal):
   ```bash
   ssh root@51.75.78.118 "tail -50 /var/log/mail.log | grep -i fotonix"
   ```

3. **Check if webhook is being called** - Look at your Node server terminal for:
   - `POST /api/email/receive-webhook` requests
   - Any errors in webhook processing

4. **Verify MX records are set** (run this):
   ```bash
   nslookup -type=MX fotonix.co.uk
   ```
   Should show: `mail.fotonix.co.uk` with priority 10

5. **Common issues:**
   - MX records not set → Emails won't reach VPS
   - Postfix not configured → Emails reach VPS but aren't forwarded
   - Webhook endpoint down → Emails forwarded but not saved
   - Wrong database → Emails saved to wrong tenant

**Quick test:** Run this to simulate receiving an email locally:
```bash
curl -X POST http://localhost:4000/api/email/receive-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "from": "yourname@gmail.com",
    "to": "contact.fffff@fotonix.co.uk",
    "subject": "Real test from curl",
    "text": "This is a real test message body",
    "html": "<p>This is a real test message body</p>",
    "message_id": "<test-'$(date +%s)'@gmail.com>"
  }'
```

Then refresh your inbox - if this appears, the webhook works and the issue is with VPS/Postfix.
