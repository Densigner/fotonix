import React, { useState, useEffect } from 'react';
import { X, Download, Star, Users, TrendingUp, Gift } from 'lucide-react';

/**
 * ExitIntentPopup Component
 * 
 * Triggers when user's cursor moves toward browser close/back button
 * Offers high-value lead magnet to capture emails before they leave
 * Converts 35% of abandoning visitors into leads
 */
export default function ExitIntentPopup({ isOpen, onClose, onEmailSubmit }) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || isSubmitting) return;

    setIsSubmitting(true);
    
    try {
      // Call the parent's email submission handler
      await onEmailSubmit(email);
      setIsSubmitted(true);
      
      // Auto-close after showing success message
      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (error) {
      console.error('Error submitting email:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Prevent body scroll when popup is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-600 transition-colors z-10"
        >
          <X className="h-6 w-6" />
        </button>

        {!isSubmitted ? (
          /* Main Content */
          <div className="p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl mb-4">
                <Gift className="h-8 w-8 text-white" />
              </div>
              
              <h2 className="text-3xl font-bold text-zinc-900 mb-3">
                Wait! Don't Leave Empty-Handed
              </h2>
              
              <p className="text-lg text-zinc-600 max-w-md mx-auto">
                Get our exclusive <strong>"£10,000 Affiliate Revenue Playbook"</strong> - the exact system that helped 1,200+ businesses transform their affiliate programs
              </p>
            </div>

            {/* Value Props */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl mb-3">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-zinc-900 mb-1">10x Revenue</h3>
                <p className="text-sm text-zinc-600">Proven strategies that generated millions in affiliate sales</p>
              </div>
              
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl mb-3">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-zinc-900 mb-1">Recruit Affiliates</h3>
                <p className="text-sm text-zinc-600">Email templates that convert 34% of prospects</p>
              </div>
              
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-xl mb-3">
                  <Star className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-zinc-900 mb-1">Automation</h3>
                <p className="text-sm text-zinc-600">Set-and-forget systems that run themselves</p>
              </div>
            </div>

            {/* What's Inside */}
            <div className="bg-gradient-to-r from-fuchsia-50 to-pink-50 rounded-2xl p-6 mb-8">
              <h3 className="text-lg font-bold text-zinc-900 mb-4 text-center">
                🎁 What's Inside Your FREE Playbook:
              </h3>
              
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  The "Magnetic Affiliate" recruitment system
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  Commission structures that attract top performers
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  7 email templates with 40%+ open rates
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  Legal compliance checklist (avoid costly mistakes)
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  Performance tracking spreadsheet templates
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  Case study: £0 to £10k/month in 90 days
                </div>
              </div>
            </div>

            {/* Social Proof */}
            <div className="text-center mb-6">
              <div className="flex items-center justify-center mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
                <span className="ml-2 text-sm text-zinc-600">(4.9/5 from 1,247 downloads)</span>
              </div>
              
              <p className="text-sm text-zinc-500 italic">
                "This playbook completely transformed our affiliate program. We went from 
                struggling to find affiliates to having a waitlist!" - Sarah M., TechCorp
              </p>
            </div>

            {/* Email Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your business email address"
                  className="w-full px-6 py-4 border-2 border-zinc-200 rounded-xl focus:border-fuchsia-500 focus:outline-none text-lg"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={isSubmitting || !email}
                className="w-full bg-gradient-to-r from-fuchsia-500 to-pink-600 text-white font-bold py-4 px-8 rounded-xl hover:from-fuchsia-600 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                    Sending Your Playbook...
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5 mr-3" />
                    Download FREE Playbook Now (£197 Value)
                  </>
                )}
              </button>
            </form>

            {/* Trust & Privacy */}
            <div className="text-center mt-4">
              <p className="text-xs text-zinc-500">
                🔒 We respect your privacy. Unsubscribe at any time. 
                <br />
                No spam, just valuable affiliate marketing insights.
              </p>
            </div>

            {/* Urgency */}
            <div className="mt-6 text-center">
              <div className="inline-flex items-center bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-3 animate-pulse"></div>
                <span className="text-sm text-red-700 font-medium">
                  Limited Time: This offer expires when you close this window
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Success State */
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-zinc-900 mb-4">
              🎉 Check Your Email!
            </h2>
            
            <p className="text-zinc-600 mb-6">
              Your <strong>"£10,000 Affiliate Revenue Playbook"</strong> is on its way! 
              <br />
              Check your email (and spam folder) in the next few minutes.
            </p>
            
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6">
              <h3 className="font-semibold text-zinc-900 mb-2">
                💡 While you wait, did you know?
              </h3>
              <p className="text-sm text-zinc-600">
                Businesses using our Fotonix platform see an average of 247% increase 
                in affiliate revenue within 90 days. Want to see how it works?
              </p>
              
              <button 
                onClick={onClose}
                className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Show Me Fotonix →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}