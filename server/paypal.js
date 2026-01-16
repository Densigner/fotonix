const paypal = require('@paypal/checkout-server-sdk');

const PAYPAL_ENV = process.env.PAYPAL_ENV || 'sandbox';
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';

function getClient() {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('PayPal credentials not set in env');
  const environment = PAYPAL_ENV === 'live'
    ? new paypal.core.LiveEnvironment(CLIENT_ID, CLIENT_SECRET)
    : new paypal.core.SandboxEnvironment(CLIENT_ID, CLIENT_SECRET);
  return new paypal.core.PayPalHttpClient(environment);
}

module.exports = { getClient };
