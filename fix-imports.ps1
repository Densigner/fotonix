# Import Path Fixer Script
# Run this if you see import errors after the reorganization

Write-Host "🔧 Fixing Import Paths..." -ForegroundColor Cyan
Write-Host ""

$mappings = @{
    # Auth
    "components/Login" = "components/auth/Login"
    "components/Signup" = "components/auth/Signup"
    "components/Account" = "components/auth/Account"
    
    # Email
    "components/AdvancedInboxScreen" = "components/email/AdvancedInboxScreen"
    "components/InboxScreen" = "components/email/InboxScreen"
    "components/MessageBody" = "components/email/MessageBody"
    
    # Products
    "components/ProductPage" = "components/products/ProductPage"
    "components/ProductCard" = "components/products/ProductCard"
    "components/Products" = "components/products/Products"
    
    # Payments
    "components/PayPalButton" = "components/payments/PayPalButton"
    "components/SubscriptionGate" = "components/payments/SubscriptionGate"
    
    # Landing
    "components/Hero" = "components/landing/Hero"
    "components/Footer" = "components/landing/Footer"
    "components/About" = "components/landing/About"
    
    # Shared
    "components/Header" = "components/shared/Header"
    "components/ImageSlider" = "components/shared/ImageSlider"
}

$files = Get-ChildItem -Path "src" -Recurse -Include "*.js","*.jsx","*.ts","*.tsx" -File

$updated = 0
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    foreach ($old in $mappings.Keys) {
        $new = $mappings[$old]
        $content = $content -replace [regex]::Escape($old), $new
    }
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "✓ Updated: $($file.FullName)" -ForegroundColor Green
        $updated++
    }
}

Write-Host ""
Write-Host "✅ Updated $updated files" -ForegroundColor Green
Write-Host ""
Write-Host "Now test your app and check for any remaining import errors!" -ForegroundColor Yellow
