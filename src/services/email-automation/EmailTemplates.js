/**
 * Email Templates Service for Automation Campaigns
 * Provides pre-built professional email templates for different campaign types
 * Templates are designed with best practices and conversion optimization in mind
 */

export function getAutomationEmailTemplate(campaignType, emailType) {
  const templates = {
    'post-purchase': {
      'thank-you': createThankYouEmailTemplate(),
      'usage-guide': createUsageGuideTemplate(),
      'recommended-addon': createRecommendedAddonTemplate()
    },
    'win-back': {
      'request-review': createRequestReviewTemplate(),
      'vip-discount': createVIPDiscountTemplate(),
      'we-miss-you': createWeMissYouTemplate()
    },
    'abandoned-cart': {
      'product-suggestion': createProductSuggestionTemplate(),
      'personalized-offer': createPersonalizedOfferTemplate(),
      'cart-reminder': createCartReminderTemplate()
    },
    'upsell-offers': {
      'need-help': createNeedHelpTemplate(),
      'cart-discount': createCartDiscountTemplate(),
      'deluxe-upgrade': createDeluxeUpgradeTemplate(),
      'accessory-offer': createAccessoryOfferTemplate(),
      'customers-also-bought': createCustomersAlsoBoughtTemplate()
    },
    'personalized-recommendation': {
      'ai-recommendations': createAIRecommendationsTemplate(),
      'product-suggestion': createSmartSuggestionTemplate(),
      'trending-products': createTrendingProductsTemplate()
    },
    'product-follow-up': {
      'check-in-7day': createCheckIn7DayTemplate(),
      'photo-incentive': createPhotoIncentiveTemplate(),
      'matching-piece': createMatchingPieceTemplate()
    },
    'anniversary-emails': {
      'anniversary-reminder': createAnniversaryTemplate(),
      'upgrade-offer': createUpgradeOfferTemplate(),
      'matching-products': createMatchingProductsTemplate()
    }
  };

  return templates[campaignType]?.[emailType] || null;
}

/**
 * Thank You Email Template
 * Sent immediately after purchase (0 hours delay)
 * Purpose: Express gratitude, confirm order, set expectations, build relationship
 * Best practices: Personal tone, order summary, what's next, social proof
 */
function createThankYouEmailTemplate() {
  return {
    id: 'automation-thank-you',
    title: 'Thank You Email - Post Purchase',
    src: '/uploads/thank-you-preview.png',
    tenantId: 'automation',
    owner: 'system',
    sharedWith: { users: [] },
    createdAt: new Date().toISOString(),
    blocks: [
      // Logo/Header
      {
        id: 'header-logo',
        type: 'image',
        meta: {
          src: '{{store_logo}}',
          alt: '{{store_name}}',
          align: 'center',
          width: '180px'
        }
      },
      
      // Spacer
      {
        id: 'header-spacer',
        type: 'spacer',
        meta: { height: 40 }
      },
      
      // Celebration emoji
      {
        id: 'celebration',
        type: 'text',
        meta: {
          content: '🎉',
          align: 'center',
          fontSize: 64
        }
      },
      
      // Thank you heading
      {
        id: 'thank-you-heading',
        type: 'text',
        meta: {
          content: 'Thank You for Your Order!',
          align: 'center',
          fontSize: 36
        }
      },
      
      // Personal greeting
      {
        id: 'personal-greeting',
        type: 'text',
        meta: {
          content: 'Hi {{customer_first_name}},',
          align: 'center',
          fontSize: 18
        }
      },
      
      // Gratitude message
      {
        id: 'gratitude-message',
        type: 'text',
        meta: {
          content: "We are absolutely thrilled to have you as a customer! Your order means the world to us, and we can't wait for you to experience what we have created.",
          align: 'center',
          fontSize: 16
        }
      },
      
      // Order confirmation heading
      {
        id: 'order-heading',
        type: 'text',
        meta: {
          content: 'Order Confirmation',
          align: 'center',
          fontSize: 24
        }
      },
      
      // Order number
      {
        id: 'order-number',
        type: 'text',
        meta: {
          content: 'Order #{{order_number}}',
          align: 'center',
          fontSize: 18
        }
      },
      
      // Order details
      {
        id: 'order-details',
        type: 'text',
        meta: {
          content: 'Product: {{product_name}}\nQuantity: {{quantity}}\nTotal: {{total_amount}}\n\n📦 Shipping to: {{shipping_address}}',
          align: 'left',
          fontSize: 14
        }
      },
      
      // What's next heading
      {
        id: 'whats-next',
        type: 'text',
        meta: {
          content: 'What Happens Next?',
          align: 'center',
          fontSize: 24
        }
      },
      
      // Timeline steps
      {
        id: 'timeline-steps',
        type: 'text',
        meta: {
          content: '1️⃣ Order Processing\nWe are carefully preparing your order right now. You will receive a shipping confirmation within 24 hours.\n\n2️⃣ Shipping & Tracking\nOnce shipped, you will get a tracking number so you can follow your package every step of the way.\n\n3️⃣ Delivery & Enjoyment\nYour order will arrive within {{delivery_timeframe}}. We will also send you tips to get the most out of your purchase!',
          align: 'left',
          fontSize: 14
        }
      },
      
      // Support section
      {
        id: 'support-heading',
        type: 'text',
        meta: {
          content: '💬 Have Questions?',
          align: 'center',
          fontSize: 20
        }
      },
      
      {
        id: 'support-text',
        type: 'text',
        meta: {
          content: 'Our support team is here to help! Reply to this email or reach out anytime.',
          align: 'center',
          fontSize: 15
        }
      },
      
      // Support button
      {
        id: 'support-button',
        type: 'button',
        meta: {
          label: 'Contact Support',
          url: '{{support_url}}',
          style: 'solid',
          placement: 'center'
        }
      },

      // Recommended product section
      {
        id: 'product-recommendation-heading',
        type: 'text',
        meta: {
          content: '🛍️ You Might Also Love',
          align: 'center',
          fontSize: 22
        }
      },

      {
        id: 'product-recommendation',
        type: 'product',
        meta: {
          productId: '2', // Light Up Design Pro
          showPrice: true,
          showDescription: true,
          buttonText: 'Add to Cart',
          layout: 'card',
          productData: {
            title: 'Light Up Design Pro',
            description: 'Create custom light-up designs with premium features and advanced LED technology.',
            price: 19.99,
            currency: 'GBP',
            images: ['/images/design-pro.jpg']
          }
        }
      },

      // Social section
      {
        id: 'social-heading',
        type: 'text',
        meta: {
          content: 'Join Our Community',
          align: 'center',
          fontSize: 22
        }
      },
      
      {
        id: 'social-text',
        type: 'text',
        meta: {
          content: 'Share your experience and connect with thousands of happy customers!',
          align: 'center',
          fontSize: 15
        }
      },
      
      // Footer
      {
        id: 'footer-spacer',
        type: 'spacer',
        meta: { height: 40 }
      },
      
      {
        id: 'footer',
        type: 'text',
        meta: {
          content: '© {{current_year}} {{store_name}}. All rights reserved.\n\nUnsubscribe | Email Preferences',
          align: 'center',
          fontSize: 12
        }
      }
    ],
    metadata: {
      subject: 'Thank you for your order! 🎉',
      preheader: 'Order confirmed - Here\'s what happens next...',
      campaignType: 'post-purchase',
      emailType: 'thank-you',
      delay: 0, // Send immediately after purchase
      tags: ['post-purchase', 'thank-you', 'order-confirmation'],
      bestPractices: [
        'Sent immediately after purchase (0 hours)',
        'Personal and warm tone',
        'Clear order confirmation details',
        'Sets expectations for what happens next',
        'Provides easy access to support',
        'Includes social proof and community building',
        'Mobile-responsive design',
        'Clear call-to-action for support'
      ]
    }
  };
}

