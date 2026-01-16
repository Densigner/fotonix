import React, { useState } from 'react';
import { Star, Quote, TrendingUp, DollarSign, Users, CheckCircle } from 'lucide-react';
import FreeTrialSignup from '../payments/FreeTrialSignup';

export default function ValueTestimonials() {
  const [showSignupModal, setShowSignupModal] = useState(false);
  const testimonials = [
    {
      name: "Sarah Mitchell",
      role: "E-commerce Entrepreneur",
      business: "Fashion Boutique",
      revenue: "£15,000/month",
      savings: "£240/month",
      quote: "I was paying £252/month for separate tools - email marketing, funnel builder, analytics, shop hosting. Fotonix gave me everything for £11.99. My ROI went through the roof!",
      results: "340% ROI increase",
      avatar: "SM",
      verified: true
    },
    {
      name: "Marcus Thompson",
      role: "Affiliate Marketer",
      business: "Digital Products",
      revenue: "£8,500/month", 
      savings: "£180/month",
      quote: "The link tracking and AI shorts analyzer alone are worth more than £11.99. Add the email campaigns and funnel builder? This is insane value.",
      results: "67% conversion boost",
      avatar: "MT",
      verified: true
    },
    {
      name: "Lisa Chen",
      role: "Content Creator",
      business: "Online Courses",
      revenue: "£12,000/month",
      savings: "£310/month",
      quote: "I tried building funnels with Clickfunnels (£97/mo), emails with Mailchimp (£45/mo), and analytics with others. Fotonix does it all better for £11.99.",
      results: "£3,720 yearly savings",
      avatar: "LC",
      verified: true
    },
    {
      name: "James Rodriguez",
      role: "Small Business Owner", 
      business: "Local Services",
      revenue: "£6,800/month",
      savings: "£285/month",
      quote: "The hosted shops and PayPal integration saved me from hiring a developer. What would cost £2,000+ to build is included for pennies.",
      results: "£2,000+ dev savings",
      avatar: "JR",
      verified: true
    }
  ];

  const comparisonTools = [
    { name: "ClickFunnels", price: "£97", feature: "Funnel Building" },
    { name: "Mailchimp Pro", price: "£45", feature: "Email Campaigns" },
    { name: "Shopify Plus", price: "£79", feature: "Shop Hosting" },
    { name: "Google Analytics 360", price: "£42", feature: "Analytics" },
    { name: "Zapier Professional", price: "£35", feature: "Automation" }
  ];

  const totalCompetitorCost = comparisonTools.reduce((sum, tool) => sum + parseInt(tool.price.replace('£', '')), 0);

  return (
    <section className="py-24 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <TrendingUp className="w-4 h-4" />
            Real Results from Real Businesses
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
            Why Smart Businesses Choose <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Fotonix</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Our members save an average of <span className="font-bold text-green-600">£285/month</span> while growing their businesses faster than ever.
          </p>
        </div>

        {/* Cost Comparison */}
        <div className="mb-20">
          <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-lg">
            <h3 className="text-2xl font-bold text-center mb-8">What You'd Pay Elsewhere vs. Fotonix</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              {/* Competitors */}
              <div>
                <h4 className="text-lg font-semibold mb-6 text-gray-700">Separate Tools (The Old Way)</h4>
                <div className="space-y-3">
                  {comparisonTools.map((tool, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-200">
                      <div>
                        <div className="font-medium text-gray-900">{tool.name}</div>
                        <div className="text-sm text-gray-500">{tool.feature}</div>
                      </div>
                      <div className="font-bold text-red-600">{tool.price}/mo</div>
                    </div>
                  ))}
                  <div className="border-t border-red-300 pt-3 mt-4">
                    <div className="flex justify-between items-center font-bold text-lg">
                      <span className="text-gray-900">Total Monthly Cost:</span>
                      <span className="text-red-600 text-2xl">£{totalCompetitorCost}/mo</span>
                    </div>
                    <div className="text-center text-red-500 text-sm mt-2">+ Setup fees, integration costs, support tickets...</div>
                  </div>
                </div>
              </div>

              {/* Fotonix */}
              <div>
                <h4 className="text-lg font-semibold mb-6 text-gray-700">Fotonix Platform (The Smart Way)</h4>
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-8 text-white">
                  <div className="text-center mb-6">
                    <div className="text-sm opacity-90 mb-2">All Features Included</div>
                    <div className="text-5xl font-bold mb-2">£11.99</div>
                    <div className="text-purple-100">per month</div>
                    <div className="bg-white/20 rounded-lg px-3 py-1 text-sm font-medium mt-3 inline-block">
                      + 1 Month FREE
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      <span>Email Campaigns</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      <span>Funnel Builder</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      <span>Shop Hosting</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      <span>Analytics Suite</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      <span>AI Tools</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      <span>24/7 Support</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-green-50 rounded-lg p-4 mt-6 border border-green-200">
                  <div className="text-center">
                    <div className="text-green-700 font-semibold">You Save</div>
                    <div className="text-3xl font-bold text-green-600">£{totalCompetitorCost - 12}/month</div>
                    <div className="text-green-600 text-sm">That's £{(totalCompetitorCost - 12) * 12} per year!</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="group">
              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">{testimonial.name}</h4>
                        {testimonial.verified && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{testimonial.role}</div>
                      <div className="text-xs text-purple-600 font-medium">{testimonial.business}</div>
                    </div>
                  </div>
                  <Quote className="w-6 h-6 text-purple-300" />
                </div>

                {/* Quote */}
                <blockquote className="text-gray-700 mb-6 leading-relaxed">
                  "{testimonial.quote}"
                </blockquote>

                {/* Results */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="text-center">
                    <div className="text-sm text-gray-500 mb-1">Monthly Savings</div>
                    <div className="font-bold text-green-600">{testimonial.savings}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500 mb-1">Key Result</div>
                    <div className="font-bold text-purple-600 text-sm">{testimonial.results}</div>
                  </div>
                </div>

                {/* Stars */}
                <div className="flex gap-1 mt-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl p-12 text-white shadow-2xl">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">
              Join 12,000+ Smart Business Owners
            </h3>
            <p className="text-purple-100 text-lg mb-8 max-w-2xl mx-auto">
              Stop overpaying for separate tools. Get everything you need to grow your business in one platform.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8">
              <div className="bg-white/20 rounded-2xl p-6 text-center">
                <div className="text-3xl font-bold">£11.99</div>
                <div className="text-purple-100 text-sm">per month</div>
              </div>
              <div className="text-2xl font-bold">+</div>
              <div className="bg-white/20 rounded-2xl p-6 text-center">
                <div className="text-3xl font-bold">30 Days</div>
                <div className="text-purple-100 text-sm">completely FREE</div>
              </div>
              <div className="text-2xl font-bold">=</div>
              <div className="bg-yellow-400 text-purple-900 rounded-2xl p-6 text-center">
                <div className="text-3xl font-bold">£285+</div>
                <div className="text-purple-800 text-sm">saved monthly</div>
              </div>
            </div>

            <button 
              onClick={() => setShowSignupModal(true)}
              className="bg-white text-purple-600 px-12 py-4 rounded-2xl font-bold text-xl hover:bg-purple-50 transition-colors shadow-lg"
            >
              Start Your FREE 30-Day Trial →
            </button>
            
            <p className="text-purple-200 text-sm mt-4">
              No credit card required • Cancel anytime • Setup takes 2 minutes
            </p>
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