# Project Reorganization Script
# This script moves files to their new organized locations

Write-Host "🔄 Starting project reorganization..." -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"
$moved = 0
$errors = 0

function Move-FileIfExists {
    param(
        [string]$Source,
        [string]$Destination
    )
    
    if (Test-Path $Source) {
        try {
            $destDir = Split-Path -Parent $Destination
            if (-not (Test-Path $destDir)) {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }
            Move-Item -Path $Source -Destination $Destination -Force
            Write-Host "✓ Moved: $(Split-Path -Leaf $Source)" -ForegroundColor Green
            $script:moved++
        }
        catch {
            Write-Host "✗ Error moving $(Split-Path -Leaf $Source): $_" -ForegroundColor Red
            $script:errors++
        }
    }
}

# ==========================================
# FRONTEND COMPONENTS REORGANIZATION
# ==========================================

Write-Host "📦 Reorganizing Frontend Components..." -ForegroundColor Yellow

# Auth Components
Move-FileIfExists "src\components\Login.js" "src\components\auth\Login.js"
Move-FileIfExists "src\components\Signup.js" "src\components\auth\Signup.js"
Move-FileIfExists "src\components\Account.js" "src\components\auth\Account.js"
Move-FileIfExists "src\components\EmailVerificationNotice.js" "src\components\auth\EmailVerificationNotice.js"
Move-FileIfExists "src\components\AccountEditModal.js" "src\components\auth\AccountEditModal.js"

# Email Components
Move-FileIfExists "src\components\AdvancedInboxScreen.js" "src\components\email\AdvancedInboxScreen.js"
Move-FileIfExists "src\components\InboxScreen.js" "src\components\email\InboxScreen.js"
Move-FileIfExists "src\components\DeluxeEmailClient.jsx" "src\components\email\DeluxeEmailClient.jsx"
Move-FileIfExists "src\components\MessageBody.js" "src\components\email\MessageBody.js"
Move-FileIfExists "src\components\ContactManagement.jsx" "src\components\email\ContactManagement.jsx"
if (Test-Path "src\components\MailBuilder") {
    Move-Item "src\components\MailBuilder" "src\components\email\MailBuilder" -Force -ErrorAction SilentlyContinue
}

# Affiliate Components
Move-FileIfExists "src\components\AffiliateDashboard.js" "src\components\affiliate\AffiliateDashboard.js"
Move-FileIfExists "src\components\AffiliateMasterDashboard.jsx" "src\components\affiliate\AffiliateMasterDashboard.jsx"
Move-FileIfExists "src\components\AffiliateDashboardclick.jsx" "src\components\affiliate\AffiliateDashboardclick.jsx"
Move-FileIfExists "src\components\AffiliateLinkDashboard.js" "src\components\affiliate\AffiliateLinkDashboard.js"
Move-FileIfExists "src\components\AffiliateSignupPage.js" "src\components\affiliate\AffiliateSignupPage.js"
Move-FileIfExists "src\components\AffiliateClickCard.jsx" "src\components\affiliate\AffiliateClickCard.jsx"
Move-FileIfExists "src\components\AffiliateCreateProduct.js" "src\components\affiliate\AffiliateCreateProduct.js"
Move-FileIfExists "src\components\AffiliateAddProductPage.js" "src\components\affiliate\AffiliateAddProductPage.js"
Move-FileIfExists "src\components\AffiliateShopBuilderPage.js" "src\components\affiliate\AffiliateShopBuilderPage.js"
Move-FileIfExists "src\components\EnhancedAffiliateStorefrontEditor.jsx" "src\components\affiliate\EnhancedAffiliateStorefrontEditor.jsx"

# Product Components
Move-FileIfExists "src\components\ProductPage.js" "src\components\products\ProductPage.js"
Move-FileIfExists "src\components\ProductPageClean.js" "src\components\products\ProductPageClean.js"
Move-FileIfExists "src\components\ProductCard.js" "src\components\products\ProductCard.js"
Move-FileIfExists "src\components\ProductCard.jsx" "src\components\products\ProductCard.jsx"
Move-FileIfExists "src\components\Products.js" "src\components\products\Products.js"
Move-FileIfExists "src\components\AffiliateProductPageClean.js" "src\components\products\AffiliateProductPageClean.js"
Move-FileIfExists "src\components\AffiliateProductPageCleanAccryl.js" "src\components\products\AffiliateProductPageCleanAccryl.js"
Move-FileIfExists "src\components\AffiliateProductCutMirror.js" "src\components\products\AffiliateProductCutMirror.js"
Move-FileIfExists "src\components\PreviewModal.js" "src\components\products\PreviewModal.js"
Move-FileIfExists "src\components\PreviewModalGlass.jsx" "src\components\products\PreviewModalGlass.jsx"
Move-FileIfExists "src\components\ProductFeaturesSlider.js" "src\components\products\ProductFeaturesSlider.js"

