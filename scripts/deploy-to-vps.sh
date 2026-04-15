#!/bin/bash

# Deploy Node.js server to VPS for email webhook handling
# This script sets up the complete production environment

set -e

VPS_HOST="ubuntu@51.75.78.118"
VPS_DIR="/opt/fotonix-email-api"
SERVICE_NAME="fotonix-email-api"

echo "=========================================="
echo "Deploying Email API Server to VPS"
echo "=========================================="
echo ""

# Step 1: Install Node.js on VPS
echo "1. Installing Node.js on VPS..."
ssh $VPS_HOST << 'ENDSSH'
  # Install Node.js 20.x LTS
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
  node --version
  npm --version
ENDSSH

echo "✅ Node.js installed"
echo ""

# Step 2: Create application directory
echo "2. Creating application directory..."
ssh $VPS_HOST "sudo mkdir -p $VPS_DIR && sudo chown ubuntu:ubuntu $VPS_DIR"
echo "✅ Directory created"
echo ""

# Step 3: Copy server files
echo "3. Copying server files to VPS..."
rsync -avz --exclude 'node_modules' \
  --exclude '.env' \
  --exclude 'uploads' \
  --exclude 'tmp' \
  server/ $VPS_HOST:$VPS_DIR/

# Copy package.json
scp package.json $VPS_HOST:$VPS_DIR/
echo "✅ Files copied"
echo ""

# Step 4: Create .env file on VPS
echo "4. Creating environment configuration..."
ssh $VPS_HOST "cat > $VPS_DIR/.env" << 'ENVFILE'
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
ENVFILE

echo "✅ Environment configured"
echo ""

# Step 5: Install dependencies
echo "5. Installing npm dependencies..."
ssh $VPS_HOST "cd $VPS_DIR && npm install --production"
echo "✅ Dependencies installed"
echo ""

# Step 6: Create systemd service
echo "6. Creating systemd service..."
ssh $VPS_HOST "sudo tee /etc/systemd/system/$SERVICE_NAME.service" > /dev/null << 'SERVICEEOF'
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
SERVICEEOF

echo "✅ Service created"
echo ""

# Step 7: Enable and start service
echo "7. Starting service..."
ssh $VPS_HOST "sudo systemctl daemon-reload && sudo systemctl enable $SERVICE_NAME && sudo systemctl restart $SERVICE_NAME"
sleep 3
ssh $VPS_HOST "sudo systemctl status $SERVICE_NAME --no-pager | head -20"
echo ""

# Step 8: Update Postfix webhook URL to use localhost
echo "8. Updating Postfix configuration to use localhost..."
ssh $VPS_HOST "sudo sed -i 's|https://fotonix.co.uk/api/email/receive-webhook|http://localhost:4000/api/email/receive-webhook|g' /etc/postfix/master.cf"
ssh $VPS_HOST "sudo systemctl reload postfix"
echo "✅ Postfix updated"
echo ""

# Step 9: Test the webhook endpoint
echo "9. Testing webhook endpoint..."
sleep 2
ssh $VPS_HOST "curl -s -o /dev/null -w '%{http_code}' http://localhost:4000/api/email/receive-webhook -X POST -H 'Content-Type: application/json' -d '{\"test\":true}' || echo 'Endpoint test'"
echo ""

echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "Service Status:"
ssh $VPS_HOST "sudo systemctl is-active $SERVICE_NAME"
echo ""
echo "To view logs: ssh $VPS_HOST 'sudo journalctl -u $SERVICE_NAME -f'"
echo "To restart: ssh $VPS_HOST 'sudo systemctl restart $SERVICE_NAME'"
echo ""
echo "🧪 Test by sending an email to: contact.fffff@fotonix.co.uk"
echo ""
