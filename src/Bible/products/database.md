# Products — Where Order Data Actually Lands

All Firebase Realtime Database, no backend/Postgres involvement anywhere
in this area (contrast with `../affiliates/database.md`, where three
genuinely different systems are in play). Every real order-saving path
below was read directly from the relevant component, not inferred.

## The product catalog itself — `products/{uid}` and the Fotonix catalog (added 2026-08-11)

Distinct from the order data below this section (that's what happens
*after* a purchase) -- this is where a product *listing* itself lives,
before anyone's bought anything.

**`products/{uid}`** is the one and only product catalog node in this
codebase — every reader (the Shop Builder's Products block, the Funnel
Builder's "Go to a Product" action, `AffiliateProductsPanel.js`'s "My
Products" list, `CustomerProductPage.jsx`, `resolveProductClick`) reads
this same path, scoped per owner uid. See `../store-builder/architecture.md`
and `../funnel-builder/gotchas.md` for where else this gets read. A
record's shape: `{ id, ownerId, title, description, templateId,
templateLabel, category, price, images: [{ url, storagePath, isMain,
sourceDesignId? }], mainImageIndex, createdAt, updatedAt }`.

**`products/fotonix-official`** — a second, synthetic node under the exact
same `products/{uid}` shape, holding Fotonix's own five core products
(same ones described in `architecture.md`'s table above). `fotonix-official`
is not a real Firebase Auth account — nobody logs in as it, nothing needs
to. It exists purely so these five products are readable by every existing
`products/{uid}` consumer with zero special-casing, rather than inventing
a second, parallel "official catalog" system. Seeded once via a one-off
admin script (`firebase-admin`, using `server/serviceAccountKey.json`) —
there's no UI to re-create these from scratch, only `AffiliateCreateProduct.js`'s
"Fotonix Products" category, which *reads* this node (see `architecture.md`'s
"The Create Product modal" section), doesn't write to it. If a sixth core
product ever gets added, it needs the same one-off script treatment, not
just a `productsData.js` edit — that file only drives the homepage
marketing banners, it was never wired to write real product records.

**`designs/{uid}`** — a third, related-but-separate node: an affiliate's
own *saved designs* (the actual editable canvas, not a listing). Written
by "Save Design" in `StandardMirrorDesigner.js`/`ProductPageClean.js`/
`AffiliateProductPageCleanAccryl.js` (see "Both acrylic products" below
and `../store-builder/gotchas.md`), gated to accounts with
`userProfile.affiliateCode` set. Read back by `AffiliateCreateProduct.js`'s
"My Saved Designs" category, which turns a saved design into a real
`products/{uid}` listing. Not itself a listing — a design becomes one only
once picked in the Create Product modal.

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

**All three acrylic/mirror products** (Side-lit Acrylic wall panel,
Side-lit Acrylic Sign desk-mounted, **and** Custom Shape Mirror — see
the correction below) — `AffiliateProductPageCleanAccryl.js`'s
`saveAcrylicOrder`, fires on PayPal capture:
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

**Correction (2026-08-11) — "Custom Shape Mirror — nothing is saved
anywhere" was wrong and has been removed.** This section originally
described a "Get Custom Quote" modal built into `MainLandingPage.js`
(`showQuoteModal`/`handleQuoteSubmit`, a bare `console.log` and nothing
else) as this product's real destination. That modal doesn't exist in
`MainLandingPage.js` at all anymore — grepped for `showQuoteModal`,
`handleQuoteSubmit`, `quoteForm`, zero matches. At some point after this
file was written, a later session gave Custom Shape Mirror a real
"Start Designing →" button (`goToProduct(customMirror,
DESK_ACRYLIC_SIZES[mirrorSize].key, 'mirror')`, see `architecture.md`)
that lands it on `AffiliateProductPageCleanAccryl.js` with
`?material=mirror`, exactly like the other two acrylic products — no
Bible update happened at the time, so this file kept describing a dead
end that had already been fixed. **It's covered by the "All three
acrylic/mirror products" section above, not a separate case** — the
only thing that differs for the mirror material is
`orderData.metadata.material` (`selectedMaterial.key`, i.e. `'mirror'`
instead of `'acrylic'`) and the higher price from
`MIRROR_PRICE_MULTIPLIER`. If you're reading old context (a chat log,
an old comment) that cites this file for "custom mirror quotes go
nowhere," it's describing a state that no longer exists — verify
against `MainLandingPage.js`/`AffiliateProductPageCleanAccryl.js`
directly rather than trusting that specific claim.
