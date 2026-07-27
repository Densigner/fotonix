import React, { useState, useEffect } from 'react';
import './App.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import useAffiliateRef from './hooks/useAffiliateRef';
import Header from './components/shared/Header';
import Hero from './components/landing/Hero';
import HeroWithSlider from './components/landing/HeroWithSlider';
import HeroRedesign from './components/landing/HeroRedesign';
import Products from './components/products/Products';
import InfoBar from './components/shared/InfoBar';
// ProductFeaturesSlider removed per request
import TestimonialsSlider from './components/landing/TestimonialsSlider';
import Footer from './components/landing/Footer';
import About from './components/landing/About';
import ProductPage from './components/products/ProductPageClean';
import CustomerProductPage from './components/products/CustomerProductPage';
import StandardMirrorDesigner from './components/designers/StandardMirrorDesigner';
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import CustomerSignup from './components/auth/CustomerSignup';
import EmailVerification from './components/auth/EmailVerification';
import EmailVerificationGate from './components/auth/EmailVerificationGate';
import Account from './components/auth/Account';
import CustomerDashboard from './components/auth/CustomerDashboard';
import AffiliateDashboard from './components/affiliate/AffiliateDashboard';
import AffiliateClickCard from './components/affiliate/AffiliateClickCard';
import ShortReviewPage from './pages/ShortReviewPage';
import AffiliateSignupPage from './components/affiliate/AffiliateSignupPage';
import { AffiliateStorefrontEditor, AffiliateStorefrontViewer } from './components/affiliate/AffiliateShopBuilderPage';
import AffiliateProductPageCleanAccryl from './components/products/AffiliateProductPageCleanAccryl';
import { AffiliateProductsPanel } from './components/affiliate/AffiliateProductsPanel';
import AffiliateMailingList from './components/affiliate/AffiliateMailingList';
import AffiliateCreateProduct from './components/affiliate/AffiliateCreateProduct';
import AcrylicComposerWithMask from './components/designers/AcrylicComposerWithMask';
import MembersDashboard from './components/admin/MembersDashboard';
import MemberAffiliateLinker from './components/admin/MemberAffiliateLinker';
import MailBuilderDashboard from './components/email/MailBuilder/MainMailBuilderDashBoard';
import MailBuilderComposerPage from './pages/MailBuilderComposerPage';
import AutomationsComposerPage from './components/automationscomposer/AutomationsComposerPage';
import CampaignSendPage from './components/email/MailBuilder/CampaignSendPage';
import MailBuilderOnboarding from './components/email/MailBuilder/MailOnboard';
import MailOnboardFull from './components/email/MailBuilder/MailOnboardFull';
import FeaturesShowcase from './components/landing/FeaturesShowcase';
import InboxScreen from './components/email/InboxScreen';
import AdvancedInboxScreen from './components/email/AdvancedInboxScreen';
import EmailAutomationDashboard from './components/email-automation/EmailAutomationDashboard';
import StencilGenerator from './components/stencilUpload/StencilGenerator';
import MainScreenPBY from './components/PaintByNumbers/MainScreenPBY';
import MadeOrders from './components/madeOrders/MadeOrders';
import MyOrders from './components/customerStuff/MyOrders';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';

// Conversion Optimization Components
import ExitIntentPopup from './components/marketing/ExitIntentPopup';
import SocialProofWidgets, { SocialProofBanner } from './components/marketing/SocialProofWidgets';
import ConversionChatbot from './components/marketing/ConversionChatbot';
import { useExitIntent } from './hooks/useExitIntent';
import { EmailCaptureService } from './services/emailCapture';

// lazy imports must come after all top-level ES imports (eslint: import/first)
// lazy import of the affiliate clicks dashboard (now inside src/components)
const AffiliateDashboardclick = React.lazy(() => import('./components/affiliate/AffiliateDashboardclick'));
// lazy import of FunnelBuilder
const FunnelBuilder = React.lazy(() => import('./components/marketing/funnelBuilder/FunnelBuilder'));
// lazy import of FunnelBuilder dash
// lazy import of StoreBuilder
const StoreBuilder = React.lazy(() => import('./components/store-builder/storeBuilder/StoreBuilder'));
// lazy import of StoreViewer
const StoreViewer = React.lazy(() => import('./components/store-builder/storeBuilder/StoreViewer'));
const FunnelBuilderDash = React.lazy(() => import('./components/marketing/funnelBuilder/FunnelBuilderDash'));
// lazy import of Templates page for funnel builder
const FunnelTemplatesPage = React.lazy(() => import('./components/marketing/funnelBuilder/funnelBuilderTemplates/TemplatesPage'));
// lazy import of FunnelViewer for public funnel pages
const FunnelViewer = React.lazy(() => import('./components/marketing/funnelBuilder/FunnelViewer'));
// lazy import of DeadRedSearch for database searching