# Designer Components
Move-FileIfExists "src\components\StandardMirrorDesigner.js" "src\components\designers\StandardMirrorDesigner.js"
Move-FileIfExists "src\components\LEDMockup.jsx" "src\components\designers\LEDMockup.jsx"
Move-FileIfExists "src\components\LEDMockupGlass.jsx" "src\components\designers\LEDMockupGlass.jsx"
Move-FileIfExists "src\components\LEDMockupGlassCut.jsx" "src\components\designers\LEDMockupGlassCut.jsx"
Move-FileIfExists "src\components\ClearAccrylworkingscquare.js" "src\components\designers\ClearAccrylworkingscquare.js"
Move-FileIfExists "src\components\RainbowGIF.js" "src\components\designers\RainbowGIF.js"
Move-FileIfExists "src\components\CreatePattern.js" "src\components\designers\CreatePattern.js"
Move-FileIfExists "src\components\AcrylicComposerWithMask.js" "src\components\designers\AcrylicComposerWithMask.js"

# Store Builder Components
Move-FileIfExists "src\components\StorePageBuilder.jsx" "src\components\store-builder\StorePageBuilder.jsx"
Move-FileIfExists "src\components\StorePageBuilderPro.jsx" "src\components\store-builder\StorePageBuilderPro.jsx"
Move-FileIfExists "src\components\StorefrontPreviewInteractive.jsx" "src\components\store-builder\StorefrontPreviewInteractive.jsx"
Move-FileIfExists "src\components\AssetManager.jsx" "src\components\store-builder\AssetManager.jsx"
if (Test-Path "src\components\storeBuilder") {
    Move-Item "src\components\storeBuilder" "src\components\store-builder\storeBuilder" -Force -ErrorAction SilentlyContinue
}

# Admin Components
Move-FileIfExists "src\components\AdminAffiliateSettings.js" "src\components\admin\AdminAffiliateSettings.js"
Move-FileIfExists "src\components\AdminMerchantsPage.js" "src\components\admin\AdminMerchantsPage.js"
Move-FileIfExists "src\components\MembersDashboard.jsx" "src\components\admin\MembersDashboard.jsx"
Move-FileIfExists "src\components\MemberAffiliateLinker.jsx" "src\components\admin\MemberAffiliateLinker.jsx"

# Marketing Components
Move-FileIfExists "src\components\ConversionChatbot.jsx" "src\components\marketing\ConversionChatbot.jsx"
Move-FileIfExists "src\components\ExitIntentPopup.jsx" "src\components\marketing\ExitIntentPopup.jsx"
Move-FileIfExists "src\components\SocialProofWidgets.jsx" "src\components\marketing\SocialProofWidgets.jsx"
Move-FileIfExists "src\components\UrgencyBanner.js" "src\components\marketing\UrgencyBanner.js"
Move-FileIfExists "src\components\LinkChannelChart.jsx" "src\components\marketing\LinkChannelChart.jsx"
if (Test-Path "src\components\funnelBuilder") {
    Move-Item "src\components\funnelBuilder" "src\components\marketing\funnelBuilder" -Force -ErrorAction SilentlyContinue
}

# Payment Components
Move-FileIfExists "src\components\PayPalButton.js" "src\components\payments\PayPalButton.js"
Move-FileIfExists "src\components\PayPalButton.tsx" "src\components\payments\PayPalButton.tsx"
Move-FileIfExists "src\components\PayPalCheckout.js" "src\components\payments\PayPalCheckout.js"
Move-FileIfExists "src\components\PayPalConnectButton.js" "src\components\payments\PayPalConnectButton.js"
Move-FileIfExists "src\components\PayPalSDKLoader.js" "src\components\payments\PayPalSDKLoader.js"
Move-FileIfExists "src\components\PayPalSDKLoader.tsx" "src\components\payments\PayPalSDKLoader.tsx"
Move-FileIfExists "src\components\SubscriptionGate.jsx" "src\components\payments\SubscriptionGate.jsx"
Move-FileIfExists "src\components\FreeTrialSignup.jsx" "src\components\payments\FreeTrialSignup.jsx"

