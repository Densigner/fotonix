# Paint-by-Numbers Order Flow

## Customer Checkout

1. Customer fills shipping form: name, email, address, phone, country
2. PayPal button rendered → `createOrder` validates fields, calls `POST /api/pbn/create-order`
3. Customer approves on PayPal → `onApprove` fires

## What Happens on Payment

### Step 1 — Upload Files to Firebase Storage
`uploadPbnToFirebase()` uploads 5 files:

| File | Storage Path | Type Key |
|------|-------------|----------|
| Coloured SVG (fills + numbers) | `users/{uid}/pbn/pbn-{ts}.svg` | `svg` |
| HD PNG preview | `users/{uid}/pbn/pbn-hd-{ts}.png` | `hd-png` |
| Outline SVG (print-ready) | `users/{uid}/pbn/pbn-outline-{ts}.svg` | `outline-svg` |
| **Palette legend SVG** | `users/{uid}/pbn/pbn-palette-{ts}.svg` | `palette-svg` |
| Original uploaded image | `users/{uid}/pbn/originals/original-{ts}.png` | — |

### Step 2 — Capture PayPal & Save Order
`POST /api/pbn/capture-order` (in `server/routes/payments/pbn-order.js`):

1. Captures PayPal payment (must return `COMPLETED`)
2. Saves to **Firebase RTDB** in two places:
   - `users/{uid}/pbnOrders/{orderId}` — customer's order history
   - `madeOrders/{orderId}` — your fulfillment queue (`fulfillmentStatus: 'pending'`)
3. Saves to **PostgreSQL** `pbn_orders` table (backup)

## Order Data Structure

```json
{
  "orderId": "PAYPAL-ORDER-ID",
  "shippingAddress": {
    "name": "...", "email": "...",
    "addressLine1": "...", "addressLine2": "...",
    "city": "...", "postcode": "...",
    "country": "GB", "phone": "..."
  },
  "pbnData": {
    "productKey": "30x40",
    "productLabel": "Medium Canvas 30×40 cm",
    "materialType": "canvas",
    "pricing": { "subtotal": "25.99", "deliveryFee": "0", "total": "25.99" },
    "storageUrls": [
      { "type": "svg", "url": "https://..." },
      { "type": "hd-png", "url": "https://..." },
      { "type": "outline-svg", "url": "https://..." },
      { "type": "palette-svg", "url": "https://..." }
    ],
    "originalImageUrl": "https://...",
    "paletteColours": 18,
    "paletteData": [
      { "number": 6, "hex": "#f5deb3", "name": "Warm Sand" },
      { "number": 12, "hex": "#8b4513", "name": "Raw Umber" }
    ],
    "detailLevel": 50,
    "regionCount": 142,
    "analysisWidth": 600,
    "analysisHeight": 800
  }
}
```

## Palette Numbers

- Every region on the SVG has a **number** = `masterPaletteIndex + 1`
- All regions sharing the same colour get the **same number**
- The palette legend SVG lists each colour sorted by number
- `paletteData` in the order includes `{ number, hex, name }` per colour

## Admin Dashboard

**Component:** `src/components/madeOrders/MadeOrders.js`

- Reads from `madeOrders` Firebase node
- Download all SVG/PNG files (including palette legend)
- Select courier: Royal Mail, DHL, Evri, UPS, etc.
- Mark as shipped → updates Firebase status + sends tracking email to customer

## Shipping

- UK: Free delivery (£0)
- International: £4.95
- Delivery estimate: 4 days if ordered before 20:00, 5 days after

## Key Files

| File | Purpose |
|------|---------|
| `src/components/PaintByNumbers/MainScreenPBY.js` | Frontend: image processing, SVG generation, checkout, PayPal |
| `server/routes/payments/pbn-order.js` | Backend: create/capture order, save to Firebase + Postgres |
| `src/components/madeOrders/MadeOrders.js` | Admin: view orders, download files, mark shipped |
