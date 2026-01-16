import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Zap, Store, BarChart3, Bot, Link2, CreditCard, Video, Palette, Users, Radio } from 'lucide-react';
import FreeTrialSignup from '../payments/FreeTrialSignup';

export default function FeaturesShowcase() {
  const [showSignupModal, setShowSignupModal] = useState(false);
  const navigate = useNavigate();
  
  const features = [
    {
      icon: Mail,
      title: "AI-Powered Email Campaigns",
      description: "Build conversion-optimized email sequences with left-in-cart recovery, follow-up sequences, and fine-tuned click tracking. All campaigns are pre-built for maximum conversion rates.",
      highlight: "40%+ open rates",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: Zap,
      title: "Masterful Funnel Builder", 
      description: "Create proven-to-convert funnels with integrated chatbots, A/B testing, and conversion tracking. Use our pre-existing models or build custom funnels from scratch.",
      highlight: "67% conversion boost",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: Store,
      title: "Advanced Shop Builder",
      description: "Create products, set commission rates, and pick from your affiliate network. Build professional storefronts with custom branding and automated product management.",
      highlight: "Commission automation", 
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: Video,
      title: "AI Shorts Analyzer",
      description: "Upload your video content and get detailed AI analysis on where improvements can be made. Optimize your shorts for maximum engagement and conversion.",
      highlight: "AI-powered insights",
      color: "from-red-500 to-orange-500"
    },
    {
      icon: Link2,
      title: "Cross-Platform Link Tracking",
      description: "Fully trackable link building with advanced analytics. Know what works when and where with features specifically aimed at cross-platform conversion (TikTok to YouTube, YouTube to funnel, etc.).",
      highlight: "Real-time analytics",
      color: "from-indigo-500 to-purple-500"
    },
    {
      icon: Radio,
      title: "Reddit Community Discovery",
      description: "Find dormant subreddits in your niche with existing members, search visibility, and brand recognition. Revive inactive communities and tap into built-in audiences ready for engagement.",
      highlight: "Untapped audiences",
      color: "from-orange-500 to-red-500"
    },
    {
      icon: Users,
      title: "Hosted Shops with Custom Links",
      description: "Your shops get their own professional links that you can share with your audience. Complete hosting solution with performance optimization and mobile-responsive design.",
      highlight: "Professional hosting",
      color: "from-teal-500 to-blue-500"
    },
    {
      icon: CreditCard,
      title: "Full PayPal Integration",
      description: "Seamless payment processing with automated commission payouts, subscription management, and comprehensive financial tracking. Handle all transactions professionally.",
      highlight: "Automated payouts",
      color: "from-yellow-500 to-orange-500"
    },
    {
      icon: BarChart3,
      title: "Advanced Analytics Dashboard",
      description: "Track every metric that matters - conversion rates, affiliate performance, revenue attribution, click-through rates, and comprehensive business intelligence.",
      highlight: "Business intelligence",
      color: "from-rose-500 to-pink-500"
    }
  ];

  return (
    <section id="features-showcase" className="py-24 bg-gradient-to-b from-purple-50 to-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
            Everything You Need to <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Grow Your Business</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Stop paying for multiple tools that don't work together. Get all the features you need in one powerful platform for just <span className="font-bold text-purple-600">£11.99/month</span>.
          </p>
          
          {/* Pricing Comparison */}
          <div className="inline-flex items-center gap-4 bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <div className="text-center">
              <div className="text-sm text-gray-500">Typical Cost</div>
              <div className="text-2xl font-bold text-gray-400 line-through">£297/month</div>
            </div>
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">VS</span>
            </div>
            <div className="text-center">
              <div className="text-sm text-purple-600 font-medium">Fotonix Platform</div>
              <div className="text-2xl font-bold text-purple-600">£11.99/month</div>
              <div className="text-xs text-green-600 font-medium">+ 1 Month FREE</div>
            </div>
          </div>
        </div>

        {/* Features Grid - Stacked & Centered */}
        <div className="max-w-4xl mx-auto space-y-6">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div key={index} className="group">
                <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 hover:border-purple-200">
                  {/* Icon & Badge Row */}
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-r ${feature.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                      <IconComponent className="w-7 h-7 text-white" />
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-sm font-semibold bg-gradient-to-r ${feature.color} text-white shadow-md`}>
                      {feature.highlight}
                    </span>
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-2xl font-bold text-gray-900 text-center mb-3">{feature.title}</h3>
                  
                  {/* Description */}
                  <p className="text-gray-600 leading-relaxed text-center max-w-2xl mx-auto">{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Value Proposition - Centered Row */}
        <div className="mt-16 flex flex-wrap justify-center gap-6 max-w-3xl mx-auto">
          <div className="bg-gradient-to-br from-purple-50 to-white rounded-2xl p-6 border border-purple-100 shadow-sm text-center min-w-[180px]">
            <div className="text-4xl font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-1">30 Days</div>
            <div className="text-gray-800 font-semibold">Completely FREE</div>
            <div className="text-xs text-gray-500 mt-1">No credit card required</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-white rounded-2xl p-6 border border-green-100 shadow-sm text-center min-w-[180px]">
            <div className="text-4xl font-extrabold text-green-600 mb-1">£285+</div>
            <div className="text-gray-800 font-semibold">Monthly Savings</div>
            <div className="text-xs text-gray-500 mt-1">vs. buying separately</div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl p-6 border border-blue-100 shadow-sm text-center min-w-[180px]">
            <div className="text-4xl font-extrabold text-blue-600 mb-1">24/7</div>
            <div className="text-gray-800 font-semibold">Support</div>
            <div className="text-xs text-gray-500 mt-1">Always here to help</div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <div className="inline-flex flex-col sm:flex-row items-center gap-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl p-8 shadow-xl">
            <div className="text-center sm:text-left">
              <div className="text-2xl font-bold mb-2">Ready to transform your business?</div>
              <div className="text-purple-100">Start your free trial today - no credit card required</div>
            </div>
            <button
              onClick={() => { try { window?.dataLayer?.push?.({ event: 'start_free_trial_clicked', source: 'features_showcase' }); } catch(e){}; window.location.href = '/#signup'; }}
              className="bg-white text-purple-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-purple-50 transition-colors whitespace-nowrap shadow-lg"
            >
              Start FREE Trial →
            </button>
          </div>
        </div>
      </div>

      {/* Free Trial Signup Modal */}
      <FreeTrialSignup 
        isOpen={showSignupModal}
        onClose={() => setShowSignupModal(false)}
        onSuccess={(userData) => {
          console.log('User signed up:', userData);
          // You can add success tracking, redirect to dashboard, etc.
        }}
      />
    </section>
  );
}