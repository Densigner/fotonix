# PayPal Payment Integration for Fotonix

This document explains how the PayPal payment system is integrated into the Fotonix website.

## 🔧 Setup Overview

The PayPal integration consists of three main components:

1. **PayPalSDKLoader.js** - Loads the PayPal JavaScript SDK
2. **PayPalButton.js** - Renders the PayPal payment button
3. **ProductPage.js** - Integrates PayPal into the product page

## 📋 API Credentials

**Client ID:** `Aab6IHfog5quDJp4kfy5sqiuo4YcTZaQ3SR8VpwUgDoDphLXmrKwqhog_u-cktkgIaSrsXwxH8HNE-Jf`

**Secret:** `EM6RwjpwGJ1BqkN4V5SyW2yoRtwIBUb8fJpGTfsY3jH6U8HS2Idx43OoU1xCgqAqRwlwGkZIuwbw8buU`

**Currency:** GBP (British Pounds)

> ⚠️ **Security Note:** The Client ID is safe to use in frontend code, but the Secret should ONLY be used on your backend server for security reasons.

## 🏗️ How It Works

### 1. SDK Loading Process

```javascript
// PayPalSDKLoader.js loads the PayPal SDK dynamically
const script = document.createElement('script');
script.src = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&currency=GBP&intent=capture`;
```

### 2. Payment Flow

1. **User selects quantity** → Total price calculated
2. **User clicks PayPal button** → PayPal popup opens
3. **User logs into PayPal** → Authorizes payment
4. **Payment captured** → Success callback triggered
5. **Order processed** → Confirmation shown to user

### 3. Payment Button Integration

```javascript
// ProductPage.js
<PayPalButton
  amount={totalPrice}
  productName={`${product.name} (x${quantity})`}
  onSuccess={handlePaymentSuccess}
  onError={handlePaymentError}
  onCancel={handlePaymentCancel}
/>
```

## 💳 Payment Features

- **Dynamic Pricing:** Total updates based on quantity selected
- **GBP Currency:** Payments processed in British Pounds
- **Real-time Validation:** PayPal handles payment verification
- **Mobile Friendly:** Works on all devices
- **Secure:** PayPal's secure payment processing

## 🔄 Payment States

### Success
- Payment completed successfully
- User sees confirmation message
- Order details logged to console
- Ready for backend integration

### Error
- Payment failed due to technical issues
- User sees error message
- Can retry payment

### Cancelled
- User cancelled payment in PayPal popup
- User can try again anytime
- No charges applied

## 🚀 Going Live

### Development Mode (Current)
- Uses PayPal Sandbox environment
- Test payments only
- No real money processed

### Production Mode
To go live, you need to:

1. **Get Live Credentials:**
   - Login to PayPal Developer Dashboard
   - Create Live App
   - Get Live Client ID and Secret

2. **Update Configuration:**
   ```javascript
   // Change in PayPalSDKLoader.js
   const PAYPAL_CLIENT_ID = 'your-live-client-id';
   ```

3. **Backend Integration:**
   - Verify payments server-side
   - Store order details
   - Send confirmation emails
   - Update inventory

## 🔒 Security Best Practices

1. **Never expose Secret Key in frontend code**
2. **Always verify payments on your backend**
3. **Use HTTPS in production**
4. **Validate payment amounts server-side**
5. **Log all transactions for audit**

## 📱 Testing

### Test the Payment Flow:

1. Go to Product Page
2. Select quantity
3. Click PayPal button
4. Use PayPal Sandbox test account:
   - Email: Any sandbox account
   - Password: Your sandbox password

### Test Scenarios:
- ✅ Successful payment
- ❌ Failed payment (insufficient funds)
- ⏹️ Cancelled payment

## 🛠️ Backend Integration (Next Steps)

```javascript
// Example backend endpoint to verify payment
app.post('/api/verify-payment', async (req, res) => {
  const { orderID } = req.body;
  
  // Verify with PayPal
  const order = await paypal.orders.get(orderID);
  
  if (order.status === 'COMPLETED') {
    // Save order to database
    // Send confirmation email
    // Update inventory
    res.json({ success: true });
  }
});
```

## 📊 Order Data Structure

When payment succeeds, you receive:

```javascript
{
  id: "ORDER_ID",
  status: "COMPLETED",
  payer: {
    name: { given_name: "John", surname: "Doe" },
    email_address: "john@example.com"
  },
  purchase_units: [{
    amount: { value: "899", currency_code: "GBP" },
    description: "Fotonix Lumina Mirror (x1)"
  }]
}
```

## 🎯 Next Development Steps

1. **Add Loading States** - Better UX during payment
2. **Error Handling** - More detailed error messages
3. **Backend Verification** - Secure payment verification
4. **Order Management** - Track and manage orders
5. **Email Notifications** - Confirmation emails
6. **Inventory Integration** - Real-time stock updates

## 📞 Support

For PayPal integration issues:
- PayPal Developer Docs: https://developer.paypal.com/
- PayPal Support: https://www.paypal.com/support/

For Fotonix website issues:
- Check console for error messages
- Verify PayPal SDK is loading
- Ensure correct Client ID is used
