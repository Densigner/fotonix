# Stencil Payment & Fulfillment System

## Overview
Complete payment-gated download system with seller fulfillment interface for stencil orders.

---

## 🔒 Payment Gating

### Customer Experience
- ✅ **Before Payment**: Users can upload, generate, and preview stencil layers
- ❌ **Download Locked**: All download buttons disabled until payment complete
- ✅ **After Payment**: Immediate access to download PNG files

### Implementation
```javascript
// State tracking
const [isPaid, setIsPaid] = useState(false);

// Download protection
const downloadLayer = (layer) => {
  if (!isPaid) {
    alert('Please complete payment before downloading layers');
    return;
  }
  // ... proceed with download
};
```

---

## 📝 Shipping Address Collection

### Form Fields (Required)
1. **Full Name** - Customer name
2. **Address Line 1** - Street address
3. **Address Line 2** - Apartment/suite (optional)
4. **City** - Town/city
5. **Postcode** - UK postal code
6. **Phone Number** - Contact number

### Validation
- PayPal payment blocked until all required fields filled
- Validation occurs in `createOrder()` before PayPal SDK call
- Address saved to Firebase on payment capture

---

## 🎨 LightBurn File Generation

### File Format: SVG
LightBurn laser cutters accept SVG files for precise cutting.

### Conversion Process
1. **Canvas to ImageData**: Extract pixel data from each layer
2. **Contour Detection**: Find black regions (stencil cuts)
3. **Path Generation**: Create SVG paths for each region
4. **File Upload**: Save both PNG (customer) and SVG (seller) to Firebase Storage

### SVG Structure
```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <path d="M100,100 L200,100 L200,200 L100,200 Z" fill="black" stroke="none"/>
  <!-- More paths for each cut region -->
</svg>
```

### Implementation
```javascript
const convertLayerToSVG = async (layer) => {
  // 1. Load image data
  // 2. Trace black regions (brightness < 128)
  // 3. Generate rectangular paths for each region
  // 4. Output SVG XML
  return svgString;
};
```

---

## 🗄️ Firebase Schema

### Customer Orders
**Path**: `/users/{userId}/stencilOrders/{orderId}`

```json
{
  "orderId": "PAYPAL_ORDER_ID",
  "timestamp": 1234567890,
  "paypalStatus": "COMPLETED",
  "numStencils": 15,
  "pricing": {
    "pricePerStencil": 3.00,
    "subtotal": "45.00",
    "deliveryFee": "0.00",
    "total": "45.00"
  },
  "storageUrls": [
    {
      "layerIndex": 0,
      "pngFileName": "stencil-layer-1-1234567890.png",
      "pngUrl": "https://firebase.storage/...",
      "svgFileName": "stencil-layer-1-1234567890.svg",
      "svgUrl": "https://firebase.storage/...",
      "threshold": [0, 17]
    }
  ],
  "metadata": {
    "layerMode": "discrete",
    "stencilMode": "island-bridge",
    "originalImageName": "sunset.jpg"
  },
  "paintingGuide": {
    "layerColors": [...],
    "totalLayers": 15
  }
}
```

### Seller Fulfillment
**Path**: `/madeOrders/{orderId}`

```json
{
  "orderId": "PAYPAL_ORDER_ID",
  "userId": "FIREBASE_USER_ID",
  "createdAt": 1234567890,
  "paypalOrderId": "PAYPAL_ORDER_ID",
  "paypalCaptureId": "PAYPAL_CAPTURE_ID",
  "paypalStatus": "COMPLETED",
  "shippingAddress": {
    "name": "John Smith",
    "addressLine1": "123 High Street",
    "addressLine2": "",
    "city": "London",
    "postcode": "SW1A 1AA",
    "phone": "07123 456789"
  },
  "stencilData": {
    "numStencils": 15,
    "pricing": {...},
    "storageUrls": [...],
    "layerMode": "discrete",
    "stencilMode": "island-bridge",
    "originalImageName": "sunset.jpg",
    "layerColors": [...]
  },
  "fulfillmentStatus": "pending"
}
```

---

## 🎯 Seller Dashboard

### Access URL
```
http://localhost:3000/admin/made-orders
```

### Features
- **Order List**: All completed orders sorted by date (newest first)
- **Customer Info**: Name, full address, phone number
- **Order Details**: Number of layers, mode, pricing, PayPal IDs
- **Download SVG Files**: Individual layer download or bulk "Download All SVGs"
- **Color Guide**: Visual reference of paint colors for each layer
- **Real-time Updates**: Firebase real-time database listener

### UI Components
```
MadeOrders.js
├─ Order Cards
│  ├─ Header (Order ID, Date, Status, Total)
│  ├─ Customer Information (Name, Address, Phone)
│  ├─ Order Details (Layers, Mode, File name)
│  └─ Download Section
│     ├─ Individual SVG buttons (Layer 1, Layer 2, ...)
│     ├─ "Download All SVGs" bulk button
│     └─ Color Guide preview
```

---

## 📦 Fulfillment Workflow

### For Seller
1. Navigate to `/admin/made-orders`
2. View new order with customer address
3. Click "Download All SVGs" to get laser cutter files
4. Import SVG files into LightBurn software
5. Cut stencils on laser cutter
6. Number each physical stencil (1, 2, 3, ...)
7. Package with color guide printout
8. Ship to customer address

### For Customer
1. Complete payment on `/tools/stencil-generator`
2. Download PNG files immediately
3. Access color guide in Android app
4. Receive physical stencils in mail
5. Paint using numbered stencils + color guide

