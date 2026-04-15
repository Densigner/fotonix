# Deploy Node.js server to VPS for email webhook handling
# Run this with: powershell -ExecutionPolicy Bypass -File scripts/deploy-to-vps.ps1

$VPS_HOST = "ubuntu@51.75.78.118"
$VPS_DIR = "/opt/fotonix-email-api"
$SERVICE_NAME = "fotonix-email-api"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Deploying Email API Server to VPS" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Install Node.js on VPS
Write-Host "1. Installing Node.js on VPS..." -ForegroundColor Yellow
ssh $VPS_HOST @"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
npm --version
"@
Write-Host "[OK] Node.js installed" -ForegroundColor Green
Write-Host ""

# Step 2: Create application directory
Write-Host "2. Creating application directory..." -ForegroundColor Yellow
ssh $VPS_HOST "sudo mkdir -p $VPS_DIR && sudo chown ubuntu:ubuntu $VPS_DIR"
Write-Host "[OK] Directory created" -ForegroundColor Green
Write-Host ""

# Step 3: Copy server files (using scp since rsync may not be available)
Write-Host "3. Copying server files to VPS..." -ForegroundColor Yellow
Write-Host "   This may take a moment..." -ForegroundColor Gray

# Create a temporary archive
$tempZip = "$env:TEMP\fotonix-server.zip"
Compress-Archive -Path "server\*" -DestinationPath $tempZip -Force
scp $tempZip "${VPS_HOST}:/tmp/fotonix-server.zip"
ssh $VPS_HOST "cd $VPS_DIR && unzip -o /tmp/fotonix-server.zip && rm /tmp/fotonix-server.zip"
Remove-Item $tempZip

# Copy package.json
scp package.json "${VPS_HOST}:$VPS_DIR/"
Write-Host "[OK] Files copied" -ForegroundColor Green
Write-Host ""

# Step 4: Create .env file on VPS
Write-Host "4. Creating environment configuration..." -ForegroundColor Yellow
$envContent = @"
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://fotonix:your_password@127.0.0.1:5432/fotonix_prod

# SMTP Configuration
SMTP_HOST=mail.fotonix.co.uk
SMTP_PORT=587
SMTP_USER=noreply@fotonix.co.uk
SMTP_PASS=your_smtp_password

# Webhook security
WEBHOOK_SECRET=your_webhook_secret
"@

$envContent | ssh $VPS_HOST "cat > $VPS_DIR/.env"
Write-Host "[OK] Environment configured" -ForegroundColor Green
Write-Host ""

# Step 5: Install dependencies
Write-Host "5. Installing npm dependencies..." -ForegroundColor Yellow
ssh $VPS_HOST "cd $VPS_DIR && npm install --production"
Write-Host "[OK] Dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 6: Create systemd service
Write-Host "6. Creating systemd service..." -ForegroundColor Yellow
$serviceContent = @"
[Unit]
Description=Fotonix Email API Server
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/fotonix-email-api
Environment=NODE_ENV=production
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=fotonix-email-api

[Install]
WantedBy=multi-user.target
"@

$serviceContent | ssh $VPS_HOST "sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null"
Write-Host "[OK] Service created" -ForegroundColor Green
Write-Host ""

# Step 7: Enable and start service
Write-Host "7. Starting service..." -ForegroundColor Yellow
ssh $VPS_HOST "sudo systemctl daemon-reload && sudo systemctl enable $SERVICE_NAME && sudo systemctl restart $SERVICE_NAME"
Start-Sleep -Seconds 3
ssh $VPS_HOST "sudo systemctl status $SERVICE_NAME --no-pager | head -20"
Write-Host ""

# Step 8: Update Postfix webhook URL to use localhost
Write-Host "8. Updating Postfix configuration to use localhost..." -ForegroundColor Yellow
ssh $VPS_HOST "sudo sed -i 's|https://fotonix.co.uk/api/email/receive-webhook|http://localhost:4000/api/email/receive-webhook|g' /etc/postfix/master.cf"
ssh $VPS_HOST "sudo systemctl reload postfix"
Write-Host "[OK] Postfix updated" -ForegroundColor Green
Write-Host ""

# Step 9: Test the webhook endpoint
Write-Host "9. Testing webhook endpoint..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
ssh $VPS_HOST "curl -s -o /dev/null -w '%{http_code}' http://localhost:4000/api/email/receive-webhook -X POST -H 'Content-Type: application/json' -d '{\"test\":true}'"
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "[OK] Deployment Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service Status:"
ssh $VPS_HOST "sudo systemctl is-active $SERVICE_NAME"
Write-Host ""
Write-Host "To view logs: ssh $VPS_HOST 'sudo journalctl -u $SERVICE_NAME -f'"
Write-Host "To restart: ssh $VPS_HOST 'sudo systemctl restart $SERVICE_NAME'"
Write-Host ""
Write-Host "[TEST] Send an email to: contact.fffff@fotonix.co.uk" -ForegroundColor Yellow
Write-Host ""
