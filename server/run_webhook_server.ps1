# Helper to start the webhook server with env vars for local testing
$env:PORT = '4000'
$env:DISABLE_PAYPAL_WEBHOOK_VERIFY = '1'
# Optional: set NODE_ENV for logging clarity
$env:NODE_ENV = 'development'

# Change to the repo root (script invoked from repo root by Start-Process)
# Start the Node server and redirect output to logs so we can inspect them later
node server/index.js > server/out.log 2> server/err.log