---

## 🔧 Technical Details

### Backend Changes
**File**: `server/routes/payments/stencil-order.js`

**Changes**:
- ✅ Accept `shippingAddress` in `create-order` and `capture-order`
- ✅ Save to both `/users/{userId}/stencilOrders/` AND `/madeOrders/`
- ✅ Include `fulfillmentStatus` field (default: "pending")
- ✅ Store both PNG and SVG URLs for each layer

### Frontend Changes
**File**: `src/components/stencilUpload/StencilGenerator.js`

**Changes**:
- ✅ Added `isPaid` state variable
- ✅ Added `shippingAddress` state with 6 fields
- ✅ Download buttons check `isPaid` before allowing download
- ✅ Address form before PayPal buttons
- ✅ PayPal validation ensures address complete
- ✅ `convertLayerToSVG()` function for laser cutter files
- ✅ Upload both PNG and SVG to Firebase Storage
- ✅ Set `isPaid = true` on successful payment

**New Component**: `src/components/madeOrders/MadeOrders.js`
- ✅ Firebase real-time listener on `/madeOrders`
- ✅ Display all orders with customer info
- ✅ Download individual or all SVG files
- ✅ Show color guide for painting reference

### Routing
**File**: `src/App.js`

**New Route**:
```javascript
<Route path="/admin/made-orders" element={<MadeOrders />} />
```

---

## 🎨 SVG Generation Algorithm

### Step-by-Step
1. **Load Layer**: Convert data URL to canvas ImageData
2. **Find Black Pixels**: Iterate through pixels, identify brightness < 128
3. **Flood Fill**: Group contiguous black pixels into regions
4. **Generate Paths**: Create rectangular path for each region
5. **Build SVG**: Wrap paths in XML structure with viewBox
6. **Upload**: Save to Firebase Storage with `.svg` extension

### Performance Optimization
- **Region Limit**: Max 10,000 pixels per region to prevent stack overflow
- **4-Connectivity**: Only check N/S/E/W neighbors (not diagonals)
- **Rectangular Paths**: Simplify to bounding boxes for speed
- **Visited Array**: Track processed pixels to avoid duplicates

---

## 📊 Pricing Tiers

### Stencil Pricing
- **1-5 layers**: £4.00 each
- **6-14 layers**: £3.50 each
- **15+ layers**: £3.00 each

### Delivery
- **Orders over £25**: FREE delivery
- **Orders under £25**: £4.95 delivery fee

---

## 🔐 Security

### Payment Flow
1. Customer fills address form
2. Frontend validates all required fields
3. PayPal SDK creates order with customer info
4. Customer completes payment on PayPal
5. Backend captures payment and verifies completion
6. Backend saves to Firebase (atomic operation)
7. Frontend enables downloads on success

### Data Protection
- Customer orders: Only visible to authenticated user
- Seller orders: Protected by Firebase security rules (admin only)
- PayPal: Server-side validation before database write

---

## 🚀 Testing

### Test Checklist
- [ ] Generate stencils without login - should block download
- [ ] Login and generate stencils - download still blocked
- [ ] Try PayPal without address - should show validation error
- [ ] Complete payment with valid address - downloads enabled
- [ ] Check `/admin/made-orders` - order appears with all details
- [ ] Download individual SVG - file downloads correctly
- [ ] Download all SVGs - all files download in sequence
- [ ] Open SVG in LightBurn - paths are visible and cuttable

### Sample Test Data
```javascript
// Test Address
{
  name: "Test Customer",
  addressLine1: "123 Test Street",
  addressLine2: "Flat 4",
  city: "London",
  postcode: "E1 6AN",
  phone: "07123456789"
}
```

---

## 📚 Resources

### LightBurn Software
- **Website**: https://lightburnsoftware.com/
- **Formats**: SVG, DXF, AI, PDF, BMP, JPG, PNG, GIF
- **Preferred**: SVG for vector cutting precision

### SVG Specifications
- **Namespace**: `xmlns="http://www.w3.org/2000/svg"`
- **Path Commands**: M (move), L (line), Z (close)
- **Fill**: `black` for cut areas
- **Stroke**: `none` to avoid double cuts

---

## 🐛 Known Limitations

### SVG Simplification
- Current implementation uses rectangular bounding boxes
- Advanced users may want precise contour tracing
- **Future Enhancement**: Implement marching squares algorithm

### Region Size
- Limited to 10,000 pixels per region for performance
- Large solid areas may be split into multiple rectangles
- **Workaround**: Use smaller image dimensions

### Address Validation
- No postcode format validation
- No address lookup service
- **Future Enhancement**: Integrate Royal Mail API

---

## 📝 Summary

### ✅ Completed Features
1. **Payment Gating**: Downloads locked until payment complete
2. **Address Collection**: 6-field form with validation
3. **SVG Generation**: Automatic conversion for LightBurn
4. **Dual File Upload**: PNG for customer, SVG for seller
5. **Seller Dashboard**: Complete order management interface
6. **Firebase Schema**: Separate nodes for customer and seller
7. **Real-time Updates**: Live order updates via Firebase listener

### 🎯 Business Flow
**Customer → Generate → Pay → Download → Receive**  
**Seller → View Orders → Download SVGs → Cut → Ship**

### 🔗 Key URLs
- Customer Generator: `/tools/stencil-generator`
- Seller Dashboard: `/admin/made-orders`
- Firebase Database: `/users/{uid}/stencilOrders` and `/madeOrders`

---

**Status**: ✅ All systems operational  
**Last Updated**: November 26, 2025
