# Project Reorganization Plan

## Current Problems
- 100+ test files in root directory
- Components folder has 80+ mixed files (admin, affiliate, email, products, etc.)
- Server routes mixed together
- Duplicate files (backups, corrupted files)
- No clear domain separation

## New Structure

```
fotonix.co.uk/
├── src/                          # Frontend code
│   ├── components/               # Organized by domain
│   │   ├── auth/                # Authentication
│   │   │   ├── Login.js
│   │   │   ├── Signup.js
│   │   │   ├── Account.js
│   │   │   └── EmailVerificationNotice.js
│   │   │
│   │   ├── email/               # Email & Inbox
│   │   │   ├── AdvancedInboxScreen.js
│   │   │   ├── InboxScreen.js
│   │   │   ├── DeluxeEmailClient.jsx
│   │   │   ├── MessageBody.js
│   │   │   ├── MailBuilder/
│   │   │   └── ContactManagement.jsx
│   │   │
│   │   ├── affiliate/           # Affiliate features
│   │   │   ├── AffiliateDashboard.js
│   │   │   ├── AffiliateMasterDashboard.jsx
│   │   │   ├── AffiliateLinkDashboard.js
│   │   │   ├── AffiliateSignupPage.js
│   │   │   ├── AffiliateClickCard.jsx
│   │   │   ├── AffiliateCreateProduct.js
│   │   │   ├── AffiliateAddProductPage.js
│   │   │   ├── AffiliateShopBuilderPage.js
│   │   │   └── EnhancedAffiliateStorefrontEditor.jsx
│   │   │
│   │   ├── products/            # Product displays
│   │   │   ├── ProductPage.js
│   │   │   ├── ProductPageClean.js
│   │   │   ├── ProductCard.js
│   │   │   ├── ProductCard.jsx
│   │   │   ├── Products.js
│   │   │   ├── AffiliateProductPageClean.js
│   │   │   ├── AffiliateProductPageCleanAccryl.js
│   │   │   ├── AffiliateProductCutMirror.js
│   │   │   ├── PreviewModal.js
│   │   │   ├── PreviewModalGlass.jsx
│   │   │   └── ProductFeaturesSlider.js
│   │   │
│   │   ├── designers/           # Design tools
│   │   │   ├── StandardMirrorDesigner.js
│   │   │   ├── LEDMockup.jsx
│   │   │   ├── LEDMockupGlass.jsx
│   │   │   ├── LEDMockupGlassCut.jsx
│   │   │   ├── ClearAccrylworkingscquare.js
│   │   │   ├── RainbowGIF.js
│   │   │   └── CreatePattern.js
│   │   │
│   │   ├── store-builder/       # Store building
│   │   │   ├── StorePageBuilder.jsx
│   │   │   ├── StorePageBuilderPro.jsx
│   │   │   ├── StorefrontPreviewInteractive.jsx
│   │   │   ├── storeBuilder/
│   │   │   └── AssetManager.jsx
│   │   │
│   │   ├── admin/               # Admin tools
│   │   │   ├── AdminAffiliateSettings.js
│   │   │   ├── AdminMerchantsPage.js
│   │   │   ├── MembersDashboard.jsx
│   │   │   └── MemberAffiliateLinker.jsx
│   │   │
│   │   ├── marketing/           # Marketing widgets
│   │   │   ├── ConversionChatbot.jsx
│   │   │   ├── ExitIntentPopup.jsx
│   │   │   ├── SocialProofWidgets.jsx
│   │   │   ├── UrgencyBanner.js
│   │   │   ├── funnelBuilder/
│   │   │   └── LinkChannelChart.jsx
│   │   │
│   │   ├── payments/            # Payment integration
│   │   │   ├── PayPalButton.js
│   │   │   ├── PayPalButton.tsx
│   │   │   ├── PayPalCheckout.js
│   │   │   ├── PayPalConnectButton.js
│   │   │   ├── PayPalSDKLoader.js
│   │   │   ├── PayPalSDKLoader.tsx
│   │   │   ├── SubscriptionGate.jsx
│   │   │   └── FreeTrialSignup.jsx
│   │   │
│   │   ├── landing/             # Landing page sections
│   │   │   ├── Hero.js
│   │   │   ├── HeroRedesign.jsx
│   │   │   ├── HeroWithSlider.js
│   │   │   ├── About.js
│   │   │   ├── FeaturesShowcase.jsx
│   │   │   ├── ValueTestimonials.jsx
│   │   │   ├── TestimonialsSlider.js
│   │   │   └── Footer.js
│   │   │
│   │   ├── shared/              # Shared components
│   │   │   ├── Header.js
│   │   │   ├── InfoBar.js
│   │   │   ├── ImageSlider.jsx
│   │   │   ├── ImageWithFallback.js
│   │   │   ├── ModernSlider.js
│   │   │   ├── TextEditor.jsx
│   │   │   ├── CommandPalette.jsx
│   │   │   ├── CommentModal.js
│   │   │   ├── DeviceToolbar.jsx
│   │   │   ├── sections.js
│   │   │   ├── ui/
│   │   │   └── blocks/
│   │   │
│   │   └── archive/             # Old/backup components
│   │
│   ├── config/                  # Configuration
│   ├── contexts/                # React contexts
│   ├── hooks/                   # Custom hooks
│   ├── services/                # API services
│   ├── utils/                   # Utility functions
│   ├── lib/                     # External libraries
│   ├── email/                   # Email templates
│   ├── assets/                  # Static assets
│   └── App.js
│
├── server/                      # Backend code
│   ├── routes/                  # Organized by domain
│   │   ├── auth/
│   │   │   └── custom-auth.js
│   │   ├── email/
│   │   │   ├── emails.js
│   │   │   ├── contacts.js
│   │   │   └── smtp-test.js
│   │   ├── member/
│   │   │   ├── member.js
│   │   │   └── member-business-email.js
│   │   ├── affiliate/
│   │   │   ├── affiliates.js
│   │   │   ├── clicks.js
│   │   │   └── leads.js
│   │   ├── products/
│   │   │   └── products.js
│   │   ├── merchants/
│   │   │   └── merchants.js
│   │   ├── payments/
│   │   │   ├── subscriptions.js
│   │   │   ├── capture-order.js
│   │   │   └── create-order.js
│   │   ├── marketing/
│   │   │   └── chatbot.js
│   │   └── webhooks/
│   │       └── webhook.js
│   │
│   ├── services/                # Business logic
│   │   ├── email/
│   │   │   ├── smtp.js
│   │   │   └── templates.js
│   │   ├── ai/
│   │   │   ├── openai.js
│   │   │   └── aiBlend.js
│   │   ├── payments/
│   │   │   └── paypal.js
│   │   └── campaigns/
│   │       └── campaigns.js
│   │
│   ├── middleware/              # Express middleware
│   ├── utils/                   # Backend utilities
│   │   └── utils.js
│   ├── config/                  # Server configuration
│   ├── db.js                    # Database connection
│   └── index.js                 # Server entry point
│
├── database/                    # Database related
│   ├── migrations/              # DB migrations
│   ├── seeds/                   # Seed data
│   └── schema/                  # Schema definitions
│
├── scripts/                     # Utility scripts
│   ├── migrations/              # Migration runners
│   │   ├── migrate-standalone.js
│   │   └── run-migration-now.js
│   ├── setup/                   # Setup scripts
│   │   ├── setup-database.js
│   │   ├── setup-affiliate-tables.js
│   │   ├── setup-lead-tables.js
│   │   ├── setup-products-table.js
│   │   └── setup-subscription-tables.js
│   ├── test/                    # Test data generators
│   │   ├── create-test-contacts.js
│   │   ├── create-test-emails.js
│   │   └── create-sample-products.js
│   └── dev/                     # Development helpers
│       ├── check-db.js
│       ├── check-dns.js
│       └── check-schema.js
│
├── tests/                       # Test files
│   ├── api/
│   │   ├── test-api-endpoints.js
│   │   ├── test-routes.js
│   │   ├── test-business-emails-api.js
│   │   └── test-inbox-api.js
│   ├── email/
│   │   ├── test-vps-mail.js
│   │   ├── test-quick-email.js
│   │   ├── test-real-email.js
│   │   └── test-custom-verification.js
│   ├── integration/
│   │   ├── test-signup.js
│   │   ├── test-business-email-creation.js
│   │   └── test-vps-integration.js
│   └── unit/
│
├── docs/                        # Documentation
│   ├── ARCHITECTURE.md
│   ├── SYSTEM_ARCHITECTURE.md
│   ├── API_DOCUMENTATION.md
│   ├── setup/
│   │   ├── SSH_CONNECTION_GUIDE.md
│   │   ├── setup-mail-server.sh
│   │   └── dns-records-vps.md
│   ├── guides/
│   │   ├── MULTIPLE_EMAIL_ADDRESSES.md
│   │   ├── VPS_MAIL_INTEGRATION.md
│   │   ├── PRODUCTION_EMAIL_QUICKSTART.md
│   │   └── CONVERSION_FUNNEL_STRATEGY.md
│   └── checklists/
│       ├── PRE-PRODUCTION-CHECKLIST.md
│       └── PRODUCTION_READINESS_AUDIT.md
│
├── config/                      # Project configuration
│   ├── .env.example
│   ├── craco.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
└── public/                      # Static public files

## Files to Archive (Backups/Duplicates)
- components/APPCAAIDONOTTOUCHBACKUP.js
- components/bigpopupbackup.js
- components/BUPRODUCTPAGECLEAN.js
- components/cleanproductbackup11op20251441.js
- components/OtherStyleProduct.js
- components/ProductPageClean.js.backup
- components/ProductPageClean.js.corrupt.bak
- components/ProductPageClean_Fixed.js
- server/client_out.json
- server/reddit_tokens.json
- All .log files → logs/ folder

## Migration Strategy
1. ✅ Create new folder structure
2. ✅ Move components to domain folders
3. ✅ Move server routes to domain folders
4. ✅ Consolidate test files
5. ✅ Consolidate documentation
6. ✅ Consolidate scripts
7. ✅ Update all import paths
8. ✅ Archive backup files
9. ✅ Test that everything still works

## Benefits
- Easy to find related files
- Clear separation of concerns
- Easier onboarding for new developers
- Better scalability
- Easier to maintain and test specific domains
