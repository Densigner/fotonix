# FRONTEND WORKFLOW — Affiliate Tracking (Track-only, No Funds Custody)

## Overview
This workflow describes how users interact across Fotonix’s affiliate system:
- **Members (sellers)** create products & affiliate links.
- **Affiliates** share those links.
- **Buyers** purchase → PayPal order + webhook triggers commissions.
- **All dashboards** read from backend API data (`clicks.json`, `attributions.json`, etc.).
No money flows through Fotonix. We only track & visualize data.

---

## 1️⃣ Member Flow — Setting up a product
**Goal:** let the member (merchant) define commissionable products.

### File(s)
- `AffiliateAddProductPage.js`
- `AffiliateProductsPanel.js`

### Prompt to Copilot
> “Add a ‘Commission Rate (%)’ field under price when creating or editing a product.  
> Store it as decimal (0.10 for 10%).  
> Default value = global programDefaultCommissionPct / 100.  
> When displayed, multiply by 100 and show as '% commission'. ”

### Data shape
```js
{
  id, title, sku, price,
  commissionRate: 0.10, // decimal
  status, clicks, conversions, itemsSold, earnings
}

Result

Each product now advertises its commission opportunity to potential affiliates.
You can later fetch these via /api/products?ownerUid=memberId.
```

## 2️⃣ Member Flow — Creating an affiliate link

Goal: allow member to generate a unique link (optionally with custom commission).

File(s)

AffiliateLinkDashboard.js

Prompt to Copilot

“Add a form to create a new link:

Select product (dropdown)

Optional custom commission rate (%) override

Slug / short name (for /l/<slug>)
On save, POST to /api/links with { productId, linkCustomRatePct, slug }.”

Behavior

Server creates a link record with its own id, productId, and linkCustomRatePct.

Generated link:
https://fotonix.co.uk/l/<slug>?ref=<affiliateCode>

When this link is visited, the click is stored with its rate snapshot and affiliate ID.

## 3️⃣ Affiliate Flow — Sharing & tracking

Goal: affiliates share links and view performance.

File(s)

AffiliateDashboard.js

AffiliateProductsPanel.js

Prompt to Copilot

“Display each link’s click count, conversions, earnings, and effective commission.
Use data from /api/affiliates/stats and /api/affiliates/attributions.
Replace any hard-coded 10% math with backend commissionCents and ratePct.”

Behavior

Affiliate sees:

Clicks

Pending commissions (sum of status: 'pending')

Approved commissions (sum of status: 'approved')

Voided (refunded) totals

Data comes from the backend aggregation.

## 4️⃣ Buyer Flow — Visiting affiliate link

Goal: create a click record.

File(s)

src/hooks/useAffiliateRef.js (you can create this small hook)

Prompt to Copilot

“When a user visits any page with ?ref=<affiliateCode>,
call /api/trackClick with { ref, productId, linkCustomRatePct }.
Backend sets signed cookie ‘aff_click’ and stores ratePct snapshot.”

Behavior

Backend returns clickId, stored in cookie.

No UI change; just silent tracking.

## 5️⃣ Checkout Flow — Creating PayPal order

Goal: include clickId with order.

File(s)

src/routes/paypal-create.ts (frontend calls this endpoint)

Prompt to Copilot

“When calling /api/paypal-create from frontend checkout,
don’t include affiliate data manually.
Server reads signed cookie ‘aff_click’ and sets purchase_unit.custom_id = clickId.”

Result

No extra work in frontend.

The existing PayPal button integration remains the same.

## 6️⃣ Post-purchase (Webhook) Flow

Goal: display resulting commissions in dashboards.

No frontend action required — webhook writes to attributions.json.

Prompt to Copilot

“Ensure AffiliateDashboard fetches attribution records from backend
and maps status totals to Pending / Approved / Void charts.”

## 7️⃣ Member Flow — Managing commissions

Goal: members can see what they owe, but Fotonix doesn’t move money.

File(s)

AffiliateDashboard.js

New optional page AffiliatePayoutsPage.js

Prompt to Copilot

“Create a tab or page showing commissions grouped by affiliate.
Show order total, rate %, commissionCents.
Include a ‘Mark as paid’ button (status → approved).
This does not trigger payment; merchant pays affiliate manually.”

Optional UX

Add a “Pay via PayPal” button that opens merchant’s PayPal to the affiliate’s email,
but never send money through Fotonix servers.

## 8️⃣ Admin Flow — Adjust default rate

Goal: allow admins to set the platform-wide default rate.

File(s)

AdminAffiliateSettings.js (simple React page)

Prompt to Copilot

“Create a form that calls GET/POST /api/affiliates/settings
to read/update { programDefaultCommissionPct }.”

## 9️⃣ Data Binding Summary
Entity	Stored Where	Key Fields
Affiliate	Firebase RTDB	affiliateCode, userId
Product	JSON or Firestore	commissionRate
Link	JSON or Firestore	productId, linkCustomRatePct
Click	server/data/clicks.json	ratePct snapshot, affiliateId
Attribution	server/data/attributions.json	commissionCents, ratePct, status

🔄 Example Lifecycle (E2E)

Member creates product (15% commission).

Member creates link for YouTuber (custom 20%).

YouTuber shares /?ref=abc123.

Buyer clicks → click saved (ratePct=20).

Buyer buys via PayPal → order includes clickId.

Webhook fires → commissionCents = amount * 0.20.

Attribution recorded (status=pending).

Merchant views “Pending Commissions” → pays affiliate manually → marks as approved.

✅ No money flows through Fotonix.
✅ All accounting is informational only.

## 10️⃣ Optional Extras

Add charts: commission trend, top affiliates.

CSV export (already implemented).

Email affiliate when new sale is attributed.

Summary Prompt (See repository files for component locations; you may not need to search or read every file.)
