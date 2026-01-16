import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../config/environment';

function EmailVerificationNotice() {
  const { user } = useAuth();
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    if (user?.uid) {
      checkVerificationStatus();
    }
  }, [user]);

  const checkVerificationStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/verification-status/${user.uid}`);
      const data = await response.json();
      setVerificationStatus(data.isVerified);
    } catch (error) {
      console.error('Error checking verification status:', error);
    }
  };

  const resendVerificationEmail = async () => {
    setResendLoading(true);
    setResendMessage('');

    try {
      const response = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ firebaseUid: user.uid }),
      });

      if (response.ok) {
        setResendMessage('✅ Verification email sent! Please check your inbox.');
      } else {
        const errorData = await response.json();
        setResendMessage(`❌ ${errorData.error || 'Failed to send verification email'}`);
      }
    } catch (error) {
      console.error('Error resending verification:', error);
      setResendMessage('❌ Failed to send verification email. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  // Don't show if user is verified or we haven't checked yet
  if (verificationStatus === true || verificationStatus === null) {
    return null;
  }

  return (
    <div style={{
      backgroundColor: '#fff3cd',
      border: '1px solid #ffeaa7',
      borderRadius: '8px',
      padding: '16px',
      margin: '16px 0',
      color: '#856404'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px', color: '#f39c12' }}>
          <path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <strong>Email Verification Required</strong>
      </div>
      
      <p style={{ margin: '0 0 12px 0' }}>
        Please check your email and click the verification link to activate your account. 
        Check your spam folder if you don't see it in your inbox.
      </p>
      
      <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#6c757d' }}>
        📧 Email sent to: <strong>{user?.email}</strong>
      </p>

      {resendMessage && (
        <div style={{ 
          padding: '8px 12px', 
          backgroundColor: resendMessage.includes('✅') ? '#d4edda' : '#f8d7da',
          border: `1px solid ${resendMessage.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '4px',
          marginBottom: '12px',
          fontSize: '14px'
        }}>
          {resendMessage}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button
          onClick={resendVerificationEmail}
          disabled={resendLoading}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: resendLoading ? 'not-allowed' : 'pointer',
            opacity: resendLoading ? 0.6 : 1,
            fontSize: '14px'
          }}
        >
          {resendLoading ? '⏳ Sending...' : '📧 Resend Email'}
        </button>
        
        <button
          onClick={checkVerificationStatus}
          style={{
            backgroundColor: 'transparent',
            color: '#007bff',
            border: '1px solid #007bff',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          🔄 Check Status
        </button>
      </div>
      
      <div style={{ marginTop: '12px', fontSize: '12px', color: '#6c757d' }}>
        💡 <strong>Tip:</strong> The verification link expires in 24 hours for security.
      </div>
    </div>
  );
}

export default EmailVerificationNotice;