# Landing Components
Move-FileIfExists "src\components\Hero.js" "src\components\landing\Hero.js"
Move-FileIfExists "src\components\HeroRedesign.jsx" "src\components\landing\HeroRedesign.jsx"
Move-FileIfExists "src\components\HeroWithSlider.js" "src\components\landing\HeroWithSlider.js"
Move-FileIfExists "src\components\About.js" "src\components\landing\About.js"
Move-FileIfExists "src\components\FeaturesShowcase.jsx" "src\components\landing\FeaturesShowcase.jsx"
Move-FileIfExists "src\components\ValueTestimonials.jsx" "src\components\landing\ValueTestimonials.jsx"
Move-FileIfExists "src\components\TestimonialsSlider.js" "src\components\landing\TestimonialsSlider.js"
Move-FileIfExists "src\components\Footer.js" "src\components\landing\Footer.js"

# Shared Components
Move-FileIfExists "src\components\Header.js" "src\components\shared\Header.js"
Move-FileIfExists "src\components\InfoBar.js" "src\components\shared\InfoBar.js"
Move-FileIfExists "src\components\ImageSlider.jsx" "src\components\shared\ImageSlider.jsx"
Move-FileIfExists "src\components\ImageWithFallback.js" "src\components\shared\ImageWithFallback.js"
Move-FileIfExists "src\components\ModernSlider.js" "src\components\shared\ModernSlider.js"
Move-FileIfExists "src\components\ModernSlider.css" "src\components\shared\ModernSlider.css"
Move-FileIfExists "src\components\TextEditor.jsx" "src\components\shared\TextEditor.jsx"
Move-FileIfExists "src\components\CommandPalette.jsx" "src\components\shared\CommandPalette.jsx"
Move-FileIfExists "src\components\CommentModal.js" "src\components\shared\CommentModal.js"
Move-FileIfExists "src\components\DeviceToolbar.jsx" "src\components\shared\DeviceToolbar.jsx"
Move-FileIfExists "src\components\sections.js" "src\components\shared\sections.js"
Move-FileIfExists "src\components\versions.js" "src\components\shared\versions.js"
if (Test-Path "src\components\ui") {
    Move-Item "src\components\ui" "src\components\shared\ui" -Force -ErrorAction SilentlyContinue
}
if (Test-Path "src\components\blocks") {
    Move-Item "src\components\blocks" "src\components\shared\blocks" -Force -ErrorAction SilentlyContinue
}

# ==========================================
# SERVER ROUTES REORGANIZATION
# ==========================================

Write-Host ""
Write-Host "🔧 Reorganizing Server Routes..." -ForegroundColor Yellow

Move-FileIfExists "server\routes\custom-auth.js" "server\routes\auth\custom-auth.js"
Move-FileIfExists "server\routes\emails.js" "server\routes\email\emails.js"
Move-FileIfExists "server\routes\contacts.js" "server\routes\email\contacts.js"
Move-FileIfExists "server\routes\smtp-test.js" "server\routes\email\smtp-test.js"
Move-FileIfExists "server\routes\member.js" "server\routes\member\member.js"
Move-FileIfExists "server\routes\member-business-email.js" "server\routes\member\member-business-email.js"
Move-FileIfExists "server\routes\affiliates.js" "server\routes\affiliate\affiliates.js"
Move-FileIfExists "server\routes\clicks.js" "server\routes\affiliate\clicks.js"
Move-FileIfExists "server\routes\leads.js" "server\routes\affiliate\leads.js"
Move-FileIfExists "server\routes\products.js" "server\routes\products\products.js"
Move-FileIfExists "server\routes\merchants.js" "server\routes\merchants\merchants.js"
Move-FileIfExists "server\routes\subscriptions.js" "server\routes\payments\subscriptions.js"
Move-FileIfExists "server\routes\capture-order.js" "server\routes\payments\capture-order.js"
Move-FileIfExists "server\routes\create-order.js" "server\routes\payments\create-order.js"
Move-FileIfExists "server\routes\chatbot.js" "server\routes\marketing\chatbot.js"
Move-FileIfExists "server\routes\webhook.js" "server\routes\webhooks\webhook.js"

# ==========================================
# DATABASE MIGRATIONS
# ==========================================

Write-Host ""
Write-Host "🗄️  Reorganizing Database Files..." -ForegroundColor Yellow