// Placeholder functions for other templates (to be implemented)
function createUsageGuideTemplate() {
  return {
    id: 'automation-usage-guide',
    title: 'Usage Guide - Post Purchase',
    src: '/uploads/usage-guide-preview.png',
    tenantId: 'automation',
    owner: 'system',
    sharedWith: { users: [] },
    createdAt: new Date().toISOString(),
    blocks: [
      {
        id: "ug_logo_1",
        type: "image",
        meta: {
          src: "{{store_logo}}",
          alt: "{{store_name}}",
          align: "center",
          width: "160px"
        }
      },
      {
        id: "ug_spacer_1",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ug_title_1",
        type: "text",
        meta: {
          content: "How to get the best from your {{product_name}}",
          align: "center",
          fontSize: 26,
          color: "#111827",
          fontWeight: "bold"
        }
      },
      {
        id: "ug_spacer_2",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "ug_text_1",
        type: "text",
        meta: {
          content: "Hey {{first_name}},<br><br>Your {{product_name}} is designed to look amazing and last for years. Here's a simple, no-fluff guide to set it up, use it properly, and keep it 🔥.",
          align: "left",
          fontSize: 16
        }
      },
      {
        id: "ug_divider_1",
        type: "divider",
        meta: { thickness: 1, color: "#E5E7EB" }
      },
      {
        id: "ug_title_2",
        type: "text",
        meta: {
          content: "✅ Quick start (2 minutes)",
          align: "left",
          fontSize: 20,
          color: "#111827",
          fontWeight: "bold"
        }
      },
      {
        id: "ug_text_2",
        type: "text",
        meta: {
          content: "<ol style='margin:0;padding-left:18px;line-height:1.6;'><li>Unbox your {{product_name}} and place it on a stable surface.</li><li>Connect the power cable firmly into the port.</li><li>Turn it on using the switch or button on the back.</li><li>If your product supports app-control, pair it using the guide below.</li></ol>",
          align: "left",
          fontSize: 15
        }
      },
      {
        id: "ug_spacer_3",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "ug_image_1",
        type: "image",
        meta: {
          src: "{{product_setup_image}}",
          alt: "Setup diagram for {{product_name}}",
          align: "center",
          width: "100%"
        }
      },
      {
        id: "ug_divider_2",
        type: "divider",
        meta: { thickness: 1, color: "#E5E7EB" }
      },
      {
        id: "ug_title_3",
        type: "text",
        meta: {
          content: "📲 App pairing (if applicable)",
          align: "left",
          fontSize: 20,
          color: "#111827",
          fontWeight: "bold"
        }
      },
      {
        id: "ug_text_3",
        type: "text",
        meta: {
          content: "If your {{product_name}} includes smart controls, follow this:<br><br><strong>1)</strong> Download the app here: <a href='{{app_url}}'>{{app_url}}</a><br><strong>2)</strong> Open the app → tap 'Add new device.'<br><strong>3)</strong> Select <em>{{product_name}}</em> from the list.<br><strong>4)</strong> Hold the power button for 3 seconds until it flashes.<br><strong>5)</strong> Confirm pairing in the app.<br><br>You're in — now you can control colours, brightness, and effects.",
          align: "left",
          fontSize: 15
        }
      },
      {
        id: "ug_divider_3",
        type: "divider",
        meta: { thickness: 1, color: "#E5E7EB" }
      },
      {
        id: "ug_title_4",
        type: "text",
        meta: {
          content: "🧼 Care & maintenance",
          align: "left",
          fontSize: 20,
          color: "#111827",
          fontWeight: "bold"
        }
      },
      {
        id: "ug_text_4",
        type: "text",
        meta: {
          content: "To keep your {{product_name}} looking brand new:<br><br>• Wipe gently with a dry microfibre cloth.<br>• Avoid harsh cleaners or alcohol-based sprays.<br>• Keep away from direct water/steam.<br>• If moving it, unplug first and hold from the base.<br><br><strong>Tip:</strong> A quick weekly dust-off keeps the acrylic crystal clear.",
          align: "left",
          fontSize: 15
        }
      },
      {
        id: "ug_divider_4",
        type: "divider",
        meta: { thickness: 1, color: "#E5E7EB" }
      },
      {
        id: "ug_title_5",
        type: "text",
        meta: {
          content: "🛠 Quick troubleshooting",
          align: "left",
          fontSize: 20,
          color: "#111827",
          fontWeight: "bold"
        }
      },
      {
        id: "ug_text_5",
        type: "text",
        meta: {
          content: "<strong>Not turning on?</strong><br>• Check the cable is fully seated.<br>• Try a different socket.<br><br><strong>App not finding it?</strong><br>• Make sure Bluetooth / Wi-Fi is enabled.<br>• Hold the power button until it flashes, then retry pairing.<br><br>Still stuck? Reply to this email — we'll sort it fast.",
          align: "left",
          fontSize: 15
        }
      },
      {
        id: "ug_spacer_4",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ug_button_1",
        type: "button",
        meta: {
          label: "View full guide for {{product_name}}",
          url: "{{product_guide_url}}",
          style: "solid",
          background: "#6e54d7",
          color: "#ffffff",
          placement: "center",
          fontSize: 16
        }
      },
      {
        id: "ug_spacer_5",
        type: "spacer",
        meta: { height: 30 }
      }
    ]
  };
}

function createRecommendedAddonTemplate() {
  return {
    id: 'automation-recommended-addon',
    title: 'Recommended Add-on - Post Purchase',
    src: '/uploads/addon-preview.png',
    tenantId: 'automation',
    owner: 'system',
    sharedWith: { users: [] },
    createdAt: new Date().toISOString(),
    blocks: [
      {
        id: "ra_logo_1",
        type: "image",
        meta: {
          src: "{{store_logo}}",
          alt: "{{store_name}}",
          align: "center",
          width: "160px"
        }
      },
      {
        id: "ra_spacer_1",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ra_title_1",
        type: "text",
        meta: {
          content: "Perfect add-ons for your new {{product_name}}",
          align: "center",
          fontSize: 28,
          color: "#111827",
          fontWeight: "bold"
        }
      },
      {
        id: "ra_spacer_2",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "ra_text_1",
        type: "text",
        meta: {
          content: "Hey {{first_name}},<br><br>Lots of customers who buy <strong>{{product_name}}</strong> also grab one of these recommended add-ons. They're designed to enhance your setup, extend the product's life, or unlock extra features.<br><br>Here are the top picks we think you'll love:",
          align: "left",
          fontSize: 16
        }
      },
      {
        id: "ra_div_1",
        type: "divider",
        meta: { thickness: 1, color: "#E5E7EB" }
      },
      {
        id: "ra_spacer_3",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "ra_addon_title_1",
        type: "text",
        meta: {
          content: "⭐ Add-On 1: Upgrade Pack",
          align: "left",
          fontSize: 22,
          color: "#111827",
          fontWeight: "bold"
        }
      },
      {
        id: "ra_addon_text_1",
        type: "text",
        meta: {
          content: "This upgrade pairs beautifully with your {{product_name}}. It adds extra functionality and improves long-term durability.<br><br>• Easy 30-second install<br>• Premium build<br>• Customer favourite",
          align: "left",
          fontSize: 15
        }
      },
      {
        id: "ra_spacer_4",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "ra_addon_img_1",
        type: "image",
        meta: {
          src: "{{addon_1_image}}",
          alt: "Recommended add-on for {{product_name}}",
          align: "center",
          width: "100%"
        }
      },
      {
        id: "ra_spacer_5",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "ra_button_1",
        type: "button",
        meta: {
          label: "View Upgrade Pack",
          url: "{{addon_1_url}}",
          style: "solid",
          background: "#6e54d7",
          color: "#ffffff",
          placement: "center",
          fontSize: 16
        }
      },
      {
        id: "ra_div_2",
        type: "divider",
        meta: { thickness: 1, color: "#E5E7EB" }
      },
      {
        id: "ra_spacer_6",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "ra_addon_title_2",
        type: "text",
        meta: {
          content: "🔥 Add-On 2: Care & Cleaning Kit",
          align: "left",
          fontSize: 22,
          color: "#111827",
          fontWeight: "bold"
        }
      },
      {
        id: "ra_addon_text_2",
        type: "text",
        meta: {
          content: "Keep your {{product_name}} in perfect condition with a specialised cleaning kit.<br><br>• No streaks, no scratches<br>• Safe on acrylic & LED components<br>• Extends life and keeps brightness sharp",
          align: "left",
          fontSize: 15
        }
      },
      {
        id: "ra_spacer_7",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "ra_addon_img_2",
        type: "image",
        meta: {
          src: "{{addon_2_image}}",
          alt: "Care kit for {{product_name}}",
          align: "center",
          width: "100%"
        }
      },
      {
        id: "ra_spacer_8",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "ra_button_2",
        type: "button",
        meta: {
          label: "Get the Care Kit",
          url: "{{addon_2_url}}",
          style: "solid",
          background: "#111827",
          color: "#ffffff",
          placement: "center",
          fontSize: 16
        }
      },
      {
        id: "ra_div_3",
        type: "divider",
        meta: { thickness: 1, color: "#E5E7EB" }
      },
      {
        id: "ra_spacer_9",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "ra_text_3",
        type: "text",
        meta: {
          content: "<strong>Why we recommend these:</strong><br>• Increase the lifespan of your {{product_name}}<br>• Improve performance & features<br>• Most popular bundle combination<br><br>Treat your new setup — it deserves it. 😉",
          align: "left",
          fontSize: 16
        }
      },
      {
        id: "ra_spacer_10",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "ra_button_3",
        type: "button",
        meta: {
          label: "Browse all add-ons",
          url: "{{all_addons_url}}",
          style: "solid",
          background: "#f59e0b",
          color: "#111827",
          placement: "center",
          fontSize: 17
        }
      },
      {
        id: "ra_spacer_11",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ra_social_1",
        type: "social-follow",
        meta: {
          links: [
            { provider: "Instagram", url: "{{instagram_url}}" },
            { provider: "TikTok", url: "{{tiktok_url}}" }
          ],
          placement: "center"
        }
      }
    ]
  };
}

