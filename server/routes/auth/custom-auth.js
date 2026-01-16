const express = require('express');
const CustomFirebaseEmailVerification = require('../../CustomFirebaseEmailVerification');
const router = express.Router();

const emailVerification = new CustomFirebaseEmailVerification();

// Test route
router.get('/api/auth/test', (req, res) => {
  res.json({ message: 'Custom auth routes are working!' });
});

// Store verification data after Firebase signup (called from frontend)
router.post('/api/auth/send-custom-verification', async (req, res) => {
  try {
    const { firebaseUid, email, businessName, userType } = req.body;

    if (!firebaseUid || !email) {
      return res.status(400).json({ error: 'Firebase UID and email are required' });
    }

    // Validate userType - default to 'member' if not provided
    const validUserTypes = ['member', 'affiliate', 'customer'];
    const sanitizedUserType = validUserTypes.includes(userType) ? userType : 'member';

    console.log(`📧 Sending custom verification email via VPS for ${sanitizedUserType}...`);

    // Store verification data and send email (with userType)
    const result = await emailVerification.storeVerificationForFirebaseUser(
      firebaseUid, 
      email, 
      businessName,
      sanitizedUserType
    );

    res.json({
      success: true,
      message: 'Verification email sent successfully via VPS',
      verificationToken: result.verificationToken,
      userType: sanitizedUserType
    });

  } catch (error) {
    console.error('Send verification error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to send verification email' 
    });
  }
});

// Verify email endpoint (when user clicks link)
router.get('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const result = await emailVerification.verifyEmailToken(token);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    
    if (result.success) {
      // Determine redirect based on user type
      const userType = result.userType || 'member';
      const successMessage = encodeURIComponent('Email verified successfully! You can now access all features.');
      
      let redirectPath;
      switch (userType) {
        case 'affiliate':
          redirectPath = `#affiliate-dashboard?verified=true&message=${successMessage}`;
          break;
        case 'customer':
          // Customers go back to home or their original location
          redirectPath = `#home?verified=true&message=${successMessage}`;
          break;
        case 'member':
        default:
          redirectPath = `#member-dashboard?verified=true&message=${successMessage}`;
          break;
      }
      
      console.log(`✅ Email verified for ${userType}, redirecting to ${redirectPath}`);
      res.redirect(`${frontendUrl}/${redirectPath}`);
    } else {
      res.redirect(`${frontendUrl}/#email-verification?error=${encodeURIComponent(result.error)}`);
    }

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

// Check verification status
router.get('/api/auth/verification-status/:firebaseUid', async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    const isVerified = await emailVerification.isUserEmailVerified(firebaseUid);
    
    res.json({ 
      isVerified,
      message: isVerified ? 'Email is verified' : 'Email not yet verified' 
    });
    
  } catch (error) {
    console.error('Check verification error:', error);
    res.status(500).json({ error: 'Failed to check verification status' });
  }
});

// Resend verification email
router.post('/api/auth/resend-verification', async (req, res) => {
  try {
    const { firebaseUid } = req.body;
    
    if (!firebaseUid) {
      return res.status(400).json({ error: 'Firebase UID is required' });
    }

    const result = await emailVerification.resendVerificationEmail(firebaseUid);
    
    if (result.success) {
      res.json({ message: 'Verification email resent successfully' });
    } else {
      res.status(400).json({ error: result.error });
    }

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

module.exports = router;