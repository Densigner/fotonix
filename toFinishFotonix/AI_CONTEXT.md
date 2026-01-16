# AI Context File - Fotonix Project
## Last Updated: December 15, 2025

This file contains critical context for AI assistants working on the Fotonix project. Reference this file when resuming work or troubleshooting.

---

## 🗄️ DATABASE CONFIGURATION

### Production/Development Database (VPS)
- **Host:** `51.75.78.118` (same server as mail.fotonix.co.uk)
- **Port:** `5432`
- **Database Name:** `fotonix_dev`
- **Username:** `fotonix`
- **Password:** `fotonixpass`
- **PostgreSQL Version:** 17.7 (Ubuntu)
- **Connection String:** `postgres://fotonix:fotonixpass@51.75.78.118:5432/fotonix_dev`

### Local Docker Alternative (for offline dev)
- **Container Name:** `fotonixcouk-postgres-1`
- **Port:** `5432`
- **Credentials:** Same as above
- **Start command:** `docker start fotonixcouk-postgres-1`

### VPS Access
- **SSH:** `ssh ubuntu@51.75.78.118`
- **Provider:** OVH
- **Hostname:** `vps-603c4873.vps.ovh.net`

---

## 📊 DATABASE SCHEMA OVERVIEW

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `stores` | Store Builder shops | user_id, handle, blocks (JSONB), is_published, returns_policy (JSONB) |
| `funnels` | Marketing funnels | user_id, slug, blocks (JSONB), variant, published |
| `funnel_revisions` | Funnel version history | funnel_id, snapshot (JSONB), version |
| `user_email_verification` | Email verification tokens | firebase_uid, verification_token, is_verified, user_type |
| `member_subscriptions` | PayPal subscriptions | member_uid, paypal_subscription_id, status, trial_ends_at |
| `subscription_events` | Payment audit trail | member_uid, event_type, paypal_event_id |
| `conversion_leads` | Funnel leads | email, source, lead_score, intent_level |
| `chatbot_conversations` | AI chatbot sessions | session_id, lead_score, intent_signals |

### Email System Tables

| Table | Purpose |
|-------|---------|
| `tenants` | Multi-tenant orgs |
| `email_identities` | Verified domains/addresses |
| `smtp_credentials` | SMTP provider settings per tenant |
| `email_templates` | Versioned email templates |
| `email_messages` | Outbound email queue |
| `email_events` | Webhook events (open, click, bounce) |
| `email_suppressions` | Bounce/complaint blacklist |

### Link Tracking Tables

| Table | Purpose |
|-------|---------|
| `tracked_links` | Short URL mappings |
| `link_clicks` | Click analytics |
| `reviews_helpful` | Review helpfulness votes |

---

## 📁 MIGRATION FILES LOCATIONS

```
/sql/                           - Main schema files
  stores_schema.sql             - Store builder table
  email_verification_table.sql  - Email verification
  create_smtp_credentials_table.sql

/migrations/                    - Root migrations
  0001_create_reviews_helpful.sql
  0002_add_returns_policy_to_stores.sql

/server/migrations/             - Server-side migrations
  001_create_funnels.sql

/database/migrations/           - Full migration set
  001_create_tracked_links.sql
  001_init.sql
  002_email.sql                 - Complete email platform schema
  002_add_product_channel_meta.sql
  003_create_subscriptions.sql  - PayPal subscriptions & leads
  003_inbound_email.sql
  004_advanced_email_platform.sql
  005_contact_management.sql
  006_*.sql                     - Business email variations
  007_email_messages.sql
  008_email_receiving.sql
```

---

## 🔧 SERVER CONFIGURATION

### Architecture
- **Frontend**: Hosted externally (Vercel/Netlify/Firebase Hosting)
- **API Backend**: VPS at 51.75.78.118 (api.fotonix.co.uk)
- **Database**: PostgreSQL on VPS

