import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ProductCard from './ProductCard';
import products from '../../data/productsData';
import '../../App.css';

const gradientBtn =
  "bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 text-white hover:brightness-110 active:brightness-95 transition-all shadow-lg shadow-pink-500/20 rounded-xl";

function Products({ onProductSelect, searchResults = [] }) {
  const handleProductSelect = (product) => {
    // Navigate based on product link property or default behavior
    if (product.link) {
      // If the link is a full URL or starts with a leading slash, use it directly.
      // If it looks like a path (contains '/'), navigate to that path without forcing a hash.
      // Otherwise, fall back to the hash-based route used elsewhere.
      let href;
      if (product.link.startsWith('http') || product.link.startsWith('/')) {
        href = product.link;
      } else if (product.link.startsWith('#')) {
        href = product.link;
      } else if (product.link.includes('/')) {
        href = `/${product.link}`;
      } else {
        href = `/#${product.link}`;
      }
      window.location.href = href;
      // Scroll to top after navigation
      setTimeout(() => window.scrollTo(0, 0), 50);
    } else if (onProductSelect) {
      onProductSelect(product);
    }
  };
  
  const { signup, signInWithGoogle: ctxSignInWithGoogle } = useAuth();

  const [quickEmail, setQuickEmail] = useState('');
  const [quickPassword, setQuickPassword] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState('');

  // Use AuthContext signInWithGoogle if available, otherwise fallback to window.firebase
  const signInWithGoogle = async (projectId = 'project-1003654054250') => {
    setQuickError('');
    setQuickLoading(true);
    try {
      if (ctxSignInWithGoogle) {
        await ctxSignInWithGoogle();
        return;
      }

      const firebase = window.firebase;
      if (!firebase || !firebase.auth) {
        throw new Error(`Firebase is not configured. Initialise Firebase with ${projectId} to enable Google sign-in.`);
      }

      const provider = new firebase.auth.GoogleAuthProvider();
      await firebase.auth().signInWithPopup(provider);
    } catch (err) {
      console.error('Google sign-in failed:', err);
      setQuickError(err.message || 'Google sign-in failed');
    } finally {
      setQuickLoading(false);
    }
  };

  const handleQuickSignup = async (e) => {
    e.preventDefault();
    setQuickError('');
    if (!quickEmail || !quickPassword) {
      setQuickError('Email and password are required');
      return;
    }

    setQuickLoading(true);
    try {
      await signup(quickEmail, quickPassword, { source: 'quick-signup' });
      // signup also signs the user in; onAuthStateChanged will update context
      // Optionally navigate or show success
      window.location.href = '/#product';
    } catch (err) {
      console.error('Quick signup failed:', err);
      setQuickError(err.message || 'Signup failed');
    } finally {
      setQuickLoading(false);
    }
  };

  return (
    <section className="products">
  {/* search dropdown (renders when searchResults provided) */}
  {searchResults && searchResults.length > 0 && (
    <div className="search-dropdown" style={{ position: 'sticky', top: 72, zIndex: 40, maxWidth: 720, margin: '12px auto', background: '#0b1020', borderRadius: 10, padding: 8 }}>
      {searchResults.map((r) => (
        <div key={r.id} style={{ padding: 8, borderRadius: 8, cursor: 'pointer' }} onClick={() => { if (onProductSelect) onProductSelect(r); window.location.href = '/#product'; }}>
          <div style={{ color: '#e6e7ea', fontWeight: 700 }}>{r.name}</div>
          <div style={{ color: '#9aa0a6', fontSize: 13 }}>{r.description}</div>
        </div>
      ))}
    </div>
  )}
  {/* banner intentionally moved below the product grid; placeholder removed here */}
  <div id="products" className="container">
        <h2>Our Products</h2>
        <div className="products-grid">
          {products.map((product, index) => (
            <div key={product.id} className={`grid-item ${product.fullWidth ? 'fullWidth' : ''}`}>
              <ProductCard 
                product={product}
                featured={index === 0} // First product (Lumina) is featured
                onViewDetails={handleProductSelect}
              />
            </div>
          ))}
        </div>
        {/* Centered, more vertical signup / downloads banner below products */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32, padding: '0 12px' }}>
          <div style={{ width: '100%', maxWidth: 720 }}>
            <div style={{ borderRadius: 18, overflow: 'hidden', boxShadow: '0 8px 28px rgba(0,0,0,0.08)' }}>
              <div style={{ background: 'linear-gradient(180deg,#ff9bb7 0%,#9f7aea 100%)', padding: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: '#ffffff', borderRadius: 14, padding: 26, width: '100%', textAlign: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#111827' }}>Bring your ideas to light  join free in seconds</h2>
                  <div style={{ marginTop: 12, color: '#374151', lineHeight: 1.5 }}>
                    <div>Utilise AI to create unique lighting designs</div>
                    <div>Download popular community light designs</div>
                    <div>Save and customise your own projects instantly</div>
                  </div>

                  {/* vertical form stack */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18, alignItems: 'stretch' }}>
                    <input id="signup-email" type="email" value={quickEmail} onChange={(e) => setQuickEmail(e.target.value)} placeholder="Email" className="light-input" style={{ padding: '12px', borderRadius: 10, width: '100%' }} />
                    <input id="signup-password" type="password" value={quickPassword} onChange={(e) => setQuickPassword(e.target.value)} placeholder="Password" className="light-input" style={{ padding: '12px', borderRadius: 10, width: '100%' }} />
                    <button id="signup-submit" onClick={handleQuickSignup} disabled={quickLoading} className={gradientBtn} style={{ color: '#fff', padding: '12px', borderRadius: 10, fontWeight: 700 }}>{quickLoading ? 'Creating...' : 'Sign up'}</button>
                    <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4, marginBottom: 0 }}>By clicking Sign up, you agree to receive marketing emails from Fotonix. You can unsubscribe at any time.</p>
                    {quickError && <div style={{ color: '#dc3545', marginTop: 8 }}>{quickError}</div>}

                    {/* Sign up with Google (Firebase) button */}
                    <button onClick={(e) => { e.preventDefault(); signInWithGoogle('project-1003654054250'); }} className="gsi-material-button" style={{ width: '400px', margin: '0 auto', display: 'block' }}>
                      <div className="gsi-material-button-state"></div>
                      <div className="gsi-material-button-content-wrapper">
                        <div className="gsi-material-button-icon">
                          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" xmlnsXlink="http://www.w3.org/1999/xlink" style={{ display: 'block' }}>
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                            <path fill="none" d="M0 0h48v48H0z"></path>
                          </svg>
                        </div>
                        <span className="gsi-material-button-contents">Sign up with Google</span>
                        <span style={{ display: 'none' }}>Sign up with Google</span>
                      </div>
                    </button>

                    <div style={{ marginTop: 8 }}>
                      <a href="#login" style={{ color: '#7c3aed', textDecoration: 'none', fontSize: 14 }}>Already have an account? Log in</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Products;