if (Test-Path "db\migrations") {
    Get-ChildItem "db\migrations\*.sql" | ForEach-Object {
        Move-FileIfExists $_.FullName "database\migrations\$($_.Name)"
    }
}

# ==========================================
# SCRIPTS REORGANIZATION
# ==========================================

Write-Host ""
Write-Host "📜 Reorganizing Scripts..." -ForegroundColor Yellow

# Setup scripts
Move-FileIfExists "setup-database.js" "scripts\setup\setup-database.js"
Move-FileIfExists "setup-affiliate-tables.js" "scripts\setup\setup-affiliate-tables.js"
Move-FileIfExists "setup-lead-tables.js" "scripts\setup\setup-lead-tables.js"
Move-FileIfExists "setup-products-table.js" "scripts\setup\setup-products-table.js"
Move-FileIfExists "setup-subscription-tables.js" "scripts\setup\setup-subscription-tables.js"
Move-FileIfExists "setup-paypal-subscriptions.js" "scripts\setup\setup-paypal-subscriptions.js"
Move-FileIfExists "setup-database-tables.js" "scripts\setup\setup-database-tables.js"
Move-FileIfExists "setup-email-verification-table.js" "scripts\setup\setup-email-verification-table.js"
Move-FileIfExists "setup-vps-mail-integration.js" "scripts\setup\setup-vps-mail-integration.js"
Move-FileIfExists "create_stores_table.js" "scripts\setup\create-stores-table.js"

# Test data generators
Move-FileIfExists "create-test-contacts.js" "scripts\test\create-test-contacts.js"
Move-FileIfExists "create-test-emails.js" "scripts\test\create-test-emails.js"
Move-FileIfExists "create-sample-products.js" "scripts\test\create-sample-products.js"

# Dev tools
Move-FileIfExists "check-db.js" "scripts\dev\check-db.js"
Move-FileIfExists "check-dns.js" "scripts\dev\check-dns.js"
Move-FileIfExists "check-schema.js" "scripts\dev\check-schema.js"

# ==========================================
# TEST FILES REORGANIZATION
# ==========================================

Write-Host ""
Write-Host "🧪 Reorganizing Test Files..." -ForegroundColor Yellow

# API tests
Move-FileIfExists "test-api-endpoints.js" "tests\api\test-api-endpoints.js"
Move-FileIfExists "test-routes.js" "tests\api\test-routes.js"
Move-FileIfExists "test-business-emails-api.js" "tests\api\test-business-emails-api.js"
Move-FileIfExists "test-inbox-api.js" "tests\api\test-inbox-api.js"
Move-FileIfExists "test-inbox-simple.js" "tests\api\test-inbox-simple.js"

# Email tests
Move-FileIfExists "test-vps-mail.js" "tests\email\test-vps-mail.js"
Move-FileIfExists "test-quick-email.js" "tests\email\test-quick-email.js"
Move-FileIfExists "test-real-email.js" "tests\email\test-real-email.js"
Move-FileIfExists "test-custom-verification.js" "tests\email\test-custom-verification.js"
Move-FileIfExists "test-business-email.js" "tests\email\test-business-email.js"

# Integration tests
Move-FileIfExists "test-signup.js" "tests\integration\test-signup.js"
Move-FileIfExists "test-business-email-creation.js" "tests\integration\test-business-email-creation.js"
Move-FileIfExists "test-vps-integration.js" "tests\integration\test-vps-integration.js"
Move-FileIfExists "test-db-connection.js" "tests\integration\test-db-connection.js"
Move-FileIfExists "test-postgresql.js" "tests\integration\test-postgresql.js"
Move-FileIfExists "test-links.js" "tests\integration\test-links.js"

# ==========================================
# LOG FILES
# ==========================================

Write-Host ""
Write-Host "📋 Moving Log Files..." -ForegroundColor Yellow

Get-ChildItem -Filter "*.log" -File | ForEach-Object {
    Move-FileIfExists $_.FullName "logs\$($_.Name)"
}

# ==========================================
# SUMMARY
# ==========================================

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "✅ Reorganization Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Moved: $moved files" -ForegroundColor Green
Write-Host "Errors: $errors files" -ForegroundColor $(if ($errors -gt 0) { "Red" } else { "Green" })
Write-Host ""
Write-Host "⚠️  IMPORTANT NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Update import paths in affected files"
Write-Host "2. Update server/index.js route imports"
Write-Host "3. Test the application thoroughly"
Write-Host "4. Commit changes to version control"
Write-Host ""
