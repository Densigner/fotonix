# Deploy server to VPS
# Usage: .\deploy-to-vps.ps1

$VPS_HOST = "51.75.78.118"
$VPS_USER = "root"
$REMOTE_DIR = "/var/www/fotonix-api"

Write-Host "🚀 Deploying Fotonix API to VPS..." -ForegroundColor Cyan

# Files to deploy
$filesToDeploy = @(
    "server/index.js",
    "server/paypal.js",
    "server/openaiImageProxy.js",
    "server/package.json",
    "server/routes",
    "server/serviceAccountKey.json",
    ".env"
)

Write-Host "`n📦 Creating deployment package..." -ForegroundColor Yellow

# Create temp deployment folder
$tempDir = "deploy_temp"
if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Copy files maintaining structure
foreach ($file in $filesToDeploy) {
    $source = Join-Path $PSScriptRoot $file
    if (Test-Path $source) {
        $dest = Join-Path $tempDir $file
        $destDir = Split-Path $dest -Parent
        if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
        Copy-Item -Path $source -Destination $dest -Recurse -Force
        Write-Host "  ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $file (not found)" -ForegroundColor Red
    }
}

Write-Host "`n📤 Upload these files to VPS at: $REMOTE_DIR" -ForegroundColor Cyan
Write-Host "Commands to run on VPS:" -ForegroundColor Yellow
Write-Host @"

# SSH to VPS
ssh ${VPS_USER}@${VPS_HOST}

# Create directory
mkdir -p ${REMOTE_DIR}
cd ${REMOTE_DIR}

# Install dependencies  
npm install

# Create .env file with PayPal credentials:
cat > .env << 'EOF'
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=AWe0IKuw_hwCKGDtSb3jYG734rQFLitGgcROWvGF1h5xf8IUEL-Yrq8Vk08vUKF044KSs6l2KPetIRY5
PAYPAL_CLIENT_SECRET=EBkexPM5kxV7_OhyN4_YAvOHvzC8euiOdx4dZLeCwKcJQ1hjCZ6HSY1pTSJayNatFW_CkBVlzuKgTURk
PAYPAL_WEBHOOK_ID=42925362X3827115B
COOKIE_SECRET=288ef93df507dc649bfa77c5ee458a1e712fbdf7780b957d9a3382cbbdae7b
DATABASE_URL=postgres://fotonix:fotonixpass@localhost:5432/fotonix_dev
OPENAI_API_KEY=your_openai_key
PORT=4000
EOF

# Start with PM2
pm2 delete fotonix-api 2>/dev/null
pm2 start index.js --name fotonix-api
pm2 save

"@ -ForegroundColor White

Write-Host "`n✅ Deployment package ready in: $tempDir" -ForegroundColor Green
