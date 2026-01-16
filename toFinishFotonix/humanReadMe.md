# Fotonix Project - Human README
## Last Updated: December 15, 2025

---

## 🎯 What is Fotonix?

Fotonix is a platform for creators and businesses featuring:
- **Store Builder** - Create custom online shops
- **Funnel Builder** - Marketing/conversion funnels
- **Email Platform** - Multi-tenant email sending & tracking
- **AI Chatbot** - Conversion optimization assistant
- **Subscription System** - PayPal-powered memberships

---

## 🏗️ Architecture

```
┌─────────────────────┐         ┌──────────────────────────────┐
│  Frontend (React)   │  HTTPS  │   VPS (51.75.78.118)         │
│  Hosted on Vercel/  │ ──────► │   api.fotonix.co.uk          │
│  Netlify/Firebase   │         │                              │
│  fotonix.co.uk      │         │  ┌─────────────────────────┐ │
└─────────────────────┘         │  │  nginx (80/443)         │ │
                                │  │  Routes to services:    │ │
                                │  │  /api/stores → :3001    │ │
                                │  │  /api/member → :3001    │ │
                                │  │  /api/email  → :4000    │ │
                                │  │  /api/chatbot → :5002   │ │
                                │  └─────────────────────────┘ │
                                │                              │
                                │  Services:                   │
                                │  • fotonix-stores (:3001)    │
                                │  • fotonix-email-api (:4000) │
                                │  • fotonix-chatbot (:5002)   │
                                │  • PostgreSQL (:5432)        │
                                └──────────────────────────────┘
```

---

## 🚀 Deployment

### Frontend (Build & Deploy)
```powershell
cd C:\Users\joshm\Desktop\fotonix.co.uk\fotonix.co.uk
npm run build
```
This creates a `build/` folder. Upload this to your hosting provider:
- **Vercel**: Connect GitHub repo or drag-drop build folder
- **Netlify**: Drag-drop build folder or connect repo
- **Firebase Hosting**: `firebase deploy --only hosting`

### Backend (VPS Services)
VPS services should already be running. To check/manage:

```bash
# SSH to VPS
ssh ubuntu@51.75.78.118

# Check all services
sudo systemctl status fotonix-stores fotonix-email-api fotonix-chatbot

# Restart a service
sudo systemctl restart fotonix-stores

# View logs
sudo journalctl -u fotonix-stores -f
```

---

## 🌐 DNS Setup Required

Add this A record in your domain registrar:
| Type | Host | Points To |
|------|------|-----------|
| A | api | 51.75.78.118 |

After DNS propagates (~5-30 min), enable SSL on VPS:
```bash
ssh ubuntu@51.75.78.118
sudo certbot --nginx -d api.fotonix.co.uk
```

---

## 🔑 Important Credentials

### Database (PostgreSQL on VPS)
| Field | Value |
|-------|-------|
| Host | 51.75.78.118 |
| Port | 5432 |
| Database | fotonix_dev |
| Username | fotonix |
| Password | fotonixpass |

### VPS Server Access
```
ssh ubuntu@51.75.78.118
```

### Mail Server
| Field | Value |
|-------|-------|
| Host | mail.fotonix.co.uk |
| Port | 587 |
| Username | noreply@fotonix.co.uk |
| Password | 0eGLVjWLgfvH |

---

## 📁 Project Structure

```
fotonix.co.uk/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   ├── StoreBuilder.js # Shop builder
│   │   └── auth/           # Login/registration
│   └── App.js              # Main app
├── server/                 # Express backend
│   ├── index.js            # Server entry point
│   ├── routes/             # API routes
│   └── migrations/         # DB migrations
├── database/               # More migrations
├── sql/                    # Schema files
├── .env                    # Environment config
└── toFinishFotonix/        # Documentation
```

---

## 🗄️ Database Tables

| Table | What it stores |
|-------|----------------|
| `stores` | Shop configurations (blocks, themes, policies) |
| `funnels` | Marketing funnel layouts |
| `member_subscriptions` | PayPal subscription status |
| `user_email_verification` | Email verification tokens + user type |
| `email_messages` | Outbound emails queue |
| `conversion_leads` | Captured leads from funnels |

---

## 📧 Email Verification System

When users sign up, they receive a verification email. After clicking the link, they're redirected based on their user type:

| User Type | Redirect Destination |
|-----------|---------------------|
| member | `#member-dashboard` |
| affiliate | `#affiliate-dashboard` |
| customer | `#home` |

A green success banner appears at the top of the page showing "Email verified successfully!"

**Key Files:**
- `server/CustomFirebaseEmailVerification.js` - Sends verification emails
- `server/routes/auth/custom-auth.js` - Handles `/api/auth/verify-email` endpoint
- `sql/email_verification_table.sql` - Database schema

**To add the user_type column (if missing):**
```sql
ALTER TABLE user_email_verification 
ADD COLUMN IF NOT EXISTS user_type VARCHAR(50) DEFAULT 'member';
```

---

## ⚙️ Common Tasks

### Check if database is accessible
```powershell
Test-NetConnection -ComputerName 51.75.78.118 -Port 5432
```

### Kill a process using a port
```powershell
# For port 4000 (backend)
Get-Process -Id (Get-NetTCPConnection -LocalPort 4000).OwningProcess | Stop-Process -Force

# For port 3001 (frontend)
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process -Force
```

### Connect to VPS database directly
```powershell
# Using psql (if installed)
psql -h 51.75.78.118 -U fotonix -d fotonix_dev
```

### View Docker containers
```powershell
docker ps -a
```

---

## 🐛 Troubleshooting

### "Connection refused" or "ETIMEDOUT" database errors
1. Check VPS is running (OVH dashboard)
2. SSH into VPS: `ssh ubuntu@51.75.78.118`
3. Check PostgreSQL: `sudo systemctl status postgresql`
4. Check firewall: `sudo ufw status | grep 5432`

### "Port already in use" errors
Kill the process using that port (see Common Tasks above)

### Can't SSH into VPS
Use OVH's web console/VNC to access the server directly

---

## 📧 Email System

Fotonix has a built-in email platform:
- Sends via SMTP through mail.fotonix.co.uk
- Tracks opens, clicks, bounces
- Multi-tenant (multiple users can have their own email settings)
- Templates are versioned

---

## 💳 Subscriptions

- Uses PayPal Subscriptions API
- Sandbox mode for testing (PAYPAL_ENV=sandbox in .env)
- Trial period supported
- Webhook events stored for audit trail

---

## 🏪 Store Builder

Each store has:
- **handle** - URL slug (unique)
- **blocks** - JSON array of page components
- **theme** - Colors, fonts, etc.
- **returns_policy** - Required before publishing (legal requirement)

---

## 📝 Notes

1. The VPS (51.75.78.118) hosts both the mail server AND PostgreSQL database
2. Firebase handles user authentication, PostgreSQL stores app data
3. All migrations are in `/database/migrations/` and `/server/migrations/`
4. Environment variables are in `.env` (don't commit this to git!)

---

## 🆘 Need Help?

Check `toFinishFotonix/AI_CONTEXT.md` for detailed technical info that AI assistants can use to help debug issues.


//////////////////////


Production pages
Product page mirror now working AI, et al
Login
Sign up both on the generator and here

