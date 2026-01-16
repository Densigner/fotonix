import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../config/environment';

function Signup({ onSignup, onSwitchToLogin }) {
  const { signup, signInWithGoogle } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    address: '',
    city: '',
    postalCode: '',
    country: 'United Kingdom',
    businessName: '',
    storeName: '',
    customEmail: ''
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [checkingStoreName, setCheckingStoreName] = useState(false);
  const [storeNameAvailable, setStoreNameAvailable] = useState(null);
  const [storeNameDebounceTimer, setStoreNameDebounceTimer] = useState(null);

  const passwordStrength = (pwd = '') => {
    if (!pwd) return 0;
    if (pwd.length > 10) return 3;
    if (pwd.length > 5) return 2;
    return 1;
  };

  const strengthLevel = passwordStrength(formData.password);

  const checkStoreNameAvailability = async (storeName) => {
    if (!storeName || storeName.length < 2) {
      setStoreNameAvailable(null);
      return;
    }

    try {
      setCheckingStoreName(true);
      const response = await fetch(`${API_URL}/api/member/check-store-name?storeName=${encodeURIComponent(storeName)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (response.ok) {
        setStoreNameAvailable(data.available);
        if (!data.available) {
          setErrors(prev => ({ ...prev, storeName: 'Store name is already taken' }));
        } else {
          setErrors(prev => {
            const next = { ...prev };
            if (next.storeName === 'Store name is already taken') {
              delete next.storeName;
            }
            return next;
          });
        }
      }
    } catch (error) {
      console.error('Error checking store name:', error);
      setStoreNameAvailable(null);
    } finally {
      setCheckingStoreName(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Normalize store name and custom email: convert spaces to hyphens, lowercase, and remove invalid chars
    let normalizedValue = value;
    if (name === 'storeName' || name === 'customEmail') {
      normalizedValue = value
        .toLowerCase()
        .replace(/\s+/g, '-') // Convert spaces to hyphens
        .replace(/[^a-z0-9_-]/g, ''); // Remove invalid characters
    }
    
    const nextForm = { ...formData, [name]: normalizedValue };
    setFormData(nextForm);

    // Debounce store name availability check
    if (name === 'storeName') {
      // Clear previous timer
      if (storeNameDebounceTimer) {
        clearTimeout(storeNameDebounceTimer);
      }
      
      // Reset availability state while typing
      setStoreNameAvailable(null);
      
      // Set new timer to check after 800ms of no typing
      const timer = setTimeout(() => {
        checkStoreNameAvailability(normalizedValue);
      }, 800);
      
      setStoreNameDebounceTimer(timer);
    }

    // live validation for email, password, confirm
    setErrors(prev => {
      const next = { ...prev };

      if (name === 'username') {
        if (!value) next.username = 'Username is required';
        else if (value.length < 3) next.username = 'Username must be at least 3 characters';
        else if (!/^[a-zA-Z0-9_]+$/.test(value)) next.username = 'Username can only contain letters, numbers, and underscores';
        else delete next.username;
      }

      if (name === 'businessName') {
        if (!value) next.businessName = 'Business name is required';
        else if (value.length < 2) next.businessName = 'Business name must be at least 2 characters';
        else delete next.businessName;
      }

      if (name === 'storeName') {
        if (!value) next.storeName = 'Store name is required';
        else if (value.length < 2) next.storeName = 'Store name must be at least 2 characters';
        else if (!/^[a-zA-Z0-9_-]+$/.test(normalizedValue)) next.storeName = 'Store name can only contain letters, numbers, hyphens, and underscores';
        else if (storeNameAvailable === false) next.storeName = 'Store name is already taken';
        else delete next.storeName;
      }

      if (name === 'customEmail') {
        if (!value) next.customEmail = 'Custom email is required';
        else if (value.length < 2) next.customEmail = 'Custom email must be at least 2 characters';
        else delete next.customEmail;
      }

      if (name === 'email') {
        if (!value) next.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(value)) next.email = 'Email is invalid';
        else {
          // Check if the email conflicts with business emails
          const businessEmails = [
            `no_reply.${nextForm.storeName}@fotonix.co.uk`,
            `${nextForm.customEmail}.${nextForm.storeName}@fotonix.co.uk`,
            `contact.${nextForm.storeName}@fotonix.co.uk`,
           
          ].filter(email => email.includes(nextForm.storeName)); // Only check if storeName exists

          if (businessEmails.includes(value)) {
            next.email = 'Cannot use a business email address as your account email';
          } else {
            delete next.email;
          }
        }
      }

      if (name === 'password') {
        if (!value) next.password = 'Password is required';
        else if (value.length < 6) next.password = 'Password must be at least 6 characters';
        else delete next.password;

        // re-check confirm
        if (nextForm.confirmPassword && nextForm.confirmPassword !== value) next.confirmPassword = 'Passwords do not match';
        else if (nextForm.confirmPassword) delete next.confirmPassword;
      }

      if (name === 'confirmPassword') {
        if (!value) next.confirmPassword = 'Please confirm your password';
        else if (value !== nextForm.password) next.confirmPassword = 'Passwords do not match';
        else delete next.confirmPassword;
      }

      return next;
    });
  };

  const validateForm = () => {
    const next = {};
    if (!formData.username) next.username = 'Username is required';
    else if (formData.username.length < 3) next.username = 'Username must be at least 3 characters';
    else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) next.username = 'Username can only contain letters, numbers, and underscores';

    if (!formData.email) next.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) next.email = 'Email is invalid';

    if (!formData.password) next.password = 'Password is required';
    else if (formData.password.length < 6) next.password = 'Password must be at least 6 characters';

    if (!formData.confirmPassword) next.confirmPassword = 'Please confirm your password';
    else if (formData.confirmPassword !== formData.password) next.confirmPassword = 'Passwords do not match';

    // Business information is required
    if (!formData.businessName) next.businessName = 'Business name is required';
    else if (formData.businessName.length < 2) next.businessName = 'Business name must be at least 2 characters';

    if (!formData.storeName) next.storeName = 'Store name is required';
    else if (formData.storeName.length < 2) next.storeName = 'Store name must be at least 2 characters';
    else if (!/^[a-zA-Z0-9_-]+$/.test(formData.storeName)) next.storeName = 'Store name can only contain letters, numbers, hyphens, and underscores';
    else if (storeNameAvailable === false) next.storeName = 'Store name is already taken';
    else if (storeNameAvailable === null && formData.storeName) next.storeName = 'Checking store name availability...';

    // Custom email is required
    if (!formData.customEmail) next.customEmail = 'Custom email is required';
    else if (formData.customEmail.length < 2) next.customEmail = 'Custom email must be at least 2 characters';
    else if (!/^[a-zA-Z0-9_-]+$/.test(formData.customEmail)) next.customEmail = 'Custom email can only contain letters, numbers, hyphens, and underscores';

    // Check if account email conflicts with business emails
    if (formData.email && formData.storeName) {
      const businessEmails = [
        `no_reply.${formData.storeName}@fotonix.co.uk`,
        `theirchoice.${formData.storeName}@fotonix.co.uk`,
        `contact.${formData.storeName}@fotonix.co.uk`,
        `${formData.customEmail}.${formData.storeName}@fotonix.co.uk`
      ];
      
      if (businessEmails.includes(formData.email)) {
        next.email = 'Cannot use a business email address as your account email';
      }
    }

    // shipping optional: only require names if any shipping field provided
    const shippingProvided = formData.firstName || formData.lastName || formData.address || formData.city || formData.postalCode;
    if (shippingProvided) {
      if (!formData.firstName) next.firstName = 'First name is required when providing shipping';
      if (!formData.lastName) next.lastName = 'Last name is required when providing shipping';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsLoading(true);
      
      // Create the user account
      const userCredential = await signup(formData.email, formData.password, { username: formData.username });
      const user = userCredential.user;

      // Send custom verification email via VPS instead of Firebase
      try {
        const verificationResponse = await fetch(`${API_URL}/api/auth/send-custom-verification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ 
            firebaseUid: user.uid,
            email: formData.email,
            businessName: formData.businessName,
            userType: 'member' // Member signup flow
          }),
        });

        if (verificationResponse.ok) {
          console.log('✅ Custom verification email sent successfully');
        } else {
          console.warn('⚠️ Failed to send custom verification email, but signup succeeded');
        }
      } catch (emailError) {
        console.warn('⚠️ Verification email setup failed, but signup succeeded:', emailError);
      }

      // Save business information and create standard business emails
      try {
        const response = await fetch(`${API_URL}/api/member/business-email/create-standard`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ 
            memberUid: user.uid,
            storeName: formData.storeName,
            businessName: formData.businessName,
            customEmail: formData.customEmail
          }),
        });

        if (response.ok) {
          console.log('✅ Business emails created successfully');
        } else {
          console.warn('⚠️ Failed to create business emails, but signup succeeded');
        }
      } catch (emailError) {
        console.warn('⚠️ Email setup failed, but signup succeeded:', emailError);
      }

      if (onSignup) onSignup();
    } catch (err) {
      console.error(err);
      setErrors({ general: err.message || 'Signup failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      setIsLoading(true);
      await signInWithGoogle();
      if (onSignup) onSignup();
    } catch (error) {
      console.error('Google signup error:', error);
      let errorMessage = 'Google sign-up failed. Please try again.';
      if (error && error.code === 'auth/popup-closed-by-user') errorMessage = 'Sign-up was cancelled.';
      else if (error && error.code === 'auth/popup-blocked') errorMessage = 'Popup was blocked. Please allow popups and try again.';
      setErrors({ general: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = !errors.email && !errors.password && !errors.confirmPassword && !errors.businessName && !errors.storeName && !errors.customEmail && 
    formData.email && formData.password && formData.confirmPassword && formData.businessName && formData.storeName && formData.customEmail;

  return (
    <>
      <style>
        {`
          @keyframes spin {
            0% { transform: translateY(-50%) rotate(0deg); }
            100% { transform: translateY(-50%) rotate(360deg); }
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
        maxWidth: '520px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '10px' }}>Join free today</h1>
          <p style={{ color: '#6c757d', fontSize: '16px' }}>Unlock patterns, design with AI, and connect with creators.</p>
        </div>

        <form onSubmit={handleSubmit}>
          {errors.general && (
            <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '12px', borderRadius: '6px', marginBottom: '20px', border: '1px solid #f5c6cb' }}>{errors.general}</div>
          )}

          {/* Personal Information */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#495057', marginBottom: '12px', fontSize: '18px' }}>Personal Information</h3>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#495057' }}>Username</label>
              <input type="text" name="username" value={formData.username} onChange={handleChange} placeholder="Choose a username" style={{ width: '100%', padding: '12px 15px', border: `2px solid ${errors.username ? '#dc3545' : '#dee2e6'}`, borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white', color: 'black' }} />
              {errors.username && <p style={{ color: '#dc3545', fontSize: '14px', margin: '6px 0 0' }}>{errors.username}</p>}
            </div>
          </div>

          {/* Business Information */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#495057', marginBottom: '12px', fontSize: '18px' }}>Business Information</h3>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#495057' }}>Business Name</label>
              <input type="text" name="businessName" value={formData.businessName} onChange={handleChange} placeholder="Your Business Name" style={{ width: '100%', padding: '12px 15px', border: `2px solid ${errors.businessName ? '#dc3545' : '#dee2e6'}`, borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white', color: 'black' }} />
              {errors.businessName && <p style={{ color: '#dc3545', fontSize: '14px', margin: '6px 0 0' }}>{errors.businessName}</p>}
              <p style={{ color: '#6c757d', fontSize: '12px', margin: '4px 0 0' }}>This will be used for your business emails</p>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#495057' }}>Store Name</label>
              <div style={{ position: 'relative' }}>
                <input type="text" name="storeName" value={formData.storeName} onChange={handleChange} placeholder="yourstore" style={{ width: '100%', padding: '12px 40px 12px 15px', border: `2px solid ${errors.storeName ? '#dc3545' : storeNameAvailable === true ? '#28a745' : '#dee2e6'}`, borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white', color: 'black' }} />
                {checkingStoreName && (
                  <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                    <div style={{ width: '16px', height: '16px', border: '2px solid #dee2e6', borderTop: '2px solid #007bff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  </div>
                )}
                {!checkingStoreName && storeNameAvailable === true && (
                  <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="#28a745" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
                {!checkingStoreName && storeNameAvailable === false && (
                  <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 6L6 18M6 6l12 12" stroke="#dc3545" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>
              {errors.storeName && <p style={{ color: '#dc3545', fontSize: '14px', margin: '6px 0 0' }}>{errors.storeName}</p>}
              {!errors.storeName && storeNameAvailable === true && <p style={{ color: '#28a745', fontSize: '14px', margin: '6px 0 0' }}>✓ Store name is available</p>}
              <p style={{ color: '#6c757d', fontSize: '12px', margin: '4px 0 0' }}>This will be used to create your business email addresses</p>
              
              {formData.storeName && (
                <div style={{ backgroundColor: '#e8f5e8', border: '1px solid #c3e6c3', padding: '10px', borderRadius: '6px', marginTop: '8px' }}>
                  <p style={{ color: '#2d5016', fontSize: '14px', fontWeight: '600', margin: '0 0 4px 0' }}>Your Business Email:</p>
                  <p style={{ color: '#2d5016', fontSize: '13px', margin: '0', fontFamily: 'monospace' }}>no_reply.{formData.storeName}@fotonix.co.uk</p>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#495057' }}>Custom Business Email Prefix</label>
              <input type="text" name="customEmail" value={formData.customEmail} onChange={handleChange} placeholder="hello, support, info, etc." style={{ width: '100%', padding: '12px 15px', border: `2px solid ${errors.customEmail ? '#dc3545' : '#dee2e6'}`, borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white', color: 'black' }} />
              {errors.customEmail && <p style={{ color: '#dc3545', fontSize: '14px', margin: '6px 0 0' }}>{errors.customEmail}</p>}
              <p style={{ color: '#6c757d', fontSize: '12px', margin: '4px 0 0' }}>Create a personalized business email address</p>
              
              {formData.customEmail && formData.storeName && (
                <div style={{ backgroundColor: '#e8f5e8', border: '1px solid #c3e6c3', padding: '10px', borderRadius: '6px', marginTop: '8px' }}>
                  <p style={{ color: '#2d5016', fontSize: '14px', fontWeight: '600', margin: '0 0 4px 0' }}>Your Custom Email:</p>
                  <p style={{ color: '#2d5016', fontSize: '13px', margin: '0', fontFamily: 'monospace' }}>{formData.customEmail}.{formData.storeName}@fotonix.co.uk</p>
                </div>
              )}
            </div>
          </div>

          {/* Account Information */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#495057', marginBottom: '12px', fontSize: '18px' }}>Account Information</h3>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#495057' }}>Personal Account Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="your.personal.email@gmail.com" style={{ width: '100%', padding: '12px 15px', border: `2px solid ${errors.email ? '#dc3545' : '#dee2e6'}`, borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white', color: 'black' }} />
              {errors.email && <p style={{ color: '#dc3545', fontSize: '14px', margin: '6px 0 0' }}>{errors.email}</p>}
              <p style={{ color: '#6c757d', fontSize: '12px', margin: '4px 0 0' }}>This is your personal login email - do NOT use your business email here</p>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#495057' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange} placeholder="Enter a password" style={{ width: '100%', padding: '12px 40px 12px 15px', border: `2px solid ${errors.password ? '#dc3545' : '#dee2e6'}`, borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white', color: 'black' }} />
                <button type="button" onClick={() => setShowPassword(s => !s)} aria-pressed={showPassword} aria-label={showPassword ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: '6px', cursor: 'pointer' }}>
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3l18 18" stroke="#495057" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9.88 9.88A3 3 0 0114.12 14.12" stroke="#495057" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="#495057" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="#495057" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </button>
              </div>

              <div style={{ height: '8px', marginTop: '8px', background: '#e9ecef', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(formData.password.length, 12) / 12 * 100}%`, height: '100%', transition: 'width 160ms ease', background: strengthLevel === 1 ? '#dc3545' : strengthLevel === 2 ? '#f0ad4e' : '#28a745' }} />
              </div>
              {errors.password && <p style={{ color: '#dc3545', fontSize: '14px', margin: '6px 0 0' }}>{errors.password}</p>}
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#495057' }}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="Confirm password" style={{ width: '100%', padding: '12px 40px 12px 15px', border: `2px solid ${errors.confirmPassword ? '#dc3545' : '#dee2e6'}`, borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white', color: 'black' }} />
                <button type="button" onClick={() => setShowConfirmPassword(s => !s)} aria-pressed={showConfirmPassword} aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: '6px', cursor: 'pointer' }}>
                  {showConfirmPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3l18 18" stroke="#495057" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="#495057" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="#495057" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </button>
              </div>
              {errors.confirmPassword && <p style={{ color: '#dc3545', fontSize: '14px', margin: '6px 0 0' }}>{errors.confirmPassword}</p>}
            </div>
          </div>

          {/* Shipping Information */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#495057', marginBottom: '12px', fontSize: '18px' }}>Shipping Address (Optional)</h3>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#495057' }}>First Name</label>
                <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} placeholder="John" style={{ width: '100%', padding: '12px 15px', border: `2px solid ${errors.firstName ? '#dc3545' : '#dee2e6'}`, borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white', color: 'black' }} />
                {errors.firstName && <p style={{ color: '#dc3545', fontSize: '14px', margin: '6px 0 0' }}>{errors.firstName}</p>}
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#495057' }}>Last Name</label>
                <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Doe" style={{ width: '100%', padding: '12px 15px', border: `2px solid ${errors.lastName ? '#dc3545' : '#dee2e6'}`, borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white', color: 'black' }} />
                {errors.lastName && <p style={{ color: '#dc3545', fontSize: '14px', margin: '6px 0 0' }}>{errors.lastName}</p>}
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#495057' }}>Address</label>
              <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="123 Main Street" style={{ width: '100%', padding: '12px 15px', border: `2px solid ${errors.address ? '#dc3545' : '#dee2e6'}`, borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white', color: 'black' }} />
              {errors.address && <p style={{ color: '#dc3545', fontSize: '14px', margin: '6px 0 0' }}>{errors.address}</p>}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#495057' }}>City</label>
                <input type="text" name="city" value={formData.city} onChange={handleChange} placeholder="London" style={{ width: '100%', padding: '12px 15px', border: `2px solid ${errors.city ? '#dc3545' : '#dee2e6'}`, borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white', color: 'black' }} />
                {errors.city && <p style={{ color: '#dc3545', fontSize: '14px', margin: '6px 0 0' }}>{errors.city}</p>}
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#495057' }}>Postal Code</label>
                <input type="text" name="postalCode" value={formData.postalCode} onChange={handleChange} placeholder="SW1A 1AA" style={{ width: '100%', padding: '12px 15px', border: `2px solid ${errors.postalCode ? '#dc3545' : '#dee2e6'}`, borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white', color: 'black' }} />
                {errors.postalCode && <p style={{ color: '#dc3545', fontSize: '14px', margin: '6px 0 0' }}>{errors.postalCode}</p>}
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#495057' }}>Country</label>
              <select name="country" value={formData.country} onChange={handleChange} style={{ width: '100%', padding: '12px 15px', border: '2px solid #dee2e6', borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white', color: 'black' }}>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Ireland">Ireland</option>
                <option value="France">France</option>
                <option value="Germany">Germany</option>
                <option value="Netherlands">Netherlands</option>
                <option value="Belgium">Belgium</option>
              </select>
            </div>
          </div>

          <button type="submit" disabled={isLoading || !isFormValid} style={{ width: '100%', padding: '15px', backgroundColor: isLoading ? '#6c757d' : '#28a745', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'background-color 0.3s ease', marginBottom: '15px' }}>{isLoading ? 'Creating Account...' : 'Join free today'}</button>

          <div style={{ textAlign: 'center', margin: '15px 0', position: 'relative' }}>
            <hr style={{ border: 'none', borderTop: '1px solid #dee2e6', margin: '0' }} />
            <span style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'white', padding: '0 15px', color: '#6c757d', fontSize: '14px' }}>or</span>
          </div>

          <button type="button" onClick={handleGoogleSignup} disabled={isLoading} style={{ width: '100%', padding: '15px', backgroundColor: 'white', color: '#495057', border: '2px solid #dee2e6', borderRadius: '8px', fontSize: '16px', fontWeight: '500', cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'all 0.3s ease', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Sign up with Google
          </button>

          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#6c757d', fontSize: '14px' }}>Already have an account?{' '}
              <button type="button" onClick={onSwitchToLogin} style={{ background: 'none', border: 'none', color: '#007bff', textDecoration: 'underline', cursor: 'pointer', fontSize: '14px' }}>Sign in here</button>
            </p>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}

export default Signup;
