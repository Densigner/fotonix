# Products — Where Order Data Actually Lands

All Firebase Realtime Database, no backend/Postgres involvement anywhere
in this area (contrast with `../affiliates/database.md`, where three
genuinely different systems are in play). Every real order-saving path
below was read directly from the relevant component, not inferred.

## The `stencilOrders` name is generic, not literal

`users/{uid}/stencilOrders/{orderId}` is where **every** made-to-order
product's purchase record gets mirrored for the logged-in buyer's own
order history — Lumina Mirror, both acrylic products, and actual
stencils all write here, under the same path name. If you're looking for
"where do acrylic orders get saved" and only grep for `acrylicOrders` or
similar, you'll find nothing — this is the one path name to search for
across all three real designer pages instead.

Each product's real designer page also writes to `madeOrders/{orderId}` —
a global, buyer-agnostic fulfillment record that works for guest
checkout too (no `uid` required to look it up), which is presumably what
whatever admin/fulfillment view exists reads from.

## Per-product, what's actually written

**LED Lumina Mirror** (`ProductPageClean.js`'s `handleOrderPaid`, fires
on PayPal capture):
- `madeOrders/{orderId}`: `{ orderId, productName: 'Fotonix Standard
  Mirror', price: 29.99, currency, designImageUrl, buyerEmail, buyerName,
  status: 'paid', fulfilled: false, createdAt }` — `price` is the
  `STANDARD_MIRROR_BASE_PRICE` constant, always `29.99`, no size
  variation (see `gotchas.md`)
- Mirrored to `users/{uid}/stencilOrders/{orderId}` (same shape) **only
  if logged in** — the `madeOrders` write happens unconditionally first,
  so guest checkout still produces a real fulfillable order
- Separately, `designs/{uid}/{designId}` exists as a **save-for-later**
  feature (not an order) — "Save Design" writes canvas JSON + a thumbnail
  here so a logged-in user can resume/reuse it later, distinct from
  `madeOrders`, which only gets written on an actual paid capture

**Both acrylic products** (`AffiliateProductPageCleanAccryl.js`'s
`saveAcrylicOrder`, fires on PayPal capture):
- `users/{uid}/stencilOrders/{orderId}` **and** `madeOrders/{orderId}`
  (spread of the same `orderData` object into both, plus `userId` on the
  `madeOrders` copy)
- `orderData.pricing.total`/`.subtotal` and
  `orderData.metadata.productSize` are the two fields the size hand-off
  (see `architecture.md`) actually resolves per-purchase —
  `priceToAmount(selectedSize.price)` and `selectedSize.label`
  respectively, as of this session. Before this fix both were hardcoded
  (`'34.99'` and `'30cm x 30cm'`) regardless of anything the buyer
  actually chose — see `gotchas.md`
- `orderData.productType: 'acrylic'` is set explicitly, unlike the
  Lumina Mirror's order record, which has no `productType` field at all
  — worth knowing if anything downstream ever tries to distinguish order
  types by that field, since it'll only work for acrylic purchases
- The design image itself uploads to Firebase Storage first
  (`users/{uid}/acrylicOrders/{orderId}/design.png` — note this *is* a
  distinctly-named storage path, just not a distinctly-named database
  path), and the resulting download URL is what's actually stored as
  `designImageUrl` in the RTDB record above

**Stencil Generator** (`StencilGenerator.js`): writes to
`users/{uid}/stencilOrders/{orderId}` and `madeOrders/{orderId}` the same
way, plus a separate `stencilDownloads` path (with an explicit
`isPurchasedOrder: false` flag) for the **free**, non-purchased
photo-to-stencil downloads — don't confuse the two when reading data back
out; only `stencilOrders`/`madeOrders` represent money changing hands.

**Custom Shape Mirror — nothing is saved anywhere.** The "Get Custom
Quote" button opens a modal built directly into `MainLandingPage.js`
(`showQuoteModal` state, `handleQuoteSubmit`). Submitting it does exactly
this:

```js
const handleQuoteSubmit = (e) => {
  e.preventDefault();
  console.log('Quote request:', quoteForm);
  setQuoteSubmitted(true);
};
```

That's it — a `console.log` and a local state flip to show the "Quote
Request Received!" success screen. No Firebase write, no email, no
backend call of any kind. **This is not a regression from this session**
— it's a verbatim copy of what the old `Products.js`'s identical modal
already did before the homepage rewrite (confirmed by diffing the two
implementations side by side while porting it over). It was carried over
faithfully rather than fixed because building real persistence for it
wasn't part of what was asked when the landing page was rebuilt. If
someone reports "I requested a custom mirror quote and never heard back,"
this is why — the form was never wired to anything, on the old page or
the new one.
