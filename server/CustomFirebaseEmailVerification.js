/**
 * Custom Email Verification System for Firebase Auth + VPS Integration
 * This replaces Firebase's email verification with your own VPS emails
 */

const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { Client } = require('pg');
const admin = require('./firebase-admin');

class CustomFirebaseEmailVerification {
  constructor() {
    // Configure your VPS SMTP
    this.transporter = nodemailer.createTransport({
      host: 'mail.fotonix.co.uk',
      port: 587,
      secure: false,
      auth: {
        user: process.env.MAIL_USERNAME || 'noreply@fotonix.co.uk',
        pass: process.env.MAIL_PASSWORD || process.env.VPS_EMAIL_PASSWORD
      }
    });
  }

  // Step 1: Store verification data after Firebase user creation
  // userType can be: 'member', 'affiliate', 'customer'
  async storeVerificationForFirebaseUser(firebaseUid, email, businessName = '', userType = 'member') {
    try {
      // Generate our own verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Store verification token in your database with user_type
      await this.storeVerificationToken(firebaseUid, email, verificationToken, expiresAt, userType);

      // Send verification email via your VPS
      await this.sendCustomVerificationEmail(email, verificationToken, businessName);

      return { 
        verificationToken,
        message: 'Verification email sent via VPS.' 
      };

    } catch (error) {
      console.error('Error storing verification:', error);
      throw error;
    }
  }

  // Step 2: Store verification token in your database
  async storeVerificationToken(firebaseUid, email, token, expiresAt, userType = 'member') {
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      await client.query(`
        INSERT INTO user_email_verification 
        (firebase_uid, email, verification_token, token_expires_at, is_verified, user_type, created_at)
        VALUES ($1, $2, $3, $4, false, $5, NOW())
        ON CONFLICT (firebase_uid) 
        DO UPDATE SET 
          verification_token = $3,
          token_expires_at = $4,
          is_verified = false,
          user_type = $5,
          updated_at = NOW()
      `, [firebaseUid, email, token, expiresAt, userType]);
    } finally {
      await client.end();
    }
  }

  // Step 3: Send verification email via your VPS
  async sendCustomVerificationEmail(email, token, businessName = '') {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    const verificationUrl = `${backendUrl}/api/auth/verify-email?token=${token}`;
    
    const mailOptions = {
      from: '"Fotonix Team" <noreply@fotonix.co.uk>',
      to: email,
      subject: 'Verify Your Fotonix Account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; }
            .footer { text-align: center; margin-top: 20px; color: #6c757d; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Welcome to Fotonix!</h1>
          </div>
          <div class="content">
            <h2>Please verify your email address</h2>
            <p>Hi ${businessName ? `from ${businessName}` : 'there'},</p>
            <p>Thank you for signing up for Fotonix! To complete your registration and start creating amazing email campaigns, please verify your email address.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: white; padding: 10px; border-radius: 4px; border: 1px solid #ddd;">
              ${verificationUrl}
            </p>
            
            <p><strong>Important:</strong> This verification link expires in 24 hours for security reasons.</p>
            
            <p>If you didn't create a Fotonix account, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2025 Fotonix - Email Marketing Made Simple</p>
            <p>This email was sent from our secure server at mail.fotonix.co.uk</p>
          </div>
        </body>
        </html>
      `
    };

    return this.transporter.sendMail(mailOptions);
  }

  // Step 4: Verify token when user clicks the link
  async verifyEmailToken(token) {
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      
      // Check if token exists and is not expired
      const result = await client.query(`
        SELECT firebase_uid, email, is_verified, token_expires_at, user_type 
        FROM user_email_verification 
        WHERE verification_token = $1
      `, [token]);

      if (result.rows.length === 0) {
        return { success: false, error: 'Invalid verification token' };
      }

      const verification = result.rows[0];
      
      if (verification.is_verified) {
        // Already verified - still return user_type for proper redirect
        return { 
          success: true, 
          message: 'Email already verified',
          firebaseUid: verification.firebase_uid,
          email: verification.email,
          userType: verification.user_type || 'member'
        };
      }

      if (new Date() > new Date(verification.token_expires_at)) {
        return { success: false, error: 'Verification token has expired' };
      }

      // Flip the real Firebase Auth flag first — every gated page in the app
      // checks auth.currentUser.emailVerified, not this Postgres table, so if
      // this fails we must not mark our own table verified (that would leave
      // the two permanently out of sync, with no way for the user to retry).
      try {
        await admin.auth().updateUser(verification.firebase_uid, {
          emailVerified: true
        });
      } catch (adminErr) {
        console.error('Failed to set emailVerified on Firebase user:', adminErr);
        return { success: false, error: 'Failed to verify email — please try again or contact support' };
      }

      // Mark as verified in your database
      await client.query(`
        UPDATE user_email_verification
        SET is_verified = true, verified_at = NOW()
        WHERE verification_token = $1
      `, [token]);

      return {
        success: true, 
        message: 'Email verified successfully',
        firebaseUid: verification.firebase_uid,
        email: verification.email,
        userType: verification.user_type || 'member'
      };

    } finally {
      await client.end();
    }
  }

  // Step 5: Check if user is verified (use in your app)
  async isUserEmailVerified(firebaseUid) {
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      const result = await client.query(`
        SELECT is_verified FROM user_email_verification 
        WHERE firebase_uid = $1
      `, [firebaseUid]);

      return result.rows.length > 0 ? result.rows[0].is_verified : false;
    } finally {
      await client.end();
    }
  }

  // Resend verification email
  async resendVerificationEmail(firebaseUid) {
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      const result = await client.query(`
        SELECT email FROM user_email_verification 
        WHERE firebase_uid = $1 AND is_verified = false
      `, [firebaseUid]);

      if (result.rows.length === 0) {
        return { success: false, error: 'User not found or already verified' };
      }

      const email = result.rows[0].email;
      const newToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Update token
      await client.query(`
        UPDATE user_email_verification 
        SET verification_token = $1, token_expires_at = $2, updated_at = NOW()
        WHERE firebase_uid = $3
      `, [newToken, expiresAt, firebaseUid]);

      // Send new email
      await this.sendCustomVerificationEmail(email, newToken);

      return { success: true, message: 'Verification email resent' };
    } finally {
      await client.end();
    }
  }
}

module.exports = CustomFirebaseEmailVerification;