function AppContent() {
  const auth = useAuth();
  // Capture ?ref=<affiliateCode> on any landing page and record the click,
  // so a later purchase can be attributed back to that affiliate.
  useAffiliateRef();

  // initialize page from URL hash so direct links like #about work
  const getInitialPage = () => {
    if (typeof window !== 'undefined') {
      // Check pathname first (for direct URLs like /@handle)
      if (window.location.pathname.startsWith('/@')) {
        const handle = window.location.pathname.substring(2); // Remove the /@
        // If there's a hash after the pathname (e.g. /@handle#affiliate-product-accryl) prefer the hash page
        const hash = (window.location.hash || '').replace('#', '');
        if (hash) {
          if (hash.startsWith('@')) {
            const h = hash.substring(1);
            return { page: 'affiliate-store', handle: h };
          }
          return { page: hash || 'affiliate-store', handle };
        }
        return { page: 'affiliate-store', handle };
      }

      // Then check hash
      if (window.location.hash) {
        const hash = window.location.hash.replace('#', '');

        // Check if it's an @handle URL
        if (hash.startsWith('@')) {
          const handle = hash.substring(1); // Remove the @
          return { page: 'affiliate-store', handle };
        }

        return { page: hash || 'home', handle: null };
      }
    }
    return { page: 'home', handle: null };
  };

  const [currentPage, setCurrentPage] = useState(() => getInitialPage().page); // 'home', 'product', 'login', 'signup'
  const [verificationMessage, setVerificationMessage] = useState(null); // For email verification success/error messages
  React.useEffect(() => {
    try { console.log('[App] currentPage state changed ->', currentPage); } catch(e) {}
  }, [currentPage]);

  // Auto-dismiss verification message after 8 seconds
  React.useEffect(() => {
    if (verificationMessage) {
      const timer = setTimeout(() => {
        setVerificationMessage(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [verificationMessage]);

  // Conversion Optimization State
  const { showExitIntent, hideExitIntent } = useExitIntent({
    sensitivity: 20,
    delay: 3000, // 3 seconds minimum on page
    showOnce: true,
    enabled: !auth?.isAuthenticated // Only show to non-authenticated users
  });
  const [useModernSliders, setUseModernSliders] = useState(true); // Toggle for modern sliders
  const [selectedProduct, setSelectedProduct] = useState(null); // Store selected product
  const [searchResults, setSearchResults] = useState([]);
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);
  const [affiliateHandle, setAffiliateHandle] = useState(() => getInitialPage().handle); // For @handle routing
  const [affiliateProducts, setAffiliateProducts] = useState([]);
  const [affiliateProductsLoading, setAffiliateProductsLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [selectedFunnelId, setSelectedFunnelId] = useState(null);
  const [selectedFunnelCompanySlug, setSelectedFunnelCompanySlug] = useState(null);

  // Fetch affiliate products when navigating to the add-product page
  React.useEffect(() => {
    if (currentPage === 'affiliate-add-product') {
      if (auth && auth.isAuthenticated && auth.currentUser && (auth.currentUser.emailVerified || process.env.NODE_ENV === 'development')) {
        fetchAffiliateProducts(auth.currentUser.uid);
      } else {
        setAffiliateProducts([]);
      }
    }
  }, [currentPage, auth && auth.currentUser && auth.currentUser.uid, auth && auth.isAuthenticated, auth && auth.currentUser && auth.currentUser.emailVerified]);
  
  // Handle Firebase email verification actions
  useEffect(() => {
    const handleEmailVerification = async () => {
      if (typeof window === 'undefined') return;
      
      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get('mode');
      const oobCode = urlParams.get('oobCode');
      
      if (mode === 'verifyEmail' && oobCode) {
        try {
          // Apply the email verification code
          await auth.applyActionCode(oobCode);
          
          // Clean up the URL
          const newUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
          
          // Redirect to affiliates page
          setCurrentPage('affiliates');
          
          // Show success message
          alert('Email verified successfully! Welcome to the affiliate program.');
        } catch (error) {
          console.error('Email verification failed:', error);
          alert('Email verification failed. The link may be expired or invalid.');
        }
      }
    };
    
    handleEmailVerification();
  }, [auth]);

  const handleProductSelect = (product) => {
    // Allow users to access product design without login
    setSelectedProduct(product);
    setCurrentPage('product');
  };

  const handleBackToHome = () => {
    setCurrentPage('home');
    setSelectedProduct(null);
  };

  const handleShowLogin = () => {
    setCurrentPage('login');
  };

  const handleSearch = (q) => {
    // simple client-side search across product names and descriptions
    try {
      const list = require('./data/productsData').default || [];
      const ql = (q || '').trim().toLowerCase();
      if (!ql) {
        return [];
      }
      return list.filter(p => (p.name || '').toLowerCase().includes(ql) || (p.description || '').toLowerCase().includes(ql));
    } catch (e) {
      console.warn('search error', e);
      return [];
    }
  };

  // Clear search results - no longer needed but keep for compatibility
  const handleClearSearch = () => {
    // No-op now since search is managed in Header
  };

  const handleSwitchToLogin = () => {
    setCurrentPage('login');
  };

  const handleSwitchToSignup = () => {
    setCurrentPage('signup');
  };

  const handleLogin = () => {
    setCurrentPage('member-dashboard'); // Go to member dashboard after login
  };

  const handleSignup = () => {
    setCurrentPage('email-verification'); // Show email verification message after signup
  };

  const handleProductPageAccess = () => {
    // Allow product page access without login
    handleNavigate('product');
    // Ensure the viewport is at the top after navigation
    if (typeof window !== 'undefined' && window.scrollTo) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // centralized navigation that also updates the URL hash so direct links work
  const handleNavigate = (page) => {
    setCurrentPage(page);
    try {
      if (typeof window !== 'undefined') {
        window.location.hash = page;
      }
    } catch (e) {
      // ignore
    }
  };

  // Handle exit-intent email capture
  const handleExitIntentEmail = async (email) => {
    try {
      await EmailCaptureService.submitLeadMagnet(email, 'exit-intent-popup');
      
      // Mark email as captured to avoid duplicate popups
      EmailCaptureService.markEmailCaptured(email);
      
      return { success: true };
    } catch (error) {
      console.error('Failed to capture exit-intent email:', error);
      throw error;
    }
  };

  // Handle chatbot lead capture
  const handleChatbotLeadCapture = async (leadData) => {
    try {
      await EmailCaptureService.submitLeadMagnet(leadData.email, 'ai-chatbot');
      
      // Track additional lead qualification data
      if (leadData.businessType || leadData.monthlyRevenue) {
        // Store additional qualification data (could extend EmailCaptureService)
        console.log('Qualified lead captured:', leadData);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to capture chatbot lead:', error);
      throw error;
    }
  };

  // Handle chatbot conversion
  const handleChatbotConversion = () => {
    // User expressed high intent through chatbot - navigate to subscription
    setCurrentPage('member-dashboard'); // This will trigger subscription gate
  };

  async function fetchAffiliateProducts(uid) {
    if (!uid) return setAffiliateProducts([]);
    setAffiliateProductsLoading(true);
    try {
      // Products created via AffiliateCreateProduct.js are written to Firebase
      // Realtime Database at products/{uid}/{productId} — read from there, not
      // the /api/products (flat-file) endpoint, which is a separate data store.
      const dbm = await import("firebase/database");
      const { getDatabase, ref: dbRef, get } = dbm;
      const db = getDatabase();
      const snapshot = await get(dbRef(db, `products/${uid}`));

      if (snapshot.exists()) {
        const productsData = snapshot.val();
        const productsList = Object.entries(productsData).map(([id, p]) => ({
          id,
          title: p.title || 'Untitled product',
          sku: p.sku || null,
          price: p.price ?? 0,
          commissionRate: p.commissionRate ?? 0,
          status: p.status || 'active',
          clicks: p.clicks || 0,
          conversions: p.conversions || 0,
          itemsSold: p.itemsSold || 0,
          earnings: p.earnings || 0,
          images: p.images || [],
          mainImageIndex: p.mainImageIndex || 0,
        }));
        setAffiliateProducts(productsList);
      } else {
        setAffiliateProducts([]);
      }
    } catch (e) {
      console.warn('fetchAffiliateProducts failed', e);
      setAffiliateProducts([]);
    } finally {
      setAffiliateProductsLoading(false);
    }
  }

  // respond to back/forward and external hash changes
  React.useEffect(() => {
    const updatePageFromUrl = () => {
      if (typeof window !== 'undefined') {
        // If pathname is /@handle, prefer a hash page if present (e.g. /@handle#affiliate-product-accryl)
        if (window.location.pathname.startsWith('/@')) {
          const handle = window.location.pathname.substring(2); // Remove the /@
          setAffiliateHandle(handle);
          const hash = (window.location.hash || '').replace('#', '');
          try { console.log('[App] hash detected (from pathname)', hash); } catch(e) {}
          if (hash) {
            if (hash.startsWith('@')) {
              const h = hash.substring(1);
              setAffiliateHandle(h);
              setCurrentPage('affiliate-store');
            } else {
              // Parse hash with potential query params (e.g., page?verified=true&message=...)
              const [pagePart] = hash.split('?');
              setCurrentPage(pagePart);
            }
            return;
          }
          setCurrentPage('affiliate-store');
          return;
        }

        // Then check hash in normal pages
        const fullHash = window.location.hash.replace('#', '') || 'home';
        try { console.log('[App] hash detected', fullHash); } catch(e) {}
        
        // Parse query params from hash (e.g., #member-dashboard?verified=true&message=...)
        const [pagePart, queryPart] = fullHash.split('?');
        const hash = pagePart;
        
        // Check for verification params
        if (queryPart) {
          const params = new URLSearchParams(queryPart);
          const verified = params.get('verified');
          const message = params.get('message');
          const error = params.get('error');
          
          if (verified === 'true' && message) {
            setVerificationMessage({ type: 'success', text: decodeURIComponent(message) });
            // Clear the URL params after reading (keep just the page)
            setTimeout(() => {
              window.history.replaceState({}, '', `${window.location.pathname}#${hash}`);
            }, 100);
          } else if (error) {
            setVerificationMessage({ type: 'error', text: decodeURIComponent(error) });
            setTimeout(() => {
              window.history.replaceState({}, '', `${window.location.pathname}#${hash}`);
            }, 100);
          }
        }
        
        // Handle redirects for shop-builder -> affiliate-shop-builder
        if (hash === 'shop-builder') {
          try { console.log('[App] redirecting shop-builder -> affiliate-shop-builder'); } catch(e) {}
          window.location.hash = 'affiliate-shop-builder';
          return;
        }
        
        if (hash.startsWith('@')) {
          const handle = hash.substring(1); // Remove the @
          setAffiliateHandle(handle);
          setCurrentPage('affiliate-store');
        } else {
          setCurrentPage(hash);
        }
      }
    };
    
    const onHashChange = () => {
      updatePageFromUrl();
    };
    
    const onPopState = () => {
      updatePageFromUrl();
    };

    const handleOpenCreateProductModal = () => {
      setShowCreateProductModal(true);
    };
    
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onPopState);
    window.addEventListener('openCreateProductModal', handleOpenCreateProductModal);
    
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('openCreateProductModal', handleOpenCreateProductModal);
    };
  }, []);

  // Main UI content - directly returned, not wrapped in a nested function
  const appUIContent = (
      <div className="App">
        <Header
          currentPage={currentPage}
          onShowLogin={handleShowLogin}
          showInfoBar={currentPage === 'about'}
          onLogoClick={handleBackToHome}
          onNavigate={(page) => setCurrentPage(page)}
          onSearch={handleSearch}
          onClearSearch={handleClearSearch}
        />

        {/* Email Verification Success/Error Banner */}
        {verificationMessage && (
          <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-lg w-full mx-4 px-6 py-4 rounded-lg shadow-lg ${
            verificationMessage.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {verificationMessage.type === 'success' ? (
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <p className="font-medium">{verificationMessage.text}</p>
              </div>
              <button 
                onClick={() => setVerificationMessage(null)}
                className="ml-4 text-gray-500 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Auth Pages */}
        {currentPage === 'login' && (
          <Login 
            onLogin={handleLogin}
            onSwitchToSignup={handleSwitchToSignup}
          />
        )}
        
        {/* Customer Signup - simple email/password */}
        {currentPage === 'signup' && (
          <CustomerSignup 
            onSignup={handleSignup}
            onSwitchToLogin={handleSwitchToLogin}
            onSwitchToMemberSignup={() => setCurrentPage('member-signup')}
          />
        )}
        
        {/* Member/Seller Signup - full business signup */}
        {currentPage === 'member-signup' && (
          <Signup 
            onSignup={handleSignup}
            onSwitchToLogin={handleSwitchToLogin}
          />
        )}

        {currentPage === 'email-verification' && (
          <EmailVerification 
            onBackToLogin={handleSwitchToLogin}
          />
        )}

        {currentPage === 'account' && (
          auth && auth.isAuthenticated && auth.currentUser && (auth.currentUser.emailVerified || process.env.NODE_ENV === 'development') ? (
            <CustomerDashboard />
          ) : (
            <EmailVerificationGate onBackToLogin={handleSwitchToLogin} />
          )
        )}
        
        {/* Main Content Pages */}
        {currentPage === 'home' && (
          <>
            {useModernSliders ? <HeroRedesign /> : <Hero />}
            <InfoBar />
            <Products onProductSelect={handleProductSelect} />
            {useModernSliders && <TestimonialsSlider />}
          </>
        )}
        
        {currentPage === 'about' && (
          <>
            <InfoBar />
            <About />
          </>
        )}

        {(currentPage === 'product' || currentPage === 'product-clean') && (
          <ProductPage 
            selectedProduct={selectedProduct} 
            onBack={handleBackToHome}
            onRequireAuth={handleShowLogin}
          />
        )}

        {currentPage === 'affiliates' && (
          auth && auth.isAuthenticated ? (
            (auth.currentUser && (auth.currentUser.emailVerified || process.env.NODE_ENV === 'development')) ? (
              <AffiliateDashboard
                affiliateCode={auth.userProfile?.affiliateCode}
                programUrl={window.location.origin}
                onCreateProduct={() => setShowCreateProductModal(true)}
              />
            ) : (
              <div className="mx-auto max-w-lg px-6 py-10">
                <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-md text-center">
                  <h3 className="text-lg font-semibold mb-2">Verify your email</h3>
                  <p className="text-sm text-gray-600 mb-4">We sent a verification email — please check your inbox and click the link. After verifying, refresh this page to access your dashboard.</p>
                  <button className="rounded-lg bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white" onClick={async () => {
                    try {
                      if (auth.currentUser && typeof auth.currentUser.sendEmailVerification === 'function') {
                        await auth.currentUser.sendEmailVerification();
                        alert('Verification email resent');
                      }
                    } catch (e) { console.warn('resend failed', e); alert('Failed to resend verification email'); }
                  }}>Resend verification email</button>
                </div>
              </div>
            )
          ) : (
            <AffiliateSignupPage onSubmit={() => setCurrentPage('affiliates')} />
          )
        )}

        {/* ShortReview standalone route (also accessible via /tools/short-review) */}
        {currentPage === 'tools/short-review' && (
          <ShortReviewPage />
        )}

        {currentPage === 'affiliate-clicks' && (
          <React.Suspense fallback={<div className="p-8">Loading dashboard…</div>}>
            <AffiliateDashboardclick affiliateCode={auth.userProfile?.affiliateCode} />
          </React.Suspense>
        )}

        {currentPage === 'affiliate-mailing-list' && (
          <AffiliateMailingList currentUserId={auth?.currentUser?.uid} />
        )}

        {currentPage === 'funnel-builder' && (
          <React.Suspense fallback={<div className="p-8">Loading funnel builder…</div>}>
            <FunnelBuilderDash
              currentUserId={auth?.currentUser?.uid}
              onOpenFunnel={(funnel, companySlug) => {
                setSelectedFunnelId(funnel.id);
                setSelectedFunnelCompanySlug(companySlug);
                setSelectedTemplateId(null);
                setCurrentPage('funnel-builder/editor');
              }}
            />
          </React.Suspense>
        )}

        {currentPage === 'funnel-builder/templates' && (
          <React.Suspense fallback={<div className="p-8">Loading templates…</div>}>
            <FunnelTemplatesPage
              onSelectTemplate={(id) => {
                // store selected template id and navigate to editor
                setSelectedTemplateId(id);
                setCurrentPage('funnel-builder/editor');
              }}
            />
          </React.Suspense>
        )}

        {currentPage === 'funnel-builder/editor' && (
          <React.Suspense fallback={<div className="p-8">Loading funnel builder…</div>}>
            <FunnelBuilder
              initialTemplateId={selectedTemplateId}
              funnelId={selectedFunnelId}
              currentUserId={auth?.currentUser?.uid}
              companySlug={selectedFunnelCompanySlug}
            />
          </React.Suspense>
        )}

        {currentPage === 'affiliate-shop-builder' && (
          auth && auth.isAuthenticated && auth.currentUser && (auth.currentUser.emailVerified || process.env.NODE_ENV === 'development') ? (
            <AffiliateStorefrontEditor 
              currentUserId={auth.currentUser.uid} 
              siteOrigin={window.location.origin} 
            />
          ) : (
            <div className="mx-auto max-w-lg px-6 py-10">
              <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-md text-center">
                <h3 className="text-lg font-semibold mb-2">Access Required</h3>
                <p className="text-sm text-gray-600 mb-4">Please log in and verify your email to access the shop builder.</p>
                <button className="rounded-lg bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white" onClick={() => setCurrentPage('login')}>Log In</button>
              </div>
            </div>
          )
        )}

        {currentPage === 'store-builder' && (
          auth && auth.isAuthenticated && auth.currentUser && (auth.currentUser.emailVerified || process.env.NODE_ENV === 'development') ? (
            <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-lg">Loading Store Builder...</div></div>}>
              <StoreBuilder 
                currentUserId={auth.currentUser.uid} 
                siteOrigin={window.location.origin} 
              />
            </React.Suspense>
          ) : (
            <div className="mx-auto max-w-lg px-6 py-10">
              <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-md text-center">
                <h3 className="text-lg font-semibold mb-2">Access Required</h3>
                <p className="text-sm text-gray-600 mb-4">Please log in and verify your email to access the modern store builder.</p>
                <button className="rounded-lg bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white" onClick={() => setCurrentPage('login')}>Log In</button>
              </div>
            </div>
          )
        )}



        {currentPage === 'affiliate-add-product' && (
          auth && auth.isAuthenticated && auth.currentUser && (auth.currentUser.emailVerified || process.env.NODE_ENV === 'development') ? (
            <AffiliateProductsPanel 
              products={affiliateProducts}
              loading={affiliateProductsLoading}
              onRefresh={() => fetchAffiliateProducts(auth.currentUser.uid)}
              onToggleStatus={(id) => console.log('toggle status', id)}
            />
          ) : (
            <div className="mx-auto max-w-lg px-6 py-10">
              <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-md text-center">
                <h3 className="text-lg font-semibold mb-2">Access Required</h3>
                <p className="text-sm text-gray-600 mb-4">Please log in and verify your email to add products.</p>
                <button className="rounded-lg bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white" onClick={() => setCurrentPage('login')}>Log In</button>
              </div>
            </div>
          )
        )}

        {currentPage === 'affiliate-store' && affiliateHandle && (
          <AffiliateStorefrontViewer handle={affiliateHandle} />
        )}

        {currentPage === 'store' && affiliateHandle && (
          <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-lg">Loading Store...</div></div>}>
            <StoreViewer handle={affiliateHandle} />
          </React.Suspense>
        )}

        {currentPage === 'member-dashboard' && (
          auth && auth.isAuthenticated && auth.currentUser ? (
            <MembersDashboard />
          ) : (
            <div className="mx-auto max-w-3xl px-6 py-10">
              {/* Show the onboarding / sales (features) screen to non-members who click "Members" */}
              <FeaturesShowcase />
            </div>
          )
        )}

        {currentPage === 'member-linker' && (
          auth && auth.isAuthenticated && auth.currentUser && (auth.currentUser.emailVerified || process.env.NODE_ENV === 'development') ? (
            <MemberAffiliateLinker />
          ) : (
            <div className="mx-auto max-w-lg px-6 py-10">
              <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-md text-center">
                <h3 className="text-lg font-semibold mb-2">Access Required</h3>
                <p className="text-sm text-gray-600 mb-4">Please log in and verify your email to access the affiliate linker.</p>
                <button className="rounded-lg bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white" onClick={() => setCurrentPage('login')}>Log In</button>
              </div>
            </div>
          )
        )}

        {currentPage === 'standard-mirror-designer' && (
          <StandardMirrorDesigner />
        )}

        {currentPage === 'affiliate-product-accryl' && (
          <AffiliateProductPageCleanAccryl />
        )}

        {currentPage === 'acrylic-composer' && (
          <AcrylicComposerWithMask />
        )}

        {currentPage === 'mail-campaign' && (
          auth && auth.isAuthenticated && auth.currentUser && (auth.currentUser.emailVerified || process.env.NODE_ENV === 'development') ? (
            <MailBuilderDashboard />
          ) : (
            <div className="mx-auto max-w-lg px-6 py-10">
              <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-md text-center">
                <h3 className="text-lg font-semibold mb-2">Access Required</h3>
                <p className="text-sm text-gray-600 mb-4">Please log in and verify your email to access mail campaigns.</p>
                <button className="rounded-lg bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white" onClick={() => setCurrentPage('login')}>Log In</button>
              </div>
            </div>
          )
        )}
        {currentPage === 'email-automation' && (
          auth && auth.isAuthenticated && auth.currentUser && (auth.currentUser.emailVerified || process.env.NODE_ENV === 'development') ? (
            <EmailAutomationDashboard storeId={auth.currentUser?.uid} currentUserId={auth.currentUser?.uid} />
          ) : (
            <div className="mx-auto max-w-lg px-6 py-10">
              <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-md text-center">
                <h3 className="text-lg font-semibold mb-2">Access Required</h3>
                <p className="text-sm text-gray-600 mb-4">Please log in and verify your email to access email automation.</p>
                <button className="rounded-lg bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white" onClick={() => setCurrentPage('login')}>Log In</button>
              </div>
            </div>
          )
        )}
        {currentPage === 'inbox' && (
          <AdvancedInboxScreen />
        )}
      
        {/* Remove the auth requirement message since product page is now accessible */}

        <Footer onNavigate={(page) => setCurrentPage(page)} onProductPageAccess={handleProductPageAccess} />

        {/* demo-nav removed */}

        {/* Affiliate Create Product Modal */}
        <AffiliateCreateProduct
          isOpen={showCreateProductModal}
          onClose={() => setShowCreateProductModal(false)}
          getCurrentUser={() => auth.currentUser ? { uid: auth.currentUser.uid } : null}
        />

        {/* Conversion optimization components - TEMPORARILY DISABLED
        {!auth?.isAuthenticated && (
          <>
            <ExitIntentPopup
              show={showExitIntent}
              onClose={hideExitIntent}
              onEmailSubmit={handleExitIntentEmail}
            />
            <SocialProofBanner />
            <ConversionChatbot
              onLeadCapture={handleChatbotLeadCapture}
              onConversion={handleChatbotConversion}
            />
            <SocialProofWidgets />
          </>
        )}
        */}
      </div>
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/tools/short-review" element={<ShortReviewPage />} />
        <Route path="/tools/stencil-generator" element={<StencilGenerator />} />
        <Route path="/tools/paint-by-numbers" element={<MainScreenPBY />} />
        <Route path="/admin/made-orders" element={<MadeOrders />} />
        <Route path="/my-orders" element={<MyOrders />} />
        <Route path="/onboarding" element={<MailOnboardFull />} />
        <Route path="/mailbuilder/composer" element={<MailBuilderComposerPage />} />
        <Route path="/automationscomposer" element={<AutomationsComposerPage />} />
        <Route path="/mailbuilder/send/:templateId" element={<CampaignSendPage />} />
        {/* Customer Product Page - /product/:ownerId/:productId */}
        <Route path="/product/:ownerId/:productId" element={<CustomerProductPage />} />
        {/* Funnel Viewer - /funnel/:companySlug/:funnelSlug */}
        <Route path="/funnel/:companySlug/:funnelSlug" element={
          <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-lg">Loading Funnel...</div></div>}>
            <FunnelViewer />
          </React.Suspense>
        } />
        <Route path="/store/:handle" element={
          <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-lg">Loading Store...</div></div>}>
            <StoreViewer />
          </React.Suspense>
        } />
        <Route path="/*" element={appUIContent} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
