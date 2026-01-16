import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Mail, AlertCircle, RefreshCw } from 'lucide-react';

// Use environment variable for API URL, fallback for development
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

/**
 * EmailVerificationGate Component
 * 
 * Checks if the user's email is verified before allowing access.
 * Shows verification prompt if email is not yet verified.
 * 
 * Props:
 * - children: Component to render if email is verified
 */
export default function EmailVerificationGate({ children }) {
  const { currentUser } = useAuth();
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    if (currentUser) {
      checkVerificationStatus();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  const checkVerificationStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/auth/verification-status/${currentUser.uid}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to check verification status');
      }

      const data = await response.json();
      setVerificationStatus(data);
    } catch (error) {
      console.error('Error checking verification:', error);
      // If check fails, assume not verified
      setVerificationStatus({ isVerified: false });
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      setResending(true);
      setResendMessage('');
      
      const response = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          firebaseUid: currentUser.uid
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResendMessage('✅ Verification email sent! Please check your inbox.');
      } else {
        setResendMessage(`❌ ${data.error || 'Failed to resend email'}`);
      }
    } catch (error) {
      console.error('Error resending verification:', error);
      setResendMessage('❌ Failed to resend verification email');
    } finally {
      setResending(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #dee2e6',
            borderTop: '4px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }} />
          <p style={{ color: '#6c757d', margin: 0 }}>Checking verification status...</p>
        </div>
      </div>
    );
  }

  // If verified, show children (member dashboard)
  if (verificationStatus?.isVerified) {
    return <>{children}</>;
  }

  // Show verification required screen
  return (
    <>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
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
          {/* Email icon */}
          <div style={{
            width: '80px',
            height: '80px',
            backgroundColor: '#ffc107',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 30px'
          }}>
            <Mail size={40} color="white" />
          </div>

          <h1 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#2c3e50',
            marginBottom: '20px'
          }}>
            Email Verification Required
          </h1>

          <p style={{
            color: '#6c757d',
            fontSize: '16px',
            marginBottom: '20px',
            lineHeight: '1.6'
          }}>
            To access your member dashboard and all features, please verify your email address.
          </p>

          <div style={{
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '30px',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <AlertCircle size={24} color="#856404" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{
                  color: '#856404',
                  fontSize: '14px',
                  margin: '0 0 10px 0',
                  lineHeight: '1.6',
                  fontWeight: '600'
                }}>
                  We sent a verification email to:
                </p>
                <p style={{
                  color: '#856404',
                  fontSize: '14px',
                  margin: '0',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all'
                }}>
                  {currentUser?.email}
                </p>
              </div>
            </div>
          </div>

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
              <strong>To verify your email:</strong>
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
              <li>You'll be automatically redirected back here</li>
            </ol>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <button
              onClick={handleResendVerification}
              disabled={resending}
              style={{
                width: '100%',
                padding: '15px',
                backgroundColor: resending ? '#6c757d' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: resending ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
            >
              {resending ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid white',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Sending...
                </>
              ) : (
                <>
                  <RefreshCw size={20} />
                  Resend Verification Email
                </>
              )}
            </button>
          </div>

          {resendMessage && (
            <div style={{
              padding: '12px',
              borderRadius: '6px',
              backgroundColor: resendMessage.includes('✅') ? '#d4edda' : '#f8d7da',
              color: resendMessage.includes('✅') ? '#155724' : '#721c24',
              border: `1px solid ${resendMessage.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`,
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              {resendMessage}
            </div>
          )}

          <button
            onClick={checkVerificationStatus}
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: 'white',
              color: '#007bff',
              border: '2px solid #007bff',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = '#007bff';
              e.target.style.color = 'white';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = 'white';
              e.target.style.color = '#007bff';
            }}
          >
            I've Verified My Email - Check Again
          </button>

          <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #dee2e6' }}>
            <p style={{ color: '#6c757d', fontSize: '13px', margin: 0 }}>
              Need help? Contact us at <a href="mailto:support@fotonix.co.uk" style={{ color: '#007bff', textDecoration: 'none' }}>support@fotonix.co.uk</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
