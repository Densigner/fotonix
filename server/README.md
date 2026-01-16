Server helper for PayPal integration (Express)

Install:

npm i express cookie-parser body-parser node-fetch @paypal/checkout-server-sdk

.env variables required:

PAYPAL_ENV=sandbox            # or live
PAYPAL_CLIENT_ID=xxx
PAYPAL_CLIENT_SECRET=xxx
PAYPAL_WEBHOOK_ID=xxx

Run (dev):

node server/index.js