### Ports (VPS)
| Service | Port | Endpoints |
|---------|------|-----------|
| fotonix-stores | 3001 | `/api/stores/*`, `/api/member/products` |
| fotonix-email-api | 4000 | `/api/email/*` |
| fotonix-chatbot | 5002 | `/api/chatbot/*` |
| PostgreSQL | 5432 | Database |

### Nginx Proxy (api.fotonix.co.uk)
All API traffic goes through nginx on port 80/443:
- `/api/stores/*` → localhost:3001
- `/api/member/*` → localhost:3001
- `/api/email/*` → localhost:4000
- `/api/chatbot/*` → localhost:5002

### VPS Services (systemd)
```bash
# Check status
sudo systemctl status fotonix-stores
sudo systemctl status fotonix-email-api
sudo systemctl status fotonix-chatbot

# Restart services
sudo systemctl restart fotonix-stores
sudo systemctl restart fotonix-email-api
sudo systemctl restart fotonix-chatbot

# View logs
sudo journalctl -u fotonix-stores -f
```

### Key Environment Variables
**Frontend (.env.production):**
```
REACT_APP_API_URL=https://api.fotonix.co.uk
```

**VPS (.env in /opt/fotonix-email-api):**
```
DATABASE_URL=postgres://fotonix:fotonixpass@localhost:5432/fotonix_dev
OPENAI_API_KEY=sk-proj-...
NODE_ENV=production
```

### DNS Configuration Required
Create A record:
- **Host**: `api`
- **Points to**: `51.75.78.118`
- **TTL**: 3600

### SSL Certificate
After DNS propagates, run on VPS:
```bash
sudo certbot --nginx -d api.fotonix.co.uk
```

---

## 🤖 CHATBOT SYSTEM

### Overview
The AI chatbot uses OpenAI (gpt-4o-mini) for conversations. It runs on the VPS for always-on availability.

### Files
| File | Purpose |
|------|---------|
| `/server/chatbotServer.js` | Standalone VPS chatbot server |
| `/server/routes/marketing/chatbot.js` | Lead capture, analytics, interaction tracking |
| `/src/components/marketing/ConversionChatbot.jsx` | Frontend chatbot UI |
| `/src/server.js` | Contains original chatbot endpoint (backup) |

### VPS Deployment
```bash
# SSH to VPS
ssh ubuntu@51.75.78.118

# Upload chatbot server
scp server/chatbotServer.js ubuntu@51.75.78.118:~/fotonix-api/

# Install dependencies
cd ~/fotonix-api
npm install express cors openai dotenv

# Create .env with OpenAI key
echo "OPENAI_API_KEY=your-key-here" > .env

# Run (or set up systemd service)
node chatbotServer.js

# Open firewall
sudo ufw allow 5002/tcp
```

### Systemd Service (for auto-restart)
Create `/etc/systemd/system/fotonix-chatbot.service`:
```ini
[Unit]
Description=Fotonix Chatbot Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/fotonix-api
ExecStart=/usr/bin/node chatbotServer.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable fotonix-chatbot
sudo systemctl start fotonix-chatbot
```

### Endpoints
- `POST /api/chatbot/message` - Main AI conversation
- `GET /health` - Health check

---

## 🔐 AUTHENTICATION FLOW

1. **Firebase Auth** - Handles user registration/login
2. **Email Verification** - Custom PostgreSQL table (`user_email_verification`)
   - Supports `user_type` field: `'member'`, `'affiliate'`, `'customer'`
   - After verification, redirects based on user type:
     - Members → `#member-dashboard?verified=true&message=...`
     - Affiliates → `#affiliate-dashboard?verified=true&message=...`
     - Customers → `#home?verified=true&message=...`
3. **JWT tokens** via Firebase for API auth
4. **PayPal subscriptions** for premium features

