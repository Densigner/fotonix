// Custom Email Verification System (recommended approach)
// Keep Firebase for authentication, but handle email verification on VPS

const nodemailer = require('nodemailer');
const crypto = require('crypto');

class CustomEmailVerification {
  constructor() {
    // Use your VPS SMTP server
    this.transporter = nodemailer.createTransporter({
      host: 'mail.fotonix.co.uk',
      port: 587,
      secure: false,
      auth: {
        user: 'noreply@fotonix.co.uk',
        pass: process.env.VPS_EMAIL_PASSWORD
      }
    });
  }

  // Generate verification token
  generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Send verification email via your VPS
  async sendVerificationEmail(email, token) {
    const verificationUrl = `https://fotonix.co.uk/verify-email?token=${token}`;
    
    const mailOptions = {
      from: '"Fotonix" <noreply@fotonix.co.uk>',
      to: email,
      subject: 'Verify Your Fotonix Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to Fotonix!</h2>
          <p>Please verify your email address to activate your account.</p>
          <a href="${verificationUrl}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Verify Email
          </a>
          <p>Or copy this link: ${verificationUrl}</p>
          <p>This link expires in 24 hours.</p>
        </div>
      `
    };

    return this.transporter.sendMail(mailOptions);
  }

  // Verify token and update user
  async verifyEmailToken(token) {
    // Check token in your database
    // Update user verification status
    // You control the entire flow
  }
}

// Integration with Firebase Auth
// 1. User signs up with Firebase (gets Firebase UID)
// 2. Disable Firebase email verification
// 3. Send custom verification email via your VPS
// 4. Store verification status in your database
// 5. Check verification status in your app logic