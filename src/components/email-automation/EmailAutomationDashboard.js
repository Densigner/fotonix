import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, Send, Edit3, Eye, Clock, Users, TrendingUp, 
  Zap, Settings, ChevronRight, CheckCircle2, X,
  Calendar, Target, BarChart3, Sparkles, ArrowRight,
  FileText, Save, Plus, Trash2, Copy
} from 'lucide-react';
import { db } from '../../firebase';
import { ref, get, set, update } from 'firebase/database';
import EmailComposer from './EmailComposer';

/**
 * Email Automation Dashboard
 * 
 * Main dashboard for managing automated email campaigns
 * Displays all 7 campaign types with edit functionality
 */
export default function EmailAutomationDashboard({ storeId, currentUserId }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showComposer, setShowComposer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);

  // Campaign Types Configuration
  const CAMPAIGN_TYPES = [
    {
      id: 'post-purchase',
      name: 'Post-Purchase Journey',
      icon: '🎉',
      color: 'purple',
      description: 'Automated emails sent after each purchase',
      emails: [
        { id: 'thank-you', name: 'Thank You Email', delay: '0 hours', trigger: 'Immediately after purchase' },
        { id: 'usage-guide', name: 'Usage Guide/Instructions', delay: '24 hours', trigger: '1 day after purchase' },
        { id: 'recommended-addon', name: 'Recommended Add-on', delay: '3 days', trigger: '3 days after purchase' },
        { id: 'request-review', name: 'Request a Review', delay: '7 days', trigger: '1 week after purchase' },
        { id: 'vip-discount', name: 'VIP Discount', delay: '14 days', trigger: '2 weeks after purchase' }
      ]
    },
    {
      id: 'win-back',
      name: 'Win-Back Campaigns',
      icon: '💜',
      color: 'pink',
      description: 'Re-engage customers who haven\'t purchased recently',
      emails: [
        { id: 'we-miss-you', name: 'We Miss You Email', delay: '30 days', trigger: '30 days inactive' },
        { id: 'product-suggestion', name: 'Product Suggestion', delay: '60 days', trigger: '60 days inactive' },
        { id: 'personalized-offer', name: 'Personalized Offer', delay: '90 days', trigger: '90 days inactive' }
      ]
    },
    {
      id: 'abandoned-cart',
      name: 'Abandoned Cart Emails',
      icon: '🛒',
      color: 'orange',
      description: 'Recover lost sales from abandoned carts',
      emails: [
        { id: 'cart-reminder', name: 'Reminder Email', delay: '1 hour', trigger: '1 hour after abandonment' },
        { id: 'need-help', name: 'Need Help? Follow-up', delay: '24 hours', trigger: '1 day after abandonment' },
        { id: 'discount-offer', name: 'Small Discount (3rd attempt)', delay: '3 days', trigger: '3 days after abandonment' }
      ]
    },
    {
      id: 'one-click-upsell',
      name: 'One-Click Upsell Emails',
      icon: '⚡',
      color: 'yellow',
      description: 'Increase order value with post-purchase upsells',
      emails: [
        { id: 'deluxe-upgrade', name: 'Upgrade to Deluxe Version', delay: '1 hour', trigger: '1 hour after purchase' },
        { id: 'accessory-offer', name: 'Add Accessory at 20% Off', delay: '24 hours', trigger: '1 day after purchase' },
        { id: 'customers-bought', name: 'Customers Also Bought', delay: '3 days', trigger: '3 days after purchase' }
      ]
    },
    {
      id: 'personalized-recommendations',
      name: 'Personalized Recommendation Emails',
      icon: '🎯',
      color: 'blue',
      description: 'AI-based product suggestions',
      emails: [
        { id: 'past-purchases', name: 'Based on Past Purchases', delay: 'Weekly', trigger: 'Every week' },
        { id: 'browsing-history', name: 'Based on Browsing', delay: 'Weekly', trigger: 'Every week' },
        { id: 'style-matching', name: 'Style Matching Products', delay: 'Weekly', trigger: 'Every week' }
      ]
    },
    {
      id: 'follow-up-after-use',
      name: 'Automated Follow-Up After Product Use',
      icon: '📸',
      color: 'green',
      description: 'Build relationships after product delivery',
      emails: [
        { id: 'check-in-7day', name: 'How\'s It Going? (7 days)', delay: '7 days', trigger: '7 days after delivery' },
        { id: 'photo-incentive', name: 'Send Photo for 10% Off (14 days)', delay: '14 days', trigger: '14 days after delivery' },
        { id: 'matching-piece', name: 'Want a Matching Piece? (30 days)', delay: '30 days', trigger: '30 days after delivery' }
      ]
    },
    {
      id: 'anniversary-emails',
      name: 'Anniversary / Memory Lane Emails',
      icon: '🎂',
      color: 'indigo',
      description: 'Powerful reactivation strategy',
      emails: [
        { id: 'anniversary-reminder', name: 'This Time Last Year...', delay: '1 year', trigger: '1 year after purchase' },
        { id: 'upgrade-offer', name: 'Upgraded Version Available', delay: '1 year', trigger: '1 year after purchase' },
        { id: 'matching-products', name: 'Matching LED/Acrylic Pieces', delay: '1 year', trigger: '1 year after purchase' }
      ]
    }
  ];

  // Load campaigns from Firebase
  useEffect(() => {
    loadCampaigns();
    loadAnalytics();
  }, [storeId]);

  async function loadCampaigns() {
    try {
      setLoading(true);
      const campaignsRef = ref(db, `stores/${storeId}/emailAutomation/campaigns`);
      const snapshot = await get(campaignsRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        setCampaigns(data);
      }
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAnalytics() {
    try {
      const analyticsRef = ref(db, `stores/${storeId}/emailAnalytics`);
      const snapshot = await get(analyticsRef);
      
      if (snapshot.exists()) {
        setAnalytics(snapshot.val());
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  }

  function openEmailComposer(campaign, email) {
    setSelectedCampaign(campaign);
    setSelectedEmail(email);
    setShowComposer(true);
  }

  function closeComposer() {
    setShowComposer(false);
    setSelectedCampaign(null);
    setSelectedEmail(null);
  }

  async function saveEmailTemplate(templateData) {
    try {
      const templateRef = ref(
        db, 
        `stores/${storeId}/emailTemplates/${selectedCampaign.id}/${selectedEmail.id}`
      );
      
      await set(templateRef, {
        ...templateData,
        campaignId: selectedCampaign.id,
        emailId: selectedEmail.id,
        updatedAt: Date.now(),
        updatedBy: currentUserId
      });

      console.log('✅ Email template saved');
      closeComposer();
      loadCampaigns();
    } catch (error) {
      console.error('Error saving template:', error);
      throw error;
    }
  }

  const getColorClasses = (color) => {
    const colors = {
      purple: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100',
      pink: 'bg-pink-50 border-pink-200 text-pink-700 hover:bg-pink-100',
      orange: 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100',
      yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100',
      blue: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
      green: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100',
      indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
    };
    return colors[color] || colors.purple;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Mail className="h-8 w-8 text-purple-600" />
            Email Automation Dashboard
          </h1>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              View Analytics
            </button>
            <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </div>
        </div>
        <p className="text-gray-600">
          Manage your automated email campaigns to boost revenue and retention
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm font-medium">Active Campaigns</span>
            <Zap className="h-5 w-5 text-purple-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {CAMPAIGN_TYPES.filter(c => campaigns[c.id]?.enabled).length}
          </div>
          <div className="text-xs text-gray-500 mt-1">of {CAMPAIGN_TYPES.length} available</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm font-medium">Emails Sent</span>
            <Send className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">1,247</div>
          <div className="text-xs text-green-600 mt-1">↑ 23% this month</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm font-medium">Open Rate</span>
            <Eye className="h-5 w-5 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">42.5%</div>
          <div className="text-xs text-green-600 mt-1">↑ 5.2% vs avg</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm font-medium">Revenue Generated</span>
            <TrendingUp className="h-5 w-5 text-orange-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">£3,842</div>
          <div className="text-xs text-green-600 mt-1">↑ 18% this month</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200">
        {['overview', 'automations', 'analytics', 'settings'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`
              px-6 py-3 font-medium transition-all relative
              ${activeTab === tab
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-900'
              }
            `}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Automations Tab Content */}
      {activeTab === 'automations' && (
        <div className="space-y-6">
          {CAMPAIGN_TYPES.map((campaign) => (
            <motion.div
              key={campaign.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
            >
              {/* Campaign Header */}
              <div className={`p-6 border-b ${getColorClasses(campaign.color)}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-4xl">{campaign.icon}</div>
                    <div>
                      <h3 className="text-xl font-bold">{campaign.name}</h3>
                      <p className="text-sm opacity-80 mt-1">{campaign.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right mr-4">
                      <div className="text-2xl font-bold">{campaign.emails.length}</div>
                      <div className="text-xs opacity-70">emails</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={campaigns[campaign.id]?.enabled || false}
                        onChange={(e) => {
                          const updatedCampaigns = {
                            ...campaigns,
                            [campaign.id]: {
                              ...campaigns[campaign.id],
                              enabled: e.target.checked
                            }
                          };
                          setCampaigns(updatedCampaigns);
                          
                          // Save to Firebase
                          const campaignRef = ref(db, `stores/${storeId}/emailAutomation/campaigns/${campaign.id}/enabled`);
                          set(campaignRef, e.target.checked);
                        }}
                      />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Email List */}
              <div className="p-6">
                <div className="space-y-3">
                  {campaign.emails.map((email, idx) => (
                    <motion.div
                      key={email.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="group flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all border border-gray-200"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center font-bold text-gray-700">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{email.name}</h4>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-xs text-gray-600 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {email.delay}
                            </span>
                            <span className="text-xs text-gray-500">
                              {email.trigger}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEmailComposer(campaign, email)}
                          className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm font-medium text-gray-700 transition-all group-hover:border-purple-300 group-hover:text-purple-600"
                        >
                          <Edit3 className="h-4 w-4" />
                          Edit Email
                        </button>
                        
                        <button className="p-2 text-gray-400 hover:text-purple-600 transition-all">
                          <Eye className="h-5 w-5" />
                        </button>
                        
                        <button className="p-2 text-gray-400 hover:text-blue-600 transition-all">
                          <Copy className="h-5 w-5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Add Custom Email Button */}
                <button className="mt-4 w-full p-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-purple-400 hover:text-purple-600 transition-all flex items-center justify-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add Custom Email to this Campaign
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <h3 className="text-lg font-bold mb-4">Campaign Performance</h3>
            <div className="space-y-3">
              {CAMPAIGN_TYPES.slice(0, 4).map((campaign) => (
                <div key={campaign.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{campaign.icon}</span>
                    <span className="font-medium text-sm">{campaign.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">+£487</div>
                    <div className="text-xs text-gray-500">this month</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">Email sent successfully</div>
                    <div className="text-xs text-gray-500">2 minutes ago</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Email Composer Modal */}
      <AnimatePresence>
        {showComposer && (
          <EmailComposer
            campaign={selectedCampaign}
            email={selectedEmail}
            storeId={storeId}
            onSave={saveEmailTemplate}
            onClose={closeComposer}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