### Email Verification Files
| File | Purpose |
|------|---------|
| `/server/CustomFirebaseEmailVerification.js` | Core verification logic (token gen, email send, verify) |
| `/server/routes/auth/custom-auth.js` | API endpoints: `/api/auth/send-custom-verification`, `/api/auth/verify-email` |
| `/sql/email_verification_table.sql` | Database schema with `user_type` column |
| `/src/components/auth/Signup.js` | Member signup (userType='member') |
| `/src/components/affiliate/AffiliateSignupPage.js` | Affiliate signup (userType='affiliate') |

---

## ⚠️ COMMON ISSUES & FIXES

### "ETIMEDOUT 51.75.78.118:5432"
- VPS PostgreSQL not accessible
- Check: `sudo ufw status | grep 5432`
- Fix: `sudo ufw allow 5432/tcp` on VPS

### "EADDRINUSE port 4000/5432"
```powershell
# Kill process on port
Get-Process -Id (Get-NetTCPConnection -LocalPort 4000).OwningProcess | Stop-Process -Force
```

### Docker container port conflict
```powershell
# List all containers
docker ps -a

# Remove conflicting containers
docker rm <container_name>
```

### SSH to VPS times out
- Check if VPS is running in OVH dashboard
- Use OVH console/VNC if SSH blocked

---

## 📝 RECENT CHANGES (December 2025)

1. Added `returns_policy` JSONB column to `stores` table
2. Consolidated Docker containers to single `fotonixcouk-postgres-1`
3. Configured VPS PostgreSQL for remote access (listen_addresses='*', pg_hba.conf updated)
4. Updated .env to use VPS database instead of local Docker
5. Deployed chatbot as systemd service on VPS (port 5002) - auto-restarts
6. Added Reddit Community Discovery feature to FeaturesShowcase
7. **Email Verification Redirect System:**
   - Added `user_type` column to `user_email_verification` table
   - Verification now redirects based on user type (member/affiliate/customer)
   - App.js parses `?verified=true&message=...` from hash and shows success banner
   - Banner auto-dismisses after 8 seconds
8. **Store Builder Improvements:**
   - Added onboarding modal for new store creation
   - Renamed "Shop Builder" to "Members Dashboard" in MembersDashboard.jsx
   - Removed UK law references from returns policy (just marked as "Required")
   - Store handle now properly locked after saving
   - Clear stale localStorage when creating new store

---

## 🎯 KEY FILE LOCATIONS

| Purpose | Path |
|---------|------|
| Main .env | `/.env` |
| Local dev overrides | `/.env.local` |
| Firebase config | `/server/serviceAccountKey.json` |
| Server entry | `/server/index.js` |
| Auth routes | `/server/routes/` |
| React app | `/src/App.js` |
| Store Builder | `/src/components/StoreBuilder.js` |
| Email Verification Gate | `/src/components/auth/EmailVerificationGate.jsx` |

---

## 🚀 TO INITIALIZE DATABASE ON FRESH VPS

```sql
-- Run as postgres user
sudo -u postgres psql

CREATE USER fotonix WITH PASSWORD 'fotonixpass';
CREATE DATABASE fotonix_dev OWNER fotonix;
GRANT ALL PRIVILEGES ON DATABASE fotonix_dev TO fotonix;
ALTER USER fotonix CREATEDB;
\q
```

Then run migrations:
```bash
# From project root, connect and run each SQL file
psql -h 51.75.78.118 -U fotonix -d fotonix_dev -f sql/stores_schema.sql
psql -h 51.75.78.118 -U fotonix -d fotonix_dev -f database/migrations/002_email.sql
psql -h 51.75.78.118 -U fotonix -d fotonix_dev -f database/migrations/003_create_subscriptions.sql
# ... etc
```

---

## 📌 NOTES FOR AI CONTINUITY

- Always check `.env` DATABASE_URL before debugging connection issues
- The VPS hosts BOTH mail server AND PostgreSQL on same IP
- Firebase handles auth, PostgreSQL handles app data
- Store Builder uses JSONB `blocks` column for flexible layouts
- Multi-tenant email system uses `tenant_id` foreign keys throughout