function createRequestReviewTemplate() {
  return {
    id: 'automation-request-review',
    title: 'Request Review - Post Purchase',
    src: '/uploads/review-preview.png',
    tenantId: 'automation',
    owner: 'system',
    sharedWith: { users: [] },
    createdAt: new Date().toISOString(),
    blocks: [
      {
        id: "rr_logo_1",
        type: "image",
        meta: {
          src: "{{store_logo}}",
          alt: "{{store_name}}",
          align: "center",
          width: "160px"
        }
      },
      {
        id: "rr_spacer_1",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "rr_title_1",
        type: "text",
        meta: {
          content: "How's your {{product_name}}? 💭",
          align: "center",
          fontSize: 28,
          color: "#111827",
          fontWeight: "bold"
        }
      },
      {
        id: "rr_spacer_2",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "rr_text_1",
        type: "text",
        meta: {
          content: "Hey {{first_name}},<br><br>We hope you're loving your new {{product_name}}! 🎉<br><br>Would you mind taking 60 seconds to leave a quick review? Your feedback helps other customers make confident decisions — and it helps us keep improving.<br><br>We'd be super grateful. ❤️",
          align: "left",
          fontSize: 16
        }
      },
      {
        id: "rr_spacer_3",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "rr_button_1",
        type: "button",
        meta: {
          label: "⭐ Leave a Review",
          url: "{{review_url}}",
          style: "solid",
          background: "#10b981",
          color: "#ffffff",
          placement: "center",
          fontSize: 18
        }
      },
      {
        id: "rr_spacer_4",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "rr_divider_1",
        type: "divider",
        meta: { thickness: 1, color: "#E5E7EB" }
      },
      {
        id: "rr_spacer_5",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "rr_title_2",
        type: "text",
        meta: {
          content: "Why your review matters",
          align: "center",
          fontSize: 20,
          color: "#111827",
          fontWeight: "bold"
        }
      },
      {
        id: "rr_spacer_6",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "rr_text_2",
        type: "text",
        meta: {
          content: "✅ <strong>Helps others decide</strong> — Real customer feedback makes all the difference<br><br>✅ <strong>Helps us improve</strong> — We read every review and use your input to make better products<br><br>✅ <strong>Takes just 60 seconds</strong> — We promise it's quick and easy",
          align: "left",
          fontSize: 15
        }
      },
      {
        id: "rr_spacer_7",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "rr_divider_2",
        type: "divider",
        meta: { thickness: 1, color: "#E5E7EB" }
      },
      {
        id: "rr_spacer_8",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "rr_text_3",
        type: "text",
        meta: {
          content: "<strong>Not quite happy?</strong><br><br>If something's not right with your {{product_name}}, please reach out to us first. We'll make it right — promise. 🙏<br><br>Just reply to this email or contact us at {{support_email}}",
          align: "center",
          fontSize: 15,
          color: "#6b7280"
        }
      },
      {
        id: "rr_spacer_9",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "rr_button_2",
        type: "button",
        meta: {
          label: "Write your review now",
          url: "{{review_url}}",
          style: "solid",
          background: "#6e54d7",
          color: "#ffffff",
          placement: "center",
          fontSize: 16
        }
      },
      {
        id: "rr_spacer_10",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "rr_text_4",
        type: "text",
        meta: {
          content: "Thanks so much,<br><strong>The {{store_name}} Team</strong>",
          align: "center",
          fontSize: 16
        }
      },
      {
        id: "rr_spacer_11",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "rr_social_1",
        type: "social-follow",
        meta: {
          links: [
            { provider: "Instagram", url: "{{instagram_url}}" },
            { provider: "Facebook", url: "{{facebook_url}}" }
          ],
          placement: "center"
        }
      }
    ]
  };
}

