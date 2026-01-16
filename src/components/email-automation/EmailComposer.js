import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  X, Save, Eye, Code, Type, Image as ImageIcon, 
  Link2, Sparkles, Bold, Italic, List, AlignLeft,
  Zap, Settings, Mail, Send, ChevronDown, ChevronRight
} from 'lucide-react';
import { db } from '../../firebase';
import { ref, get } from 'firebase/database';

/**
 * Email Composer
 * 
 * Rich text editor for creating and editing email templates
 * Includes preview, variables, and AI assistance
 */
export default function EmailComposer({ campaign, email, storeId, onSave, onClose }) {
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [showAIAssist, setShowAIAssist] = useState(false);

  // Available variables for personalization
  const VARIABLES = [
    { key: '{{customer_name}}', label: 'Customer Name', category: 'Customer' },
    { key: '{{customer_email}}', label: 'Customer Email', category: 'Customer' },
    { key: '{{store_name}}', label: 'Store Name', category: 'Store' },
    { key: '{{product_name}}', label: 'Product Name', category: 'Order' },
    { key: '{{order_total}}', label: 'Order Total', category: 'Order' },
    { key: '{{order_date}}', label: 'Order Date', category: 'Order' },
    { key: '{{discount_code}}', label: 'Discount Code', category: 'Promotion' },
    { key: '{{tracking_number}}', label: 'Tracking Number', category: 'Shipping' },
    { key: '{{review_link}}', label: 'Review Link', category: 'Links' },
    { key: '{{store_url}}', label: 'Store URL', category: 'Links' }
  ];

  // Email templates based on email type
  const DEFAULT_TEMPLATES = {
    'thank-you': {
      subject: 'Thank you for your order, {{customer_name}}! 🎉',
      preview: 'Your order is confirmed and on its way',
      body: `<h1 style="color: #8B5CF6;">Thank You for Your Order!</h1>
<p>Hi {{customer_name}},</p>
<p>We're absolutely thrilled that you chose {{store_name}}! Your order has been confirmed and we're getting it ready for you.</p>

<div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3>Order Details</h3>
  <p><strong>Order Total:</strong> {{order_total}}</p>
  <p><strong>Order Date:</strong> {{order_date}}</p>
  <p><strong>Product:</strong> {{product_name}}</p>
</div>

<p>We'll send you another email with tracking information as soon as your order ships.</p>

<p>If you have any questions, just reply to this email - we're here to help!</p>

<p>Thanks again,<br>The {{store_name}} Team</p>`
    },
    'usage-guide': {
      subject: 'Getting started with your {{product_name}}',
      preview: 'Here\'s everything you need to know',
      body: `<h1>Getting Started with Your {{product_name}}</h1>
<p>Hi {{customer_name}},</p>
<p>Now that your {{product_name}} has arrived, here's a quick guide to help you get the most out of it!</p>

<h3>Quick Start Guide</h3>
<ol>
  <li><strong>Unbox carefully</strong> - All parts should be included</li>
  <li><strong>Follow the setup instructions</strong> - Takes about 5 minutes</li>
  <li><strong>Enjoy your product!</strong> - You're all set</li>
</ol>

<h3>Pro Tips</h3>
<ul>
  <li>Keep the packaging in case you need to store it later</li>
  <li>Take a photo and share it with us for 10% off your next order!</li>
  <li>Check out our care instructions to keep it looking new</li>
</ul>

<p>Need help? Just reply to this email!</p>`
    },
    'recommended-addon': {
      subject: 'Complete your collection with these perfect matches',
      preview: 'Handpicked just for you',
      body: `<h1>Complete Your Collection</h1>
<p>Hi {{customer_name}},</p>
<p>We noticed you recently purchased {{product_name}}, and we thought you might love these matching pieces:</p>

<div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3>Recommended for You</h3>
  <p>Based on your recent purchase, customers also bought:</p>
  <!-- Product recommendations will be inserted here -->
</div>

<p><strong>Special offer:</strong> Get 15% off when you add any of these to your cart today!</p>

<a href="{{store_url}}" style="display: inline-block; background: #8B5CF6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">Shop Now</a>`
    },
    'request-review': {
      subject: 'How are you enjoying your {{product_name}}? ⭐',
      preview: 'We\'d love to hear your thoughts',
      body: `<h1>We'd Love Your Feedback!</h1>
<p>Hi {{customer_name}},</p>
<p>It's been a week since your {{product_name}} arrived, and we hope you're absolutely loving it!</p>

<p>Would you mind taking 2 minutes to share your experience? Your review helps other customers make confident decisions.</p>

<div style="text-align: center; margin: 30px 0;">
  <a href="{{review_link}}" style="display: inline-block; background: #10B981; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold;">Leave a Review</a>
</div>

<p><strong>As a thank you, we'll send you a 10% discount code for your next purchase!</strong></p>

<p>Thanks for being an awesome customer!</p>`
    },
    'vip-discount': {
      subject: '🎁 VIP Discount just for you, {{customer_name}}!',
      preview: 'Exclusive 20% off your next order',
      body: `<h1 style="text-align: center;">VIP Discount Just For You! 🎁</h1>
<p>Hi {{customer_name}},</p>
<p>You're one of our valued customers, and we wanted to say thank you with something special...</p>

<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 12px; text-align: center; margin: 30px 0;">
  <h2 style="margin: 0; color: white;">20% OFF</h2>
  <p style="font-size: 24px; font-weight: bold; margin: 20px 0; color: white;">{{discount_code}}</p>
  <p style="margin: 0; opacity: 0.9; color: white;">Use this code at checkout</p>
</div>

<p style="text-align: center;">This exclusive offer expires in 7 days, so don't miss out!</p>

<div style="text-align: center; margin: 30px 0;">
  <a href="{{store_url}}" style="display: inline-block; background: #8B5CF6; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">Shop Now</a>
</div>`
    },
    'we-miss-you': {
      subject: 'We miss you, {{customer_name}}! 💜',
      preview: 'Come back and see what\'s new',
      body: `<h1>We Miss You! 💜</h1>
<p>Hi {{customer_name}},</p>
<p>It's been a while since we've seen you at {{store_name}}, and we wanted to reach out!</p>

<p>We've been working hard on some exciting new products and thought you might want to check them out:</p>

<div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3>What's New</h3>
  <ul>
    <li>New product collections just launched</li>
    <li>Improved designs based on customer feedback</li>
    <li>Special promotions running now</li>
  </ul>
</div>

<p><strong>Welcome back offer:</strong> Use code <span style="background: #FEF3C7; padding: 4px 8px; border-radius: 4px; font-weight: bold;">WELCOME10</span> for 10% off!</p>

<a href="{{store_url}}" style="display: inline-block; background: #8B5CF6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">Visit Our Store</a>`
    },
    'cart-reminder': {
      subject: 'You left something behind, {{customer_name}}...',
      preview: 'Your cart is waiting for you',
      body: `<h1>Don't Forget About Your Cart!</h1>
<p>Hi {{customer_name}},</p>
<p>We noticed you left some items in your cart. No worries - we saved everything for you!</p>

<div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3>Items in Your Cart</h3>
  <!-- Cart items will be inserted here -->
  <p><strong>Total:</strong> {{order_total}}</p>
</div>

<p>These items are popular and may sell out soon. Complete your order now to secure them!</p>

<div style="text-align: center; margin: 30px 0;">
  <a href="{{cart_link}}" style="display: inline-block; background: #10B981; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">Complete Your Order</a>
</div>

<p style="text-align: center; color: #6B7280; font-size: 14px;">Need help? Reply to this email and we'll assist you!</p>`
    },
    'need-help': {
      subject: 'Need help completing your order?',
      preview: 'We\'re here to help',
      body: `<h1>Can We Help You Complete Your Order?</h1>
<p>Hi {{customer_name}},</p>
<p>We noticed you started an order but didn't complete it. Is there anything we can help you with?</p>

<div style="background: #EEF2FF; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3>Common Questions</h3>
  <ul>
    <li><strong>Shipping:</strong> Free shipping on orders over £50</li>
    <li><strong>Returns:</strong> 30-day money-back guarantee</li>
    <li><strong>Quality:</strong> All products come with a quality guarantee</li>
    <li><strong>Support:</strong> 24/7 customer support available</li>
  </ul>
</div>

<p>Still have questions? Just reply to this email and we'll get back to you right away!</p>

<div style="text-align: center; margin: 30px 0;">
  <a href="{{cart_link}}" style="display: inline-block; background: #8B5CF6; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">Complete Your Order</a>
</div>`
    }
  };

  // Load existing template or use default
  useEffect(() => {
    loadEmailTemplate();
  }, [email]);

  async function loadEmailTemplate() {
    try {
      const templateRef = ref(db, `stores/${storeId}/emailTemplates/${campaign.id}/${email.id}`);
      const snapshot = await get(templateRef);
      
      if (snapshot.exists()) {
        const template = snapshot.val();
        setSubject(template.subject || '');
        setPreviewText(template.previewText || '');
        setEmailBody(template.body || '');
      } else {
        // Use default template
        const defaultTemplate = DEFAULT_TEMPLATES[email.id] || {};
        setSubject(defaultTemplate.subject || '');
        setPreviewText(defaultTemplate.preview || '');
        setEmailBody(defaultTemplate.body || '');
      }
    } catch (error) {
      console.error('Error loading template:', error);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      
      await onSave({
        subject,
        previewText,
        body: emailBody,
        emailId: email.id,
        campaignId: campaign.id
      });
      
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save email template');
    } finally {
      setSaving(false);
    }
  }

  function insertVariable(variable) {
    setEmailBody(prev => prev + ' ' + variable);
  }

  function wrapSelection(before, after) {
    const textarea = document.getElementById('email-body-editor');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = emailBody.substring(start, end);
    const newText = emailBody.substring(0, start) + before + selectedText + after + emailBody.substring(end);
    setEmailBody(newText);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-3">
                <Mail className="h-6 w-6" />
                <h2 className="text-2xl font-bold">{email.name}</h2>
              </div>
              <p className="text-purple-100 text-sm mt-1">
                {campaign.name} • Sent {email.delay} after {email.trigger}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-2 text-sm transition"
            >
              <Eye className="h-4 w-4" />
              {showPreview ? 'Edit' : 'Preview'}
            </button>
            
            <button
              onClick={() => setShowVariables(!showVariables)}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-2 text-sm transition"
            >
              <Code className="h-4 w-4" />
              Variables
            </button>
            
            <button
              onClick={() => setShowAIAssist(!showAIAssist)}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-2 text-sm transition"
            >
              <Sparkles className="h-4 w-4" />
              AI Assist
            </button>

            <div className="flex-1" />

            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-white text-purple-600 hover:bg-purple-50 rounded-lg flex items-center gap-2 font-semibold transition"
            >
              {saving ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-purple-600 border-t-transparent rounded-full" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Email
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Editor */}
            <div className="lg:col-span-2 space-y-4">
              {!showPreview ? (
                <>
                  {/* Subject Line */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Subject Line
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Enter email subject..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {subject.length} characters • Best practice: 40-60 characters
                    </p>
                  </div>

                  {/* Preview Text */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Preview Text
                    </label>
                    <input
                      type="text"
                      value={previewText}
                      onChange={(e) => setPreviewText(e.target.value)}
                      placeholder="This appears in the inbox preview..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Appears below subject line in email clients
                    </p>
                  </div>

                  {/* Formatting Toolbar */}
                  <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg border border-gray-200">
                    <button
                      onClick={() => wrapSelection('<strong>', '</strong>')}
                      className="p-2 hover:bg-white rounded"
                      title="Bold"
                    >
                      <Bold className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => wrapSelection('<em>', '</em>')}
                      className="p-2 hover:bg-white rounded"
                      title="Italic"
                    >
                      <Italic className="h-4 w-4" />
                    </button>
                    <div className="w-px h-6 bg-gray-300" />
                    <button
                      onClick={() => wrapSelection('<h2>', '</h2>')}
                      className="p-2 hover:bg-white rounded text-sm font-semibold"
                      title="Heading"
                    >
                      H2
                    </button>
                    <button
                      onClick={() => wrapSelection('<h3>', '</h3>')}
                      className="p-2 hover:bg-white rounded text-sm font-semibold"
                      title="Subheading"
                    >
                      H3
                    </button>
                    <div className="w-px h-6 bg-gray-300" />
                    <button
                      onClick={() => wrapSelection('<a href="URL">', '</a>')}
                      className="p-2 hover:bg-white rounded"
                      title="Link"
                    >
                      <Link2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Email Body */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email Body
                    </label>
                    <textarea
                      id="email-body-editor"
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="Write your email content here... You can use HTML and variables like {{customer_name}}"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm h-96 resize-y"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      HTML and variables supported • Click variables panel to insert
                    </p>
                  </div>
                </>
              ) : (
                /* Preview Mode */
                <div className="bg-gray-100 rounded-lg p-8">
                  <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
                    {/* Email Preview Header */}
                    <div className="bg-gray-800 text-white p-4">
                      <div className="text-sm mb-1">From: {'{'}store_name{'}'} &lt;noreply@fotonix.co.uk&gt;</div>
                      <div className="text-lg font-bold">{subject || 'Email Subject'}</div>
                      <div className="text-sm text-gray-300 mt-1">{previewText}</div>
                    </div>

                    {/* Email Body Preview */}
                    <div 
                      className="p-6"
                      dangerouslySetInnerHTML={{ __html: emailBody }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Variables Panel */}
              {showVariables && (
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Available Variables
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {Object.entries(
                      VARIABLES.reduce((acc, v) => {
                        if (!acc[v.category]) acc[v.category] = [];
                        acc[v.category].push(v);
                        return acc;
                      }, {})
                    ).map(([category, vars]) => (
                      <div key={category}>
                        <div className="text-xs font-semibold text-gray-500 mb-1">{category}</div>
                        {vars.map((variable) => (
                          <button
                            key={variable.key}
                            onClick={() => insertVariable(variable.key)}
                            className="w-full text-left px-3 py-2 text-sm bg-white border border-gray-200 rounded hover:bg-purple-50 hover:border-purple-300 transition mb-1"
                          >
                            <div className="font-mono text-xs text-purple-600">{variable.key}</div>
                            <div className="text-xs text-gray-600">{variable.label}</div>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Assist Panel */}
              {showAIAssist && (
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border border-purple-200 p-4">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    AI Writing Assistant
                  </h3>
                  <div className="space-y-2">
                    <button className="w-full px-3 py-2 text-sm bg-white border border-purple-200 rounded hover:bg-purple-50 transition text-left">
                      ✨ Improve subject line
                    </button>
                    <button className="w-full px-3 py-2 text-sm bg-white border border-purple-200 rounded hover:bg-purple-50 transition text-left">
                      📝 Rewrite more conversationally
                    </button>
                    <button className="w-full px-3 py-2 text-sm bg-white border border-purple-200 rounded hover:bg-purple-50 transition text-left">
                      🎯 Make it more persuasive
                    </button>
                    <button className="w-full px-3 py-2 text-sm bg-white border border-purple-200 rounded hover:bg-purple-50 transition text-left">
                      ✂️ Make it shorter
                    </button>
                  </div>
                </div>
              )}

              {/* Email Stats */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-bold text-sm mb-3">Email Performance</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Open Rate</span>
                      <span className="font-bold">42.5%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: '42.5%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Click Rate</span>
                      <span className="font-bold">18.3%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: '18.3%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Conversion</span>
                      <span className="font-bold">8.7%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-purple-500 h-2 rounded-full" style={{ width: '8.7%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
