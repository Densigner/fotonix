import React, { useState, useEffect } from 'react';
import { AlertCircle, CreditCard, Calendar, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// Import the enhanced conversion components
import FeaturesShowcase from '../landing/FeaturesShowcase';
import ValueTestimonials from '../landing/ValueTestimonials';

// Import conversion optimization components
import ExitIntentPopup from '../marketing/ExitIntentPopup';
import SocialProofWidgets, { SocialProofBanner } from '../marketing/SocialProofWidgets';
import ConversionChatbot from '../marketing/ConversionChatbot';
import { useExitIntent } from '../../hooks/useExitIntent';
import { EmailCaptureService } from '../../services/emailCapture';

/**
 * SubscriptionGate Component
 * 
 * Checks if the current member has valid subscription access.
 * Shows payment prompt if subscription is expired or trial ended.
 * 
 * Props:
 * - children: Component to render if subscription is valid
 * - onAccessDenied: Optional callback when access is denied
 */
export default function SubscriptionGate({ children, onAccessDenied }) {
  const { currentUser } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [error, setError] = useState(null);

  // Conversion optimization state - only active when subscription is required
  const { showExitIntent, hideExitIntent } = useExitIntent({
    sensitivity: 20,
    delay: 5000, // 5 seconds minimum on subscription page
    showOnce: true,
    enabled: subscriptionStatus && !subscriptionStatus.hasAccess // Only show when access denied
  });

  // Check subscription status on mount and when user changes
  useEffect(() => {
    // Always check subscription status - even without Firebase currentUser
    // This handles returning users who have valid cookie sessions
    checkSubscriptionStatus();
  }, [currentUser]);

  const checkSubscriptionStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/subscriptions/status', {
        headers: {
          'x-member-uid': currentUser?.uid || (process.env.NODE_ENV === 'development' ? 'current-member-id' : 'cookie-session')
        },
        credentials: 'include' // Ensure cookies are sent
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const status = await response.json();
      
      // Normalize the status object for backwards compatibility
      const normalizedStatus = {
        ...status,
        hasAccess: status.hasSubscription || status.isActive,
        needsPayment: !status.hasSubscription && !status.isActive,
        daysLeft: status.trialDaysLeft || 0
      };
      
      setSubscriptionStatus(normalizedStatus);

      // If user has active trial or subscription, allow access
      if (normalizedStatus.hasAccess) {
        console.log('✅ User has active trial/subscription - granting access');
        // Don't show payment modal for active users
        return;
      }

      // If no access and payment needed, show payment modal
      if (!normalizedStatus.hasAccess && normalizedStatus.needsPayment) {
        setShowPaymentModal(true);
        if (onAccessDenied) {
          onAccessDenied(normalizedStatus);
        }
      }

    } catch (error) {
      console.error('Error checking subscription status:', error);
      
      // For development - grant access when API is unavailable
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Development mode: API unavailable, granting access for development');
        setSubscriptionStatus({
          hasAccess: true,
          needsPayment: false,
          status: 'active',
          daysLeft: 30,
          hasSubscription: true,
          isActive: true
        });
      } else {
        setError('Unable to verify subscription status. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubscription = async () => {
    try {
      setPaypalLoading(true);
      setError(null);

      const response = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-member-uid': currentUser.uid
        },
        body: JSON.stringify({
          memberEmail: currentUser.email,
          memberName: currentUser.displayName || 'Member'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create subscription');
      }

      const result = await response.json();
      
      // Redirect to PayPal for approval
      if (result.approvalUrl) {
        window.location.href = result.approvalUrl;
      } else {
        throw new Error('No approval URL received from PayPal');
      }

    } catch (error) {
      console.error('Error creating subscription:', error);
      setError('Failed to start subscription process. Please try again.');
    } finally {
      setPaypalLoading(false);
    }
  };

  // Handle exit-intent email capture
  const handleExitIntentEmail = async (email) => {
    try {
      await EmailCaptureService.submitLeadMagnet(email, 'subscription-exit-intent');
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
      await EmailCaptureService.submitLeadMagnet(leadData.email, 'subscription-chatbot');
      console.log('Qualified lead captured from subscription page:', leadData);
      return { success: true };
    } catch (error) {
      console.error('Failed to capture chatbot lead:', error);
      throw error;
    }
  };

  // Handle chatbot conversion
  const handleChatbotConversion = () => {
    // User expressed high intent through chatbot - show payment modal
    setShowPaymentModal(true);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-fuchsia-500 border-t-transparent"></div>
          <p className="text-zinc-600">Checking subscription status...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h3 className="text-lg font-semibold text-zinc-900 mb-2">Subscription Check Failed</h3>
          <p className="text-zinc-600 mb-4">{error}</p>
          <button
            onClick={checkSubscriptionStatus}
            className="bg-fuchsia-500 text-white px-4 py-2 rounded-lg hover:bg-fuchsia-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Valid subscription - render children
  if (subscriptionStatus?.hasAccess) {
    return (
      <>
        {children}
        
        {/* Trial notification banner */}
        {subscriptionStatus.status === 'trial' && subscriptionStatus.daysLeft <= 7 && (
          <div className="fixed top-4 right-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 mt-0.5" />
              <div>
                <p className="font-medium">Trial Ending Soon</p>
                <p className="text-sm opacity-90">
                  {subscriptionStatus.daysLeft} days left in your free trial
                </p>
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="mt-2 bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm transition-colors"
                >
                  Subscribe Now
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // No access - show enhanced conversion funnel with features and testimonials
  return (
    <>
      {/* Social Proof Banner for subscription page */}
      <SocialProofBanner />

      {/* Enhanced Conversion Funnel - Features Showcase */}
      <FeaturesShowcase />
      
      {/* Enhanced Conversion Funnel - Value Testimonials */}
      <ValueTestimonials />

      {/* Streamlined Access Denied with Direct CTA */}
      <AccessDeniedMessage 
        subscriptionStatus={subscriptionStatus}
        onSubscribe={() => setShowPaymentModal(true)}
      />
      
      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          subscriptionStatus={subscriptionStatus}
          onClose={() => setShowPaymentModal(false)}
          onCreateSubscription={handleCreateSubscription}
          loading={paypalLoading}
          error={error}
        />
      )}

      {/* Conversion Optimization Components - Only shown on subscription gate */}
      <SocialProofWidgets />

      <ExitIntentPopup
        isOpen={showExitIntent}
        onClose={hideExitIntent}
        onEmailSubmit={handleExitIntentEmail}
      />

      <ConversionChatbot
        onLeadCapture={handleChatbotLeadCapture}
        onConversion={handleChatbotConversion}
        isSubscriptionPage={true}
      />
    </>
  );
}

/**
 * Streamlined Access Denied Message Component - Final CTA after feature showcase
 */
function AccessDeniedMessage({ subscriptionStatus, onSubscribe }) {
  return (
    <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-fuchsia-900 py-24">
      <div className="max-w-4xl mx-auto px-6 text-center text-white">
        {/* Urgency Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-red-500/20 text-red-300 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
            Subscription Required
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Ready to Transform Your Business?
          </h1>
          <p className="text-xl opacity-90 max-w-2xl mx-auto">
            You've seen the features, the savings, the results. Now it's time to get your own success story.
          </p>
        </div>

        {/* Final Value Proposition */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <div className="text-3xl font-bold text-green-400">£285+</div>
            <div className="opacity-90">You'll save monthly</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <div className="text-3xl font-bold text-blue-400">30 Days</div>
            <div className="opacity-90">Completely FREE</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <div className="text-3xl font-bold text-yellow-400">24/7</div>
            <div className="opacity-90">Expert Support</div>
          </div>
        </div>

        {/* Pricing Card */}
        <div className="max-w-lg mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden text-gray-900 mb-8">
          {/* Pricing Header */}
          <div className="bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white p-8">
            <div className="text-sm opacity-90 uppercase tracking-wide">Professional Plan</div>
            <div className="text-5xl font-bold my-2">£11.99</div>
            <div className="opacity-90">per month</div>
            {subscriptionStatus?.status !== 'trial' && (
              <div className="bg-white/20 rounded-full px-4 py-2 mt-4 inline-block">
                <span className="font-bold">🎁 First month FREE</span>
              </div>
            )}
          </div>
          
          {/* Quick Benefits */}
          <div className="p-8">
            <div className="space-y-3 mb-8 text-sm">
              <div className="flex items-center justify-between">
                <span>vs. Buying tools separately:</span>
                <span className="font-bold text-green-600">Save £285/month</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Setup & onboarding:</span>
                <span className="font-bold text-purple-600">FREE ($500 value)</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Cancel anytime:</span>
                <span className="font-bold text-blue-600">No contracts</span>
              </div>
            </div>
            
            <button
              onClick={onSubscribe}
              className="w-full bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-bold py-4 px-8 rounded-xl hover:from-fuchsia-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl text-lg"
            >
              Start Your FREE 30-Day Trial →
            </button>
            
            <div className="text-xs text-gray-500 mt-4">
              No credit card required • Instant access • Cancel anytime
            </div>
          </div>
        </div>

        {/* Trust & Guarantee */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 text-sm opacity-80">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <span>12,000+ happy customers</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <span>30-day money-back guarantee</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <span>Cancel anytime with 1-click</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Interactive ROI Calculator Component
 */
function ROICalculator() {
  const [monthlyRevenue, setMonthlyRevenue] = useState(10000);
  const [currentAffiliates, setCurrentAffiliates] = useState(5);
  
  // Calculations based on Fotonix averages
  const projectedAffiliates = Math.min(currentAffiliates * 4.2, 500); // 320% average increase, capped
  const affiliateRevenue = monthlyRevenue * 0.23; // 23% average from affiliates
  const projectedAffiliateRevenue = affiliateRevenue * 2.47; // 247% increase
  const additionalRevenue = projectedAffiliateRevenue - affiliateRevenue;
  const roi = ((additionalRevenue - 11.99) / 11.99) * 100;
  const paybackDays = Math.max(1, Math.floor((11.99 / (additionalRevenue / 30))));

  return (
    <div className="bg-white rounded-2xl p-8 shadow-lg">
      <div className="grid md:grid-cols-2 gap-8">
        
        {/* Inputs */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Monthly Revenue
            </label>
            <input
              type="range"
              min="1000"
              max="100000"
              step="1000"
              value={monthlyRevenue}
              onChange={(e) => setMonthlyRevenue(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="text-center font-bold text-lg text-slate-900 mt-2">
              £{monthlyRevenue.toLocaleString()}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Current Affiliates
            </label>
            <input
              type="range" 
              min="0"
              max="50"
              step="1"
              value={currentAffiliates}
              onChange={(e) => setCurrentAffiliates(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="text-center font-bold text-lg text-slate-900 mt-2">
              {currentAffiliates}
            </div>
          </div>
        </div>
        
        {/* Results */}
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4">
            <div className="text-sm text-green-700 mb-1">Projected Monthly Increase</div>
            <div className="text-2xl font-bold text-green-900">
              +£{Math.round(additionalRevenue).toLocaleString()}
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4">
            <div className="text-sm text-blue-700 mb-1">ROI</div>
            <div className="text-2xl font-bold text-blue-900">
              {Math.round(roi).toLocaleString()}%
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-purple-50 to-fuchsia-50 rounded-lg p-4">
            <div className="text-sm text-purple-700 mb-1">Payback Period</div>
            <div className="text-2xl font-bold text-purple-900">
              {paybackDays} day{paybackDays !== 1 ? 's' : ''}
            </div>
          </div>
          
          <div className="text-xs text-slate-500 mt-4">
            * Based on average results from 1,200+ Fotonix users
          </div>
        </div>
        
      </div>
    </div>
  );
}

/**
 * Payment Modal Component
 */
function PaymentModal({ subscriptionStatus, onClose, onCreateSubscription, loading, error }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-zinc-900">Subscribe to Fotonix</h3>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Subscription Details */}
          <div className="text-center mb-6">
            <div className="text-4xl font-bold text-zinc-900 mb-2">£11.99</div>
            <div className="text-zinc-600">per month</div>
            {subscriptionStatus?.status !== 'trial' && (
              <div className="text-sm text-green-600 mt-1">+ 1 month free trial</div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* PayPal Button */}
          <button
            onClick={onCreateSubscription}
            disabled={loading}
            className="w-full bg-[#0070ba] hover:bg-[#005ea6] text-white font-semibold py-4 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                Setting up subscription...
              </>
            ) : (
              'Continue with PayPal'
            )}
          </button>

          <p className="text-xs text-zinc-500 text-center mt-4">
            You'll be redirected to PayPal to complete your subscription. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}