function createVIPDiscountTemplate() {
  return {
    id: 'vip-discount',
    title: 'VIP Discount',
    blocks: [
      {
        id: "vip_logo_1",
        type: "image",
        meta: {
          src: "{{store_logo}}",
          url: "{{store_url}}",
          width: 160,
          align: "center"
        }
      },
      {
        id: "vip_spacer_1",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "vip_title_1",
        type: "text",
        meta: {
          content: "You're VIP now, {{first_name}} ✨",
          align: "center",
          fontSize: 28,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "vip_spacer_2",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "vip_text_1",
        type: "text",
        meta: {
          content: "Because you've purchased <strong>{{product_name}}</strong>, we've upgraded you to VIP status.<br><br>That means early access to new drops, special perks, and discounts you won't see anywhere else.",
          align: "left",
          fontSize: 16,
          color: "#111827"
        }
      },
      {
        id: "vip_spacer_3",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "vip_div_1",
        type: "divider",
        meta: { color: "#E5E7EB" }
      },
      {
        id: "vip_spacer_4",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "vip_title_2",
        type: "text",
        meta: {
          content: "🎁 Your VIP discount is ready",
          align: "left",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "vip_spacer_5",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "vip_text_2",
        type: "text",
        meta: {
          content: "Here's a private discount just for you:<br><br><div style=\"font-size:20px;font-weight:800;letter-spacing:1px;\">{{discount_code}}</div><div style=\"margin-top:6px;font-size:14px;color:#6b7280;\">{{discount_amount}} off your next order</div><br>Use it on anything — including add-ons and matching products for your {{product_name}}.",
          align: "left",
          fontSize: 16,
          color: "#111827"
        }
      },
      {
        id: "vip_spacer_6",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "vip_button_1",
        type: "button",
        meta: {
          content: "Shop with {{discount_code}}",
          url: "{{vip_shop_url}}",
          align: "center",
          backgroundColor: "#6e54d7",
          textColor: "#ffffff",
          fontSize: 17,
          fontWeight: "bold",
          borderRadius: 999,
          paddingTop: 18,
          paddingBottom: 18,
          paddingLeft: 40,
          paddingRight: 40
        }
      },
      {
        id: "vip_spacer_7",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "vip_text_3",
        type: "text",
        meta: {
          content: "<strong>VIP perks you now unlock:</strong><br>• Early access to new releases<br>• Exclusive VIP-only offers<br>• Priority support<br>• Subscriber giveaways<br><br>We're genuinely glad you're here.",
          align: "left",
          fontSize: 16,
          color: "#111827"
        }
      },
      {
        id: "vip_spacer_8",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "vip_image_1",
        type: "image",
        meta: {
          src: "{{vip_banner_image}}",
          url: "{{vip_perks_url}}",
          width: 600,
          align: "center"
        }
      },
      {
        id: "vip_spacer_9",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "vip_div_2",
        type: "divider",
        meta: { color: "#E5E7EB" }
      },
      {
        id: "vip_spacer_10",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "vip_text_4",
        type: "text",
        meta: {
          content: "<strong>Quick reminder:</strong><br>Your VIP code expires in <strong>{{expiry_days}} days</strong> — so don't leave it sitting there. 😉",
          align: "left",
          fontSize: 16,
          color: "#111827"
        }
      },
      {
        id: "vip_spacer_11",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "vip_button_2",
        type: "button",
        meta: {
          content: "Browse VIP picks",
          url: "{{vip_picks_url}}",
          align: "center",
          backgroundColor: "#111827",
          textColor: "#ffffff",
          fontSize: 16,
          fontWeight: "bold",
          borderRadius: 999,
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 40,
          paddingRight: 40
        }
      },
      {
        id: "vip_spacer_12",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "vip_social_1",
        type: "social-follow",
        meta: {
          links: [
            { provider: "Instagram", url: "{{instagram_url}}" },
            { provider: "Facebook", url: "{{facebook_url}}" }
          ],
          placement: "center"
        }
      }
    ]
  };
}

function createWeMissYouTemplate() {
  return {
    id: 'we-miss-you',
    title: 'We Miss You',
    blocks: [
      {
        id: "wm_logo_1",
        type: "image",
        meta: {
          src: "{{store_logo}}",
          url: "{{store_url}}",
          width: 160,
          align: "center"
        }
      },
      {
        id: "wm_spacer_1",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "wm_title_1",
        type: "text",
        meta: {
          content: "We miss you, {{first_name}} 💛",
          align: "center",
          fontSize: 30,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "wm_spacer_2",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "wm_text_1",
        type: "text",
        meta: {
          content: "It's been a little while since you grabbed your <strong>{{product_name}}</strong> and we wanted to check in.<br><br>We hope everything's going great — but if you need anything, or want to treat yourself to something new, we've got something special for you.",
          align: "left",
          fontSize: 16,
          color: "#111827"
        }
      },
      {
        id: "wm_spacer_3",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "wm_divider_1",
        type: "divider",
        meta: { color: "#E5E7EB" }
      },
      {
        id: "wm_spacer_4",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "wm_title_2",
        type: "text",
        meta: {
          content: "Here's a little something to say we care",
          align: "left",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "wm_spacer_5",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "wm_text_2",
        type: "text",
        meta: {
          content: "Use your personal return discount:<br><br><div style=\"font-size:22px;font-weight:800;letter-spacing:1px;\">{{comeback_code}}</div><div style=\"margin-top:6px;font-size:14px;color:#6b7280;\">{{discount_amount}} off anything on the store</div><br>No minimum spend. No restrictions.<br>Just something to welcome you back. ✨",
          align: "left",
          fontSize: 16,
          color: "#111827"
        }
      },
      {
        id: "wm_spacer_6",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "wm_button_1",
        type: "button",
        meta: {
          text: "Use {{comeback_code}}",
          url: "{{comeback_url}}",
          align: "center",
          backgroundColor: "#6e54d7",
          textColor: "#ffffff",
          fontSize: 17,
          fontWeight: "bold",
          borderRadius: 999,
          paddingTop: 18,
          paddingBottom: 18,
          paddingLeft: 40,
          paddingRight: 40
        }
      },
      {
        id: "wm_spacer_7",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "wm_divider_2",
        type: "divider",
        meta: { color: "#E5E7EB" }
      },
      {
        id: "wm_spacer_8",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "wm_title_3",
        type: "text",
        meta: {
          content: "Recommended for you",
          align: "left",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "wm_spacer_9",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "wm_text_3",
        type: "text",
        meta: {
          content: "Based on what you purchased last time, people usually love these too:<br><br>• Matching accessories for {{product_name}}<br>• Upgraded versions<br>• Gift versions for friends/family<br><br>Treat yourself. You deserve it.",
          align: "left",
          fontSize: 16,
          color: "#111827"
        }
      },
      {
        id: "wm_spacer_10",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "wm_button_2",
        type: "button",
        meta: {
          text: "See recommendations",
          url: "{{recommendations_url}}",
          align: "center",
          backgroundColor: "#111827",
          textColor: "#ffffff",
          fontSize: 16,
          fontWeight: "bold",
          borderRadius: 999,
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 40,
          paddingRight: 40
        }
      },
      {
        id: "wm_spacer_11",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "wm_image_1",
        type: "image",
        meta: {
          src: "{{miss_you_banner}}",
          url: "{{store_url}}",
          width: 600,
          align: "center"
        }
      },
      {
        id: "wm_spacer_12",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "wm_divider_3",
        type: "divider",
        meta: { color: "#E5E7EB" }
      },
      {
        id: "wm_spacer_13",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "wm_text_4",
        type: "text",
        meta: {
          content: "If you ever need help with your {{product_name}}, or you're looking for something new,<br>just reply — we're always happy to hear from you. 💬",
          align: "center",
          fontSize: 16,
          color: "#111827"
        }
      },
      {
        id: "wm_spacer_14",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "wm_social_1",
        type: "social-follow",
        meta: {
          links: [
            { provider: "Instagram", url: "{{instagram_url}}" },
            { provider: "TikTok", url: "{{tiktok_url}}" }
          ],
          placement: "center"
        }
      }
    ]
  };
}

function createProductSuggestionTemplate() {
  return {
    id: 'product-suggestion',
    title: 'Product Suggestion',
    blocks: [
      {
        id: "ps_logo_1",
        type: "image",
        meta: {
          src: "{{store_logo}}",
          url: "{{store_url}}",
          width: 160,
          align: "center"
        }
      },
      {
        id: "ps_spacer_1",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ps_title_1",
        type: "text",
        meta: {
          content: "You might like these too, {{first_name}} 👀",
          align: "center",
          fontSize: 28,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "ps_spacer_2",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "ps_text_1",
        type: "text",
        meta: {
          content: "Since you picked up <strong>{{product_name}}</strong>, we thought you'd love these other items that pair perfectly with it.<br><br>They're some of our most popular follow-up purchases — chosen by customers just like you.",
          align: "left",
          fontSize: 16,
          color: "#111827"
        }
      },
      {
        id: "ps_spacer_3",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ps_div_1",
        type: "divider",
        meta: { color: "#E5E7EB" }
      },
      {
        id: "ps_spacer_4",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ps_suggestion_title_1",
        type: "text",
        meta: {
          content: "⭐ Suggested Item 1",
          align: "left",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "ps_spacer_5",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "ps_suggestion_img_1",
        type: "image",
        meta: {
          src: "{{suggestion_1_image}}",
          url: "{{suggestion_1_url}}",
          width: 600,
          align: "center"
        }
      },
      {
        id: "ps_spacer_6",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "ps_suggestion_text_1",
        type: "text",
        meta: {
          content: "This item is frequently purchased together with {{product_name}}.<br>It enhances your setup and adds extra functionality.",
          align: "left",
          fontSize: 16,
          color: "#111827"
        }
      },
      {
        id: "ps_spacer_7",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "ps_button_1",
        type: "button",
        meta: {
          text: "View this suggestion",
          url: "{{suggestion_1_url}}",
          align: "center",
          backgroundColor: "#6e54d7",
          textColor: "#ffffff",
          fontSize: 16,
          fontWeight: "bold",
          borderRadius: 999,
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 40,
          paddingRight: 40
        }
      },
      {
        id: "ps_spacer_8",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ps_div_2",
        type: "divider",
        meta: { color: "#E5E7EB" }
      },
      {
        id: "ps_spacer_9",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ps_suggestion_title_2",
        type: "text",
        meta: {
          content: "🔥 Suggested Item 2",
          align: "left",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "ps_spacer_10",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "ps_suggestion_img_2",
        type: "image",
        meta: {
          src: "{{suggestion_2_image}}",
          url: "{{suggestion_2_url}}",
          width: 600,
          align: "center"
        }
      },
      {
        id: "ps_spacer_11",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "ps_suggestion_text_2",
        type: "text",
        meta: {
          content: "This is a popular upgrade option for {{product_name}}.<br>Many customers choose this to level-up their setup or complete their collection.",
          align: "left",
          fontSize: 16,
          color: "#111827"
        }
      },
      {
        id: "ps_spacer_12",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "ps_button_2",
        type: "button",
        meta: {
          text: "Discover this upgrade",
          url: "{{suggestion_2_url}}",
          align: "center",
          backgroundColor: "#111827",
          textColor: "#ffffff",
          fontSize: 16,
          fontWeight: "bold",
          borderRadius: 999,
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 40,
          paddingRight: 40
        }
      },
      {
        id: "ps_spacer_13",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ps_div_3",
        type: "divider",
        meta: { color: "#E5E7EB" }
      },
      {
        id: "ps_spacer_14",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ps_text_3",
        type: "text",
        meta: {
          content: "Want more recommendations based on your {{product_name}}?<br>We've built a personalised page just for you.",
          align: "center",
          fontSize: 16,
          color: "#111827"
        }
      },
      {
        id: "ps_spacer_15",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "ps_button_3",
        type: "button",
        meta: {
          text: "View all personalised picks",
          url: "{{all_recommendations_url}}",
          align: "center",
          backgroundColor: "#f59e0b",
          textColor: "#111827",
          fontSize: 17,
          fontWeight: "bold",
          borderRadius: 999,
          paddingTop: 18,
          paddingBottom: 18,
          paddingLeft: 40,
          paddingRight: 40
        }
      },
      {
        id: "ps_spacer_16",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ps_social_1",
        type: "social-follow",
        meta: {
          links: [
            { provider: "Instagram", url: "{{instagram_url}}" },
            { provider: "TikTok", url: "{{tiktok_url}}" }
          ],
          placement: "center"
        }
      }
    ]
  };
}

function createPersonalizedOfferTemplate() {
  return {
    id: 'personalized-offer',
    title: 'Personalized Offer',
    blocks: [
      {
        id: "po_logo_1",
        type: "image",
        meta: {
          src: "{{store_logo}}",
          url: "{{store_url}}",
          width: 160,
          align: "center"
        }
      },
      {
        id: "po_spacer_1",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "po_title_1",
        type: "text",
        meta: {
          content: "A personal offer just for you, {{first_name}} 🎁",
          align: "center",
          fontSize: 28,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "po_spacer_2",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "po_text_1",
        type: "text",
        meta: {
          content: "We noticed you've shown love for <strong>{{product_name}}</strong>, so we put together a private offer tailored for you.<br><br>This isn't a public promo — it's a thank-you for being part of the community.",
          align: "left",
          fontSize: 16,
          color: "#111827"
        }
      },
      {
        id: "po_spacer_3",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "po_divider_1",
        type: "divider",
        meta: { color: "#E5E7EB" }
      },
      {
        id: "po_spacer_4",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "po_title_2",
        type: "text",
        meta: {
          content: "Your offer",
          align: "left",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "po_spacer_5",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "po_text_2",
        type: "text",
        meta: {
          content: "<div style=\"font-size:18px;line-height:1.6;\">✅ <strong>{{offer_type}}</strong><br>{{offer_details}}</div><br><div style=\"font-size:20px;font-weight:800;letter-spacing:1px;\">{{offer_code}}</div><div style=\"margin-top:6px;font-size:14px;color:#6b7280;\">Valid for {{offer_expiry_days}} days</div>",
          align: "left",
          fontSize: 16,
          color: "#111827"
        }
      },
      {
        id: "po_spacer_6",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "po_button_1",
        type: "button",
        meta: {
          text: "Claim my offer",
          url: "{{offer_url}}",
          align: "center",
          backgroundColor: "#6e54d7",
          textColor: "#ffffff",
          fontSize: 17,
          fontWeight: "bold",
          borderRadius: 999,
          paddingTop: 18,
          paddingBottom: 18,
          paddingLeft: 40,
          paddingRight: 40
        }
      },
      {
        id: "po_spacer_7",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "po_divider_2",
        type: "divider",
        meta: { color: "#E5E7EB" }
      },
      {
        id: "po_spacer_8",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "po_title_3",
        type: "text",
        meta: {
          content: "Picked because you bought {{product_name}}",
          align: "left",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "po_spacer_9",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "po_text_3",
        type: "text",
        meta: {
          content: "These are the most common \"next buys\" from customers who started with {{product_name}}:<br><br>• Matching accessories<br>• A premium upgrade version<br>• Gift editions for friends/family<br><br>Your offer works on all of these too.",
          align: "left",
          fontSize: 16,
          color: "#111827"
        }
      },
      {
        id: "po_spacer_10",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "po_button_2",
        type: "button",
        meta: {
          text: "See my picks",
          url: "{{recommendations_url}}",
          align: "center",
          backgroundColor: "#111827",
          textColor: "#ffffff",
          fontSize: 16,
          fontWeight: "bold",
          borderRadius: 999,
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 40,
          paddingRight: 40
        }
      },
      {
        id: "po_spacer_11",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "po_image_1",
        type: "image",
        meta: {
          src: "{{offer_banner_image}}",
          url: "{{offer_url}}",
          width: 600,
          align: "center"
        }
      },
      {
        id: "po_spacer_12",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "po_divider_3",
        type: "divider",
        meta: { color: "#E5E7EB" }
      },
      {
        id: "po_spacer_13",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "po_text_4",
        type: "text",
        meta: {
          content: "If you've got any questions about your {{product_name}}<br>just reply to this email — we're here for you. 💬",
          align: "center",
          fontSize: 16,
          color: "#111827"
        }
      },
      {
        id: "po_spacer_14",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "po_social_1",
        type: "social-follow",
        meta: {
          links: [
            { provider: "Instagram", url: "{{instagram_url}}" },
            { provider: "Facebook", url: "{{facebook_url}}" }
          ],
          placement: "center"
        }
      }
    ]
  };
}

function createCartReminderTemplate() {
  return {
    id: 'cart-reminder',
    title: 'Cart Reminder',
    blocks: [
      {
        id: "cr_logo_1",
        type: "image",
        meta: {
          src: "{{store_logo}}",
          url: "{{store_url}}",
          width: 160,
          align: "center"
        }
      },
      {
        id: "cr_spacer_1",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "cr_title_1",
        type: "text",
        meta: {
          content: "You left something behind, {{first_name}} 👀",
          align: "center",
          fontSize: 28,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "cr_spacer_2",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "cr_text_1",
        type: "text",
        meta: {
          content: "We noticed you added some items to your cart but didn't complete your order.<br><br>No worries! We've saved everything for you — just click below to pick up where you left off.",
          align: "left",
          fontSize: 16,
          color: "#111827"
        }
      },
      {
        id: "cr_spacer_3",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "cr_div_1",
        type: "divider",
        meta: { color: "#E5E7EB" }
      },
      {
        id: "cr_spacer_4",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "cr_title_2",
        type: "text",
        meta: {
          content: "Items waiting in your cart",
          align: "left",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "cr_spacer_5",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "cr_cart_image_1",
        type: "image",
        meta: {
          src: "{{cart_items_image}}",
          url: "{{cart_url}}",
          width: 600,
          align: "center"
        }
      },
      {
        id: "cr_spacer_6",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "cr_text_2",
        type: "text",
        meta: {
          content: "<strong>{{cart_item_count}} items</strong> waiting for you<br>Total: <strong>{{cart_total}}</strong>",
          align: "center",
          fontSize: 16,
          color: "#111827"
        }
      },
      {
        id: "cr_spacer_7",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "cr_button_1",
        type: "button",
        meta: {
          text: "Complete your order",
          url: "{{cart_url}}",
          align: "center",
          backgroundColor: "#10b981",
          textColor: "#ffffff",
          fontSize: 17,
          fontWeight: "bold",
          borderRadius: 999,
          paddingTop: 18,
          paddingBottom: 18,
          paddingLeft: 40,
          paddingRight: 40
        }
      },
      {
        id: "cr_spacer_8",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "cr_div_2",
        type: "divider",
        meta: { color: "#E5E7EB" }
      },
      {
        id: "cr_spacer_9",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "cr_text_3",
        type: "text",
        meta: {
          content: "<strong>⏰ Don't miss out!</strong><br><br>These items are popular and sell fast. Complete your order now to secure yours before they're gone.",
          align: "center",
          fontSize: 16,
          color: "#111827"
        }
      },
      {
        id: "cr_spacer_10",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "cr_text_4",
        type: "text",
        meta: {
          content: "✓ Free shipping on orders over {{free_shipping_threshold}}<br>✓ Secure checkout<br>✓ 30-day return guarantee",
          align: "left",
          fontSize: 15,
          color: "#6b7280"
        }
      },
      {
        id: "cr_spacer_11",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "cr_div_3",
        type: "divider",
        meta: { color: "#E5E7EB" }
      },
      {
        id: "cr_spacer_12",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "cr_text_5",
        type: "text",
        meta: {
          content: "Need help deciding?<br>Our support team is here to answer any questions.",
          align: "center",
          fontSize: 16,
          color: "#111827"
        }
      },
      {
        id: "cr_spacer_13",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "cr_button_2",
        type: "button",
        meta: {
          text: "Contact support",
          url: "{{support_url}}",
          align: "center",
          backgroundColor: "#6e54d7",
          textColor: "#ffffff",
          fontSize: 16,
          fontWeight: "bold",
          borderRadius: 999,
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 40,
          paddingRight: 40
        }
      },
      {
        id: "cr_spacer_14",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "cr_social_1",
        type: "social-follow",
        meta: {
          links: [
            { provider: "Instagram", url: "{{instagram_url}}" },
            { provider: "Facebook", url: "{{facebook_url}}" }
          ],
          placement: "center"
        }
      }
    ]
  };
}

function createNeedHelpTemplate() {
  return {
    id: 'need-help',
    title: 'Need Help?',
    blocks: [
      {
        id: "nh_logo_1",
        type: "image",
        meta: {
          src: "{{store_logo}}",
          url: "{{store_url}}",
          width: 160,
          align: "center"
        }
      },
      {
        id: "nh_spacer_1",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "nh_title_1",
        type: "text",
        meta: {
          content: "Need help with your {{product_name}}?",
          align: "center",
          fontSize: 28,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "nh_spacer_2",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "nh_text_1",
        type: "text",
        meta: {
          content: "Hey {{first_name}},\n\nWe just wanted to check in and make sure your {{product_name}} is working perfectly. If anything feels confusing, tricky, or not quite right — we're here for you.\n\nMost questions get answered in under an hour.",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "nh_spacer_3",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "nh_divider_1",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "nh_spacer_4",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "nh_title_2",
        type: "text",
        meta: {
          content: "Quick fixes for common issues",
          align: "left",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "nh_spacer_5",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "nh_text_2",
        type: "text",
        meta: {
          content: "Here are a few things that solve 90% of questions:\n\n• Double-check all connections\n• Restart your device or unplug/plug back in\n• Make sure your app or browser is updated\n• If using smart control: confirm Bluetooth/Wi-Fi is on\n\nStill stuck? Just hit reply — we're actually very friendly 😊",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "nh_spacer_6",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "nh_divider_2",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "nh_spacer_7",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "nh_title_3",
        type: "text",
        meta: {
          content: "We're here to help",
          align: "left",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "nh_spacer_8",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "nh_text_3",
        type: "text",
        meta: {
          content: "You can reach us any time — just reply to this email or message us here:\n\nEmail: {{support_email}}\nMessenger: {{support_url}}\n\nOur team LOVES solving problems quickly.",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "nh_spacer_9",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "nh_button_1",
        type: "button",
        meta: {
          content: "Contact Support",
          url: "{{support_url}}",
          align: "center",
          backgroundColor: "#6e54d7",
          textColor: "#ffffff",
          paddingTop: 18,
          paddingBottom: 18,
          paddingLeft: 40,
          paddingRight: 40,
          borderRadius: 999,
          fontSize: 17,
          fontWeight: "bold"
        }
      },
      {
        id: "nh_spacer_10",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "nh_divider_3",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "nh_spacer_11",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "nh_text_4",
        type: "text",
        meta: {
          content: "PS — If you're enjoying your {{product_name}}, you might love these too:\n\n• Matching accessories\n• Upgraded versions\n• Gift options for family & friends\n\nWe keep your past purchases in mind to pick the best suggestions.",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "nh_spacer_12",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "nh_button_2",
        type: "button",
        meta: {
          content: "See recommended items",
          url: "{{recommended_products_url}}",
          align: "center",
          backgroundColor: "#111827",
          textColor: "#ffffff",
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 40,
          paddingRight: 40,
          borderRadius: 999,
          fontSize: 16,
          fontWeight: "bold"
        }
      },
      {
        id: "nh_spacer_13",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "nh_social_1",
        type: "social-follow",
        meta: {
          placement: "center",
          links: [
            { provider: "Instagram", url: "{{instagram_url}}" },
            { provider: "Facebook", url: "{{facebook_url}}" }
          ]
        }
      }
    ]
  };
}

function createCartDiscountTemplate() {
  return { id: 'cart-discount', title: 'Cart Discount', blocks: [] };
}

function createDeluxeUpgradeTemplate() {
  return {
    id: 'deluxe-upgrade',
    title: 'Deluxe Upgrade',
    blocks: [
      {
        id: "du_logo_1",
        type: "image",
        meta: {
          src: "{{store_logo}}",
          url: "{{store_url}}",
          width: 160,
          align: "center"
        }
      },
      {
        id: "du_spacer_1",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "du_title_1",
        type: "text",
        meta: {
          content: "Upgrade to Deluxe, {{first_name}}? ✨",
          align: "center",
          fontSize: 28,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "du_spacer_2",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "du_text_1",
        type: "text",
        meta: {
          content: "You got the {{product_name}} — and we think you're going to love it.\n\nBut what if we told you there's a deluxe version with even more features, better performance, and extras that make it truly special?\n\nFor a limited time, we're offering you an exclusive upgrade deal.",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "du_spacer_3",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "du_divider_1",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "du_spacer_4",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "du_title_2",
        type: "text",
        meta: {
          content: "What makes Deluxe worth it?",
          align: "left",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "du_spacer_5",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "du_text_2",
        type: "text",
        meta: {
          content: "Here's what you get when you upgrade to {{deluxe_product_name}}:\n\n• {{feature_1}}\n• {{feature_2}}\n• {{feature_3}}\n• {{feature_4}}\n• Extended warranty and priority support\n\nPlus, you'll keep your original {{product_name}} — think of it as a backup, or gift it to someone special.",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "du_spacer_6",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "du_image_1",
        type: "image",
        meta: {
          src: "{{deluxe_product_image}}",
          url: "{{deluxe_product_url}}",
          width: 500,
          align: "center"
        }
      },
      {
        id: "du_spacer_7",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "du_divider_2",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "du_spacer_8",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "du_title_3",
        type: "text",
        meta: {
          content: "Your exclusive upgrade price",
          align: "center",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "du_spacer_9",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "du_text_3",
        type: "text",
        meta: {
          content: "Normally {{deluxe_regular_price}}\nYour upgrade price: {{upgrade_price}}\nYou save: {{savings_amount}}\n\nThis offer expires in {{expiry_hours}} hours.",
          align: "center",
          fontSize: 18,
          fontWeight: "bold",
          color: "#f59e0b"
        }
      },
      {
        id: "du_spacer_10",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "du_button_1",
        type: "button",
        meta: {
          content: "Upgrade to Deluxe",
          url: "{{upgrade_url}}",
          align: "center",
          backgroundColor: "#f59e0b",
          textColor: "#ffffff",
          paddingTop: 18,
          paddingBottom: 18,
          paddingLeft: 40,
          paddingRight: 40,
          borderRadius: 999,
          fontSize: 17,
          fontWeight: "bold"
        }
      },
      {
        id: "du_spacer_11",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "du_divider_3",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "du_spacer_12",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "du_text_4",
        type: "text",
        meta: {
          content: "Not sure? No pressure. You can keep enjoying your {{product_name}} exactly as it is.\n\nBut if you want the absolute best experience, this is your moment.\n\nQuestions? Just reply to this email — we're here to help.",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "du_spacer_13",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "du_button_2",
        type: "button",
        meta: {
          content: "Learn more about Deluxe",
          url: "{{deluxe_details_url}}",
          align: "center",
          backgroundColor: "#111827",
          textColor: "#ffffff",
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 40,
          paddingRight: 40,
          borderRadius: 999,
          fontSize: 16,
          fontWeight: "bold"
        }
      },
      {
        id: "du_spacer_14",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "du_social_1",
        type: "social-follow",
        meta: {
          placement: "center",
          links: [
            { provider: "Instagram", url: "{{instagram_url}}" },
            { provider: "Facebook", url: "{{facebook_url}}" }
          ]
        }
      }
    ]
  };
}

function createAccessoryOfferTemplate() {
  return {
    id: 'accessory-offer',
    title: 'Accessory Offer',
    blocks: [
      {
        id: "ao_logo_1",
        type: "image",
        meta: {
          src: "{{store_logo}}",
          url: "{{store_url}}",
          width: 160,
          align: "center"
        }
      },
      {
        id: "ao_spacer_1",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ao_title_1",
        type: "text",
        meta: {
          content: "Complete your {{product_name}}, {{first_name}} 🎯",
          align: "center",
          fontSize: 28,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "ao_spacer_2",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "ao_text_1",
        type: "text",
        meta: {
          content: "You've got great taste — your {{product_name}} is going to serve you well.\n\nWe wanted to let you know about a few accessories that pair perfectly with it. These aren't just add-ons — they're the finishing touches that make the whole experience better.",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "ao_spacer_3",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ao_divider_1",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "ao_spacer_4",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ao_title_2",
        type: "text",
        meta: {
          content: "{{accessory_1_name}}",
          align: "left",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "ao_spacer_5",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "ao_image_1",
        type: "image",
        meta: {
          src: "{{accessory_1_image}}",
          url: "{{accessory_1_url}}",
          width: 400,
          align: "center"
        }
      },
      {
        id: "ao_spacer_6",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "ao_text_2",
        type: "text",
        meta: {
          content: "{{accessory_1_description}}\n\nPrice: {{accessory_1_price}}",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "ao_spacer_7",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "ao_button_1",
        type: "button",
        meta: {
          content: "Add to cart",
          url: "{{accessory_1_url}}",
          align: "center",
          backgroundColor: "#6e54d7",
          textColor: "#ffffff",
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 40,
          paddingRight: 40,
          borderRadius: 999,
          fontSize: 16,
          fontWeight: "bold"
        }
      },
      {
        id: "ao_spacer_8",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ao_divider_2",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "ao_spacer_9",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ao_title_3",
        type: "text",
        meta: {
          content: "{{accessory_2_name}}",
          align: "left",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "ao_spacer_10",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "ao_image_2",
        type: "image",
        meta: {
          src: "{{accessory_2_image}}",
          url: "{{accessory_2_url}}",
          width: 400,
          align: "center"
        }
      },
      {
        id: "ao_spacer_11",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "ao_text_3",
        type: "text",
        meta: {
          content: "{{accessory_2_description}}\n\nPrice: {{accessory_2_price}}",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "ao_spacer_12",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "ao_button_2",
        type: "button",
        meta: {
          content: "Add to cart",
          url: "{{accessory_2_url}}",
          align: "center",
          backgroundColor: "#6e54d7",
          textColor: "#ffffff",
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 40,
          paddingRight: 40,
          borderRadius: 999,
          fontSize: 16,
          fontWeight: "bold"
        }
      },
      {
        id: "ao_spacer_13",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ao_divider_3",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "ao_spacer_14",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ao_text_4",
        type: "text",
        meta: {
          content: "Want to see all accessories that work with {{product_name}}? We've got protective cases, charging cables, stands, and more.",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "ao_spacer_15",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "ao_button_3",
        type: "button",
        meta: {
          content: "Browse all accessories",
          url: "{{all_accessories_url}}",
          align: "center",
          backgroundColor: "#111827",
          textColor: "#ffffff",
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 40,
          paddingRight: 40,
          borderRadius: 999,
          fontSize: 16,
          fontWeight: "bold"
        }
      },
      {
        id: "ao_spacer_16",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ao_social_1",
        type: "social-follow",
        meta: {
          placement: "center",
          links: [
            { provider: "Instagram", url: "{{instagram_url}}" },
            { provider: "TikTok", url: "{{tiktok_url}}" }
          ]
        }
      }
    ]
  };
}

function createCustomersAlsoBoughtTemplate() {
  return {
    id: 'customers-also-bought',
    title: 'Customers Also Bought',
    blocks: [
      {
        id: "cab_logo_1",
        type: "image",
        meta: {
          src: "{{store_logo}}",
          url: "{{store_url}}",
          width: 160,
          align: "center"
        }
      },
      {
        id: "cab_spacer_1",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "cab_title_1",
        type: "text",
        meta: {
          content: "People who bought {{product_name}} also loved these 💡",
          align: "center",
          fontSize: 28,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "cab_spacer_2",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "cab_text_1",
        type: "text",
        meta: {
          content: "Hey {{first_name}},\n\nWe thought you'd like to know what other customers picked up after getting their {{product_name}}.\n\nThese are the top 3 most-purchased items — real customer favorites, not just random picks.",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "cab_spacer_3",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "cab_divider_1",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "cab_spacer_4",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "cab_title_2",
        type: "text",
        meta: {
          content: "#1 Most Popular: {{popular_1_name}}",
          align: "left",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "cab_spacer_5",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "cab_image_1",
        type: "image",
        meta: {
          src: "{{popular_1_image}}",
          url: "{{popular_1_url}}",
          width: 400,
          align: "center"
        }
      },
      {
        id: "cab_spacer_6",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "cab_text_2",
        type: "text",
        meta: {
          content: "{{popular_1_description}}\n\n⭐ {{popular_1_rating}} stars ({{popular_1_reviews}} reviews)\nPrice: {{popular_1_price}}",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "cab_spacer_7",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "cab_button_1",
        type: "button",
        meta: {
          content: "View this item",
          url: "{{popular_1_url}}",
          align: "center",
          backgroundColor: "#6e54d7",
          textColor: "#ffffff",
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 40,
          paddingRight: 40,
          borderRadius: 999,
          fontSize: 16,
          fontWeight: "bold"
        }
      },
      {
        id: "cab_spacer_8",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "cab_divider_2",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "cab_spacer_9",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "cab_title_3",
        type: "text",
        meta: {
          content: "#2 Customer Pick: {{popular_2_name}}",
          align: "left",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "cab_spacer_10",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "cab_image_2",
        type: "image",
        meta: {
          src: "{{popular_2_image}}",
          url: "{{popular_2_url}}",
          width: 400,
          align: "center"
        }
      },
      {
        id: "cab_spacer_11",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "cab_text_3",
        type: "text",
        meta: {
          content: "{{popular_2_description}}\n\n⭐ {{popular_2_rating}} stars ({{popular_2_reviews}} reviews)\nPrice: {{popular_2_price}}",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "cab_spacer_12",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "cab_button_2",
        type: "button",
        meta: {
          content: "View this item",
          url: "{{popular_2_url}}",
          align: "center",
          backgroundColor: "#6e54d7",
          textColor: "#ffffff",
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 40,
          paddingRight: 40,
          borderRadius: 999,
          fontSize: 16,
          fontWeight: "bold"
        }
      },
      {
        id: "cab_spacer_13",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "cab_divider_3",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "cab_spacer_14",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "cab_title_4",
        type: "text",
        meta: {
          content: "#3 Hidden Gem: {{popular_3_name}}",
          align: "left",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "cab_spacer_15",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "cab_image_3",
        type: "image",
        meta: {
          src: "{{popular_3_image}}",
          url: "{{popular_3_url}}",
          width: 400,
          align: "center"
        }
      },
      {
        id: "cab_spacer_16",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "cab_text_4",
        type: "text",
        meta: {
          content: "{{popular_3_description}}\n\n⭐ {{popular_3_rating}} stars ({{popular_3_reviews}} reviews)\nPrice: {{popular_3_price}}",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "cab_spacer_17",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "cab_button_3",
        type: "button",
        meta: {
          content: "View this item",
          url: "{{popular_3_url}}",
          align: "center",
          backgroundColor: "#6e54d7",
          textColor: "#ffffff",
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 40,
          paddingRight: 40,
          borderRadius: 999,
          fontSize: 16,
          fontWeight: "bold"
        }
      },
      {
        id: "cab_spacer_18",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "cab_divider_4",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "cab_spacer_19",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "cab_text_5",
        type: "text",
        meta: {
          content: "These picks are based on real purchase data from {{customer_count}}+ customers who bought {{product_name}}.\n\nWant to explore more? Browse our full collection.",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "cab_spacer_20",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "cab_button_4",
        type: "button",
        meta: {
          content: "Shop all products",
          url: "{{shop_url}}",
          align: "center",
          backgroundColor: "#111827",
          textColor: "#ffffff",
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 40,
          paddingRight: 40,
          borderRadius: 999,
          fontSize: 16,
          fontWeight: "bold"
        }
      },
      {
        id: "cab_spacer_21",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "cab_social_1",
        type: "social-follow",
        meta: {
          placement: "center",
          links: [
            { provider: "Instagram", url: "{{instagram_url}}" },
            { provider: "Facebook", url: "{{facebook_url}}" }
          ]
        }
      }
    ]
  };
}

function createAIRecommendationsTemplate() {
  return { id: 'ai-recommendations', title: 'AI Recommendations', blocks: [] };
}

function createSmartSuggestionTemplate() {
  return { id: 'smart-suggestion', title: 'Smart Suggestion', blocks: [] };
}

function createTrendingProductsTemplate() {
  return { id: 'trending-products', title: 'Trending Products', blocks: [] };
}

function createCheckIn7DayTemplate() {
  return { id: 'check-in-7day', title: '7-Day Check-in', blocks: [] };
}

function createPhotoIncentiveTemplate() {
  return { id: 'photo-incentive', title: 'Photo Incentive', blocks: [] };
}

function createMatchingPieceTemplate() {
  return { id: 'matching-piece', title: 'Matching Piece', blocks: [] };
}

function createAnniversaryTemplate() {
  return {
    id: 'anniversary',
    title: 'Anniversary',
    blocks: [
      {
        id: "ann_logo_1",
        type: "image",
        meta: {
          src: "{{store_logo}}",
          url: "{{store_url}}",
          width: 160,
          align: "center"
        }
      },
      {
        id: "ann_spacer_1",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ann_title_1",
        type: "text",
        meta: {
          content: "Happy Anniversary, {{first_name}}! 🎉",
          align: "center",
          fontSize: 28,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "ann_spacer_2",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "ann_text_1",
        type: "text",
        meta: {
          content: "It's been {{anniversary_years}} year(s) since you first joined our community, and we wanted to say thank you.\n\nYou're not just a customer — you're part of our story. And we're grateful for every moment.",
          align: "center",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "ann_spacer_3",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ann_image_1",
        type: "image",
        meta: {
          src: "{{anniversary_banner_image}}",
          url: "{{store_url}}",
          width: 500,
          align: "center"
        }
      },
      {
        id: "ann_spacer_4",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ann_divider_1",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "ann_spacer_5",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ann_title_2",
        type: "text",
        meta: {
          content: "Here's a little something from us",
          align: "center",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "ann_spacer_6",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "ann_text_2",
        type: "text",
        meta: {
          content: "To celebrate, we'd like to give you an exclusive anniversary gift:\n\n{{anniversary_discount_percent}}% off your next order\n\nUse code: {{anniversary_code}}\nValid for {{expiry_days}} days",
          align: "center",
          fontSize: 18,
          fontWeight: "bold",
          color: "#f59e0b",
          letterSpacing: "0.05em"
        }
      },
      {
        id: "ann_spacer_7",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "ann_button_1",
        type: "button",
        meta: {
          content: "Shop with {{anniversary_code}}",
          url: "{{shop_url}}",
          align: "center",
          backgroundColor: "#f59e0b",
          textColor: "#ffffff",
          paddingTop: 18,
          paddingBottom: 18,
          paddingLeft: 40,
          paddingRight: 40,
          borderRadius: 999,
          fontSize: 17,
          fontWeight: "bold"
        }
      },
      {
        id: "ann_spacer_8",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ann_divider_2",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "ann_spacer_9",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ann_title_3",
        type: "text",
        meta: {
          content: "Your journey so far",
          align: "left",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "ann_spacer_10",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "ann_text_3",
        type: "text",
        meta: {
          content: "Since joining us {{anniversary_years}} year(s) ago:\n\n• {{total_orders}} orders placed\n• {{favorite_category}} was your favorite category\n• You discovered {{products_tried}} different products\n• You saved {{total_savings}} with discounts and offers\n\nThank you for trusting us with your purchases. Here's to many more years together! 🥂",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "ann_spacer_11",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ann_divider_3",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "ann_spacer_12",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ann_text_4",
        type: "text",
        meta: {
          content: "Want to see what's new since you started? We've added tons of products you might love.",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "ann_spacer_13",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "ann_button_2",
        type: "button",
        meta: {
          content: "See what's new",
          url: "{{new_arrivals_url}}",
          align: "center",
          backgroundColor: "#6e54d7",
          textColor: "#ffffff",
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 40,
          paddingRight: 40,
          borderRadius: 999,
          fontSize: 16,
          fontWeight: "bold"
        }
      },
      {
        id: "ann_spacer_14",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ann_text_5",
        type: "text",
        meta: {
          content: "From all of us at {{brand_name}}, thank you for being part of our journey. Here's to another amazing year!\n\nWith gratitude,\nThe {{brand_name}} Team",
          align: "center",
          fontSize: 16,
          color: "#6b7280",
          fontStyle: "italic"
        }
      },
      {
        id: "ann_spacer_15",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "ann_social_1",
        type: "social-follow",
        meta: {
          placement: "center",
          links: [
            { provider: "Instagram", url: "{{instagram_url}}" },
            { provider: "Facebook", url: "{{facebook_url}}" }
          ]
        }
      }
    ]
  };
}

function createUpgradeOfferTemplate() {
  return {
    id: 'upgrade-offer',
    title: 'Upgrade Offer',
    blocks: [
      {
        id: "uo_logo_1",
        type: "image",
        meta: {
          src: "{{store_logo}}",
          url: "{{store_url}}",
          width: 160,
          align: "center"
        }
      },
      {
        id: "uo_spacer_1",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "uo_title_1",
        type: "text",
        meta: {
          content: "{{anniversary_years}} year(s) deserve an upgrade, {{first_name}} 🚀",
          align: "center",
          fontSize: 28,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "uo_spacer_2",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "uo_text_1",
        type: "text",
        meta: {
          content: "You've been with us for {{anniversary_years}} year(s) — and your {{original_product}} has served you well.\n\nBut what if we told you there's something even better?\n\nFor loyal customers like you, we're offering an exclusive anniversary upgrade deal you won't find anywhere else.",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "uo_spacer_3",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "uo_divider_1",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "uo_spacer_4",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "uo_title_2",
        type: "text",
        meta: {
          content: "Meet {{upgrade_product_name}}",
          align: "center",
          fontSize: 24,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "uo_spacer_5",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "uo_image_1",
        type: "image",
        meta: {
          src: "{{upgrade_product_image}}",
          url: "{{upgrade_product_url}}",
          width: 500,
          align: "center"
        }
      },
      {
        id: "uo_spacer_6",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "uo_text_2",
        type: "text",
        meta: {
          content: "{{upgrade_product_description}}\n\nWhat's new:\n• {{feature_1}}\n• {{feature_2}}\n• {{feature_3}}\n• {{feature_4}}\n\nPlus, we'll give you {{trade_in_value}} credit for your current {{original_product}}.",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "uo_spacer_7",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "uo_divider_2",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "uo_spacer_8",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "uo_title_3",
        type: "text",
        meta: {
          content: "Your exclusive anniversary pricing",
          align: "center",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "uo_spacer_9",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "uo_text_3",
        type: "text",
        meta: {
          content: "Regular price: {{regular_price}}\nTrade-in credit: -{{trade_in_value}}\nAnniversary discount: -{{anniversary_discount}}\n\nYour price: {{final_price}}\n\nThis offer expires in {{expiry_days}} days.",
          align: "center",
          fontSize: 18,
          fontWeight: "bold",
          color: "#f59e0b"
        }
      },
      {
        id: "uo_spacer_10",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "uo_button_1",
        type: "button",
        meta: {
          content: "Claim my upgrade offer",
          url: "{{upgrade_offer_url}}",
          align: "center",
          backgroundColor: "#f59e0b",
          textColor: "#ffffff",
          paddingTop: 18,
          paddingBottom: 18,
          paddingLeft: 40,
          paddingRight: 40,
          borderRadius: 999,
          fontSize: 17,
          fontWeight: "bold"
        }
      },
      {
        id: "uo_spacer_11",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "uo_divider_3",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "uo_spacer_12",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "uo_text_4",
        type: "text",
        meta: {
          content: "Still happy with your {{original_product}}? No problem at all — it's a great product and we're glad you love it.\n\nBut if you're ready for the next level, this is your moment.\n\nQuestions? Just reply to this email.",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "uo_spacer_13",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "uo_button_2",
        type: "button",
        meta: {
          content: "Learn more about the upgrade",
          url: "{{upgrade_details_url}}",
          align: "center",
          backgroundColor: "#111827",
          textColor: "#ffffff",
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 40,
          paddingRight: 40,
          borderRadius: 999,
          fontSize: 16,
          fontWeight: "bold"
        }
      },
      {
        id: "uo_spacer_14",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "uo_social_1",
        type: "social-follow",
        meta: {
          placement: "center",
          links: [
            { provider: "Instagram", url: "{{instagram_url}}" },
            { provider: "Facebook", url: "{{facebook_url}}" }
          ]
        }
      }
    ]
  };
}

function createMatchingProductsTemplate() {
  return {
    id: 'matching-products',
    title: 'Matching Products',
    blocks: [
      {
        id: "mp_logo_1",
        type: "image",
        meta: {
          src: "{{store_logo}}",
          url: "{{store_url}}",
          width: 160,
          align: "center"
        }
      },
      {
        id: "mp_spacer_1",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "mp_title_1",
        type: "text",
        meta: {
          content: "Perfect matches for your collection, {{first_name}} ✨",
          align: "center",
          fontSize: 28,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "mp_spacer_2",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "mp_text_1",
        type: "text",
        meta: {
          content: "It's been {{anniversary_years}} year(s) since your first order, and we've been paying attention to what you love.\n\nBased on your {{original_product}} and everything else you've picked up, we found some items that match your style perfectly.",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "mp_spacer_3",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "mp_divider_1",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "mp_spacer_4",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "mp_title_2",
        type: "text",
        meta: {
          content: "{{match_1_name}}",
          align: "left",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "mp_spacer_5",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "mp_image_1",
        type: "image",
        meta: {
          src: "{{match_1_image}}",
          url: "{{match_1_url}}",
          width: 400,
          align: "center"
        }
      },
      {
        id: "mp_spacer_6",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "mp_text_2",
        type: "text",
        meta: {
          content: "{{match_1_description}}\n\nWhy it matches: {{match_1_reason}}\n\nPrice: {{match_1_price}}",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "mp_spacer_7",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "mp_button_1",
        type: "button",
        meta: {
          content: "View product",
          url: "{{match_1_url}}",
          align: "center",
          backgroundColor: "#6e54d7",
          textColor: "#ffffff",
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 40,
          paddingRight: 40,
          borderRadius: 999,
          fontSize: 16,
          fontWeight: "bold"
        }
      },
      {
        id: "mp_spacer_8",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "mp_divider_2",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "mp_spacer_9",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "mp_title_3",
        type: "text",
        meta: {
          content: "{{match_2_name}}",
          align: "left",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "mp_spacer_10",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "mp_image_2",
        type: "image",
        meta: {
          src: "{{match_2_image}}",
          url: "{{match_2_url}}",
          width: 400,
          align: "center"
        }
      },
      {
        id: "mp_spacer_11",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "mp_text_3",
        type: "text",
        meta: {
          content: "{{match_2_description}}\n\nWhy it matches: {{match_2_reason}}\n\nPrice: {{match_2_price}}",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "mp_spacer_12",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "mp_button_2",
        type: "button",
        meta: {
          content: "View product",
          url: "{{match_2_url}}",
          align: "center",
          backgroundColor: "#6e54d7",
          textColor: "#ffffff",
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 40,
          paddingRight: 40,
          borderRadius: 999,
          fontSize: 16,
          fontWeight: "bold"
        }
      },
      {
        id: "mp_spacer_13",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "mp_divider_3",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "mp_spacer_14",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "mp_title_4",
        type: "text",
        meta: {
          content: "{{match_3_name}}",
          align: "left",
          fontSize: 22,
          fontWeight: "bold",
          color: "#111827"
        }
      },
      {
        id: "mp_spacer_15",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "mp_image_3",
        type: "image",
        meta: {
          src: "{{match_3_image}}",
          url: "{{match_3_url}}",
          width: 400,
          align: "center"
        }
      },
      {
        id: "mp_spacer_16",
        type: "spacer",
        meta: { height: 15 }
      },
      {
        id: "mp_text_4",
        type: "text",
        meta: {
          content: "{{match_3_description}}\n\nWhy it matches: {{match_3_reason}}\n\nPrice: {{match_3_price}}",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "mp_spacer_17",
        type: "spacer",
        meta: { height: 20 }
      },
      {
        id: "mp_button_3",
        type: "button",
        meta: {
          content: "View product",
          url: "{{match_3_url}}",
          align: "center",
          backgroundColor: "#6e54d7",
          textColor: "#ffffff",
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 40,
          paddingRight: 40,
          borderRadius: 999,
          fontSize: 16,
          fontWeight: "bold"
        }
      },
      {
        id: "mp_spacer_18",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "mp_divider_4",
        type: "divider",
        meta: {
          height: 1,
          backgroundColor: "#E5E7EB"
        }
      },
      {
        id: "mp_spacer_19",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "mp_text_5",
        type: "text",
        meta: {
          content: "These picks are based on your purchase history and what customers with similar taste have loved.\n\nAs a thank-you for {{anniversary_years}} year(s) with us, use code {{anniversary_code}} for {{discount_percent}}% off any of these items.",
          align: "left",
          fontSize: 16,
          color: "#6b7280"
        }
      },
      {
        id: "mp_spacer_20",
        type: "spacer",
        meta: { height: 25 }
      },
      {
        id: "mp_button_4",
        type: "button",
        meta: {
          content: "Browse all matching products",
          url: "{{matching_products_url}}",
          align: "center",
          backgroundColor: "#111827",
          textColor: "#ffffff",
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 40,
          paddingRight: 40,
          borderRadius: 999,
          fontSize: 16,
          fontWeight: "bold"
        }
      },
      {
        id: "mp_spacer_21",
        type: "spacer",
        meta: { height: 30 }
      },
      {
        id: "mp_social_1",
        type: "social-follow",
        meta: {
          placement: "center",
          links: [
            { provider: "Instagram", url: "{{instagram_url}}" },
            { provider: "TikTok", url: "{{tiktok_url}}" }
          ]
        }
      }
    ]
  };
}