# Gotchas — Store Builder

## The affiliate storefront existed but generated zero commission (fixed 2026-07-26)

Asked how affiliates could get their own promotional page, the instinct
was to build one from scratch via the Funnel Builder — until a closer look
showed a separate, already-real, already-reachable feature had been
sitting unused: the Affiliate Shop Builder's `/@handle` storefront
(Firebase RTDB-backed, real handle-claiming via `runTransaction`, curated
product picker, live preview — see `architecture.md`). Unlike the funnel
builder, this one genuinely persists and genuinely renders real saved
data — it just had never been wired to the commission side of things.

**Two bugs, both silent, both in `AffiliateStorefrontViewer`:**

1. **No click tracking on visit, at all.** Landing on `/@handle` never set
   `localStorage.fotonix_aff_ref` or called `/api/clicks/create` — grepped
   the entire file for `clicks/create`, `aff_click`, `fotonix_aff_ref`,
   `useAffiliateRef` before the fix: zero matches. A visitor could browse
   an affiliate's storefront, click through to a product, buy it, and the
   affiliate would never be credited — no error anywhere, it simply never
   tried.
2. **The "View Details" button pointed at a route that doesn't exist.**
   It did `window.location.hash = 'product/${product.id}'` — but the real
   product page is a React Router path, `/product/:ownerId/:productId`
   (confirmed live in `App.js:791`, rendered by `CustomerProductPage.jsx`).
   No `currentPage`/hash handler anywhere matches a bare `product/...`
   hash, so this button was dead. (The *other* branches of that same click
   handler, routing specific product types to `#affiliate-product-accryl`,
   are a real, separately-working special case — only the generic `else`
   branch for ordinary products was broken.)

**Why this was two bugs, not one**: fixing #1 alone would correctly track
the storefront *visit*, but the visitor could never actually reach a
product to buy since #2 meant "View Details" led nowhere. Fixing #2 alone
would let visitors reach products, but no affiliate would ever get credit
since #1 meant nothing ever recorded who referred them. Both were needed
for the storefront to produce a real, attributed sale.

**The fix** — both in `AffiliateStorefrontViewer`'s `loadStore()`:

- After resolving `uid` from the handle (needed anyway to load
  `storefronts/{uid}`), also fetch `users/{uid}` to read `affiliateCode`
  — **the storefront's `handle` and the affiliate's referral `code` are
  two different strings** (the handle is a user-chosen slug for the URL;
  the code is generated at signup and is what `clicks.json`/
  `/api/affiliates/stats` actually key on, see
  `../affiliates/architecture.md`). Using the handle directly as
  `affiliateId` would have silently created clicks that never matched the
  affiliate's own stats query.
- Set `localStorage.fotonix_aff_ref = affiliateCode` and POST
  `/api/clicks/create` with `{ affiliateId: affiliateCode }`, `credentials:
  'include'` — the exact same beacon shape as `useAffiliateRef.js`, so it
  rides the same cookie/localStorage-fallback mechanism `PayPalButton.js`
  already reads at checkout. **No changes to the checkout/webhook/
  attribution pipeline were needed** — it already worked correctly for any
  correctly-recorded click, regardless of source.
- Added an `ownerUid` state variable (the resolved `uid`) and pointed
  "View Details" at `` `${window.location.origin}/product/${ownerUid}/${product.id}` ``
  instead of the dead hash route.

**Verified live (2026-07-26)**: created a real test storefront
(`storefronts/zx0jZBpqWDQw6PufVLQ4g5Q8gdZ2`, handle `testaffiliate`, owned
by the `TESTAFF72` test affiliate account — see `../affiliates/gotchas.md`
for that account). Confirmed the deployed bundle contains the fix
(grepped the live `main.*.js` for `aff_tracked_` and `storefrontHandles`),
confirmed `POST /api/clicks/create` with the resolved code creates a real
click (cookie set, `200`), and confirmed it immediately shows up via
`GET /api/affiliates/stats?code=TESTAFF72` (`clicks: 1`). The one thing
not verified by this pass — since RTDB reads happen client-side, not
something `curl` can exercise — is the actual browser round trip of
"visit `/@testaffiliate` → Firebase resolves handle → code → beacon fires
automatically." Worth a real-browser click-through to be fully sure,
though the resolution chain and the beacon call are identical code to
what was directly tested.

## Known remaining gaps in the affiliate storefront (not fixed, flagged for later)

- No `published` gate is actually enforced by the viewer — it reads
  `storefronts/{uid}` regardless of the `published` field's value. The
  editor UI has a `published` field in its data shape but nothing reads it
  on the public side to decide whether to render. Not a security issue
  (nothing sensitive is exposed) but means "unpublish" currently does
  nothing.
- `AffiliateStorefrontViewer`'s `theme` rendering will throw if
  `storeData.theme` is ever missing (`storeData.theme.bgType` with no
  optional chaining, around line 1094 of `AffiliateShopBuilderPage.js`) —
  every storefront created through the real editor always includes a
  `theme` object by default, so this is latent, not currently hit, but
  worth guarding if any future path (an import tool, a manual RTDB edit)
  ever creates a storefront record without one.

## The general Store Builder wasn't audited to this depth

Unlike the affiliate storefront above, the general Store Builder
(`StoreBuilder.js`, 6900+ lines) hasn't been read end-to-end or
click-tested this session — `architecture.md` documents what's confirmed
from its backend (`stores.js`) and `StoreViewer.js`'s fetch calls, but no
claim is made here about bugs or gaps inside the editor itself. Don't
assume it's bug-free just because it's Postgres-backed and real — it just
hasn't been looked at as closely yet.
