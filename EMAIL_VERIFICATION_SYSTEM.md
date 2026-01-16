# Email Verification System - Complete Setup

## Overview
Secure token-based email verification system using your VPS mail server at `mail.fotonix.co.uk`.

## How It Works

### 1. User Signs Up
- User completes signup form (`Signup.js`)
- Firebase Auth creates account
- Backend generates verification token (32-byte hex)
- VPS sends branded verification email with link
- User sees `EmailVerification.js` screen with instructions

### 2. Email Verification Link
**Link Format:**
```
http://localhost:4000/api/auth/verify-email?token=abc123...
```

**Production:**
```
https://fotonix.co.uk/api/auth/verify-email?token=abc123...
```

### 3. User Clicks Link
- Backend verifies token (checks expiry, validity)
- Marks user as verified in database
- Redirects to: `http://localhost:3001/#member-dashboard?verified=true`
- User sees success message and can access dashboard

### 4. Access Control
- Member dashboard wrapped in `<EmailVerificationGate>`
- Checks verification status via API call
- Shows verification screen if not verified
- Allows "Resend Email" option

## Database Table

```sql
CREATE TABLE IF NOT EXISTS user_email_verification (
  id SERIAL PRIMARY KEY,
  firebase_uid VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  verification_token VARCHAR(255) UNIQUE NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Endpoints

### POST `/api/auth/send-custom-verification`
Send verification email after signup.

**Request:**
```json
{
  "firebaseUid": "abc123...",
  "email": "user@example.com",
  "businessName": "My Business"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification email sent successfully via VPS",
  "verificationToken": "abc123..."
}
```

### GET `/api/auth/verify-email?token=abc123`
Verify email when user clicks link.

**Success:** Redirects to `/#member-dashboard?verified=true`
**Error:** Redirects to `/#email-verification?error=Invalid token`

### GET `/api/auth/verification-status/:firebaseUid`
Check if user's email is verified.

**Response:**
```json
{
  "isVerified": true,
  "message": "Email is verified"
}
```

### POST `/api/auth/resend-verification`
Resend verification email.

**Request:**
```json
{
  "firebaseUid": "abc123..."
}
```

## Email Template

**From:** Fotonix Team <noreply@fotonix.co.uk>
**Subject:** Verify Your Fotonix Account

**Content:**
- Welcome message with business name
- Clear "Verify Email Address" button
- Backup text link
- 24-hour expiry notice
- Professional branding

## Security Features

✅ **Secure tokens:** 32-byte cryptographically random hex strings
✅ **Token expiry:** 24-hour validity period
✅ **One-time use:** Token invalidated after verification
✅ **Database-backed:** All verification data stored in PostgreSQL
✅ **HTTPS ready:** Works with SSL in production
✅ **Rate limiting ready:** Can add rate limiting to resend endpoint

## Environment Variables Required

```env
# Backend URL (where API lives)
BACKEND_URL=http://localhost:4000

# Frontend URL (where React app lives)
FRONTEND_URL=http://localhost:3001

# VPS Email Configuration
MAIL_HOST=mail.fotonix.co.uk
MAIL_PORT=587
MAIL_USERNAME=noreply@fotonix.co.uk
MAIL_PASSWORD=0eGLVjWLgfvH
VPS_EMAIL_PASSWORD=0eGLVjWLgfvH
MAIL_FROM_NAME=Fotonix
MAIL_FROM_ADDRESS=noreply@fotonix.co.uk
MAIL_USE_TLS=false
MAIL_USE_STARTTLS=true

# Database
DATABASE_URL=postgres://fotonix:fotonixpass@51.75.78.118:5432/fotonix_dev
```

## User Flow

```
1. User signs up
   ↓
2. Signup.js creates Firebase account
   ↓
3. POST /api/auth/send-custom-verification
   ↓
4. VPS sends email with verification link
   ↓
5. User sees EmailVerification.js screen
   ↓
6. User clicks link in email
   ↓
7. GET /api/auth/verify-email?token=xxx
   ↓
8. Backend verifies token & marks verified
   ↓
9. Redirect to /#member-dashboard?verified=true
   ↓
10. EmailVerificationGate checks status
   ↓
11. User accesses member dashboard ✅
```

## Files Modified/Created

### Created:
- `src/components/auth/EmailVerification.js` - Post-signup screen
- `src/components/auth/EmailVerificationGate.jsx` - Access control wrapper
- `server/CustomFirebaseEmailVerification.js` - Core verification logic
- `server/routes/auth/custom-auth.js` - API endpoints

### Modified:
- `src/App.js` - Added verification gate to member dashboard
- `.env` - Added FRONTEND_URL, BACKEND_URL, VPS_EMAIL_PASSWORD
- `server/routes/member/member.js` - Added store name check (separate feature)

## Testing Checklist

- [ ] Sign up new user → receives email
- [ ] Click verification link → redirects to dashboard
- [ ] Try accessing dashboard before verification → blocked
- [ ] Resend verification email → works
- [ ] Expired token → shows error
- [ ] Invalid token → shows error
- [ ] Already verified → shows message

## Production Deployment

### Update environment variables:
```env
BACKEND_URL=https://fotonix.co.uk
FRONTEND_URL=https://fotonix.co.uk
```

### Ensure database table exists:
```bash
node scripts/run-email-migration.js
```

### Test email delivery:
```bash
node tests/email/test-custom-verification.js
```

## Troubleshooting

**Email not sending?**
- Check VPS credentials in `.env`
- Verify `MAIL_PASSWORD` or `VPS_EMAIL_PASSWORD`
- Test SMTP connection: `telnet mail.fotonix.co.uk 587`

**Token not working?**
- Check database: `SELECT * FROM user_email_verification WHERE firebase_uid = 'xxx'`
- Verify token hasn't expired
- Ensure `BACKEND_URL` matches in email template

**Verification gate not working?**
- Check browser console for API errors
- Verify Firebase UID matches database record
- Test endpoint directly: `GET http://localhost:4000/api/auth/verification-status/[uid]`

## Future Enhancements

- [ ] Add email template customization
- [ ] Implement rate limiting on resend
- [ ] Add verification analytics
- [ ] Support custom verification redirect URLs
- [ ] Add SMS verification option
- [ ] Implement account recovery flow
