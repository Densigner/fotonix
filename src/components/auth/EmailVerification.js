import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

function EmailVerification({ onBackToLogin }) {
  const { currentUser } = useAuth();
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  
  const handleResendVerification = async () => {
    if (!currentUser) {
      setResendMessage('Please sign in first to resend verification email.');
      return;
    }
    
    try {
      setResending(true);
      setResendMessage('');
      
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
      const response = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ firebaseUid: currentUser.uid }),
      });
      
      if (response.ok) {
        setResendMessage('✅ Verification email sent! Please check your inbox.');
      } else {
        const data = await response.json();
        setResendMessage(`❌ ${data.error || 'Failed to resend email'}`);
      }
    } catch (error) {
      console.error('Error resending verification:', error);
      setResendMessage('❌ Failed to resend verification email. Please try again.');
    } finally {
      setResending(false);
    }
  };
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f5f5f5',
      padding: '20px',
      paddingTop: '100px'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '520px',
        textAlign: 'center'
      }}>
        {/* Success icon */}
        <div style={{
          width: '80px',
          height: '80px',
          backgroundColor: '#28a745',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 30px'
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#2c3e50',
          marginBottom: '20px'
        }}>
          Check Your Email
        </h1>

        <p style={{
          color: '#6c757d',
          fontSize: '16px',
          marginBottom: '20px',
          lineHeight: '1.6'
        }}>
          We've sent you a verification email to confirm your account.
        </p>

        <div style={{
          backgroundColor: '#e8f5e9',
          border: '1px solid #c3e6cb',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '30px'
        }}>
          <p style={{
            color: '#2d5016',
            fontSize: '14px',
            margin: '0 0 10px 0',
            lineHeight: '1.6'
          }}>
            <strong>Next steps:</strong>
          </p>
          <ol style={{
            color: '#2d5016',
            fontSize: '14px',
            textAlign: 'left',
            margin: '0',
            paddingLeft: '20px',
            lineHeight: '1.8'
          }}>
            <li>Check your inbox (and spam folder)</li>
            <li>Click the verification link in the email</li>
            <li>Sign in to access your member dashboard</li>
          </ol>
        </div>

        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '30px'
        }}>
          <p style={{
            color: '#856404',
            fontSize: '13px',
            margin: '0',
            lineHeight: '1.6'
          }}>
            <strong>💡 Tip:</strong> The email may take a few minutes to arrive. Please check your spam folder if you don't see it.
          </p>
        </div>

        <button
          onClick={() => {
            if (onBackToLogin) onBackToLogin();
          }}
          style={{
            width: '100%',
            padding: '15px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease',
            marginBottom: '15px'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#0056b3'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#007bff'}
        >
          Go to Sign In
        </button>

        <div style={{ marginTop: '20px' }}>
          <p style={{ color: '#6c757d', fontSize: '14px', marginBottom: '10px' }}>
            Didn't receive the email?
          </p>
          <button
            onClick={handleResendVerification}
            disabled={resending}
            style={{
              background: 'none',
              border: 'none',
              color: resending ? '#6c757d' : '#007bff',
              textDecoration: 'underline',
              cursor: resending ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {resending ? 'Sending...' : 'Resend verification email'}
          </button>
          {resendMessage && (
            <p style={{
              marginTop: '10px',
              padding: '10px',
              borderRadius: '6px',
              backgroundColor: resendMessage.includes('✅') ? '#d4edda' : '#f8d7da',
              color: resendMessage.includes('✅') ? '#155724' : '#721c24',
              fontSize: '13px'
            }}>
              {resendMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmailVerification;
