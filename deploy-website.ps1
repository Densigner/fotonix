# Deploy Fotonix Website
# Builds locally and syncs to hosting via Git

Write-Host "🔨 Building React app..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📤 Now upload the build folder to your server:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option 1: Use File Manager in cPanel" -ForegroundColor White
Write-Host "  - Zip the 'build' folder"
Write-Host "  - Upload to public_html"
Write-Host "  - Extract and overwrite"
Write-Host ""
Write-Host "Option 2: On your server terminal, run:" -ForegroundColor White
Write-Host "  cd ~/fotonix-repo && git pull && cp -r build/* ~/public_html/ && cp build/.htaccess ~/public_html/" -ForegroundColor Gray
Write-Host ""
Write-Host "The build folder is ready at: $PSScriptRoot\build" -ForegroundColor Green
