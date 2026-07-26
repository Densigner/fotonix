# Affiliate Storefront ("Shop Builder") — the real self-serve page for affiliates

This is the answer to "how do affiliates build their own page to promote
products" (2026-07-26) — not the Funnel Builder (see
`../funnel-builder/roadmap.md` for why that one was set aside). Reachable
from the affiliate dashboard's **"Shop Builder"** button
(`AffiliateDashboard.js:110`), publicly live at `fotonix.co.uk/@<handle>`.

## Where it lives

`src/components/affiliate/AffiliateShopBuilderPage.js` exports two pieces:

- `AffiliateStorefrontEditor` — the editor, mounted at `currentPage ===
  'affiliate-shop-builder'` in `App.js:611-626` (requires a verified login).
- `AffiliateStorefrontViewer` — the public page, mounted at `currentPage ===
  'affiliate-store'` in `App.js:668-670`. The `/@handle` URL is parsed
  directly from `window.location.pathname` in `App.js` (not a React Router
  `<Route>` — same hash/pathname-driven pattern the funnel builder's editor
  uses, but note the funnel builder's *public viewer* uses real
  `<Route>`/`<Routes>` while this one doesn't).

Don't confuse this with **Store Builder** (`StoreBuilder.js`/`StoreViewer.js`,
`currentPage === 'store-builder'`/`'store'`) — a separate, parallel,
Postgres-backed (`/api/stores`) page builder that exists in the same
codebase for a different purpose (general store pages, not
affiliate-specific). Three page-builder systems exist here in total: Funnel
Builder (not real, see `../funnel-builder/`), Store Builder (real, Postgres,
not affiliate-specific), and this one (real, Firebase, affiliate-specific).
If you're asked to touch "the page builder," confirm which of the three
first.

## Data shape — Firebase RTDB, not Postgres

- `storefrontHandles/{handle}` → `uid`. A handle is claimed via a real
  `runTransaction` (`claimHandle()`, `AffiliateShopBuilderPage.js:220-224`)
  so two affiliates can't grab the same handle in a race.
- `storefronts/{uid}` → the whole page config: `handle, displayName, bio,
  bannerUrl, theme, links[], linkAlignment, linkStyle, linksHeading/
  Description, urlStyle ('at'|'slash'), productDisplayMode ('all'|
  'curated'), productIds[], featuredLayout, featuredProductId,
  productsHeading/Description, published, pageSections[], seo`.
- `products/{uid}` — the same per-user product catalog node used
  elsewhere in this codebase (e.g. the affiliate dashboard's own "My
  Products" list). An affiliate's storefront shows *their own* products
  node, curated (`productIds`) or in full (`productDisplayMode: 'all'`).
- This is genuinely persisted and genuinely working for save/load/display
  — unlike the funnel builder, there's no localStorage-only or mock-data
  shortcut anywhere in this file for the storefront data itself.

## The gap found and fixed (2026-07-26): visiting a storefront generated zero commission

The storefront was real and well-built, but it had never been connected to
the affiliate click/attribution pipeline at all — see
`../affiliates/architecture.md` for how that pipeline normally works via
`?ref=CODE`. Two separate bugs, both in `AffiliateStorefrontViewer`:

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
   (confirmed live in `App.js:791`, rendered by
   `CustomerProductPage.jsx`). No `currentPage`/hash handler anywhere
   matches a bare `product/...` hash, so this button was dead — clicking it
   did nothing. (The *other* branches of that same click handler, routing
   specific product types to `#affiliate-product-accryl`, are a real,
   separately-working special case — only the generic `else` branch for
   ordinary products was broken.)

**Why this was two bugs, not one**: fixing #1 alone would correctly track
the storefront *visit*, but the visitor could never actually reach a
product to buy since #2 meant "View Details" led nowhere. Fixing #2 alone
would let visitors reach products, but no affiliate would ever get credit
since #1 meant nothing ever recorded who referred them. Both were needed
for the storefront to produce a real, attributed sale.

**The fix** — both in `AffiliateStorefrontViewer`'s `loadStore()`:

- After resolving `uid` from the handle (needed anyway to load
  `storefronts/{uid}`), also fetch `users/{uid}` to read
  `affiliateCode` — **the storefront's `handle` and the affiliate's
  referral `code` are two different strings** (the handle is a
  user-chosen slug for the URL; the code is generated at signup and is
  what `clicks.json`/`/api/affiliates/stats` actually key on). Using the
  handle directly as `affiliateId` would have silently created clicks that
  never matched the affiliate's own stats query.
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
by the `TESTAFF72` test affiliate account — see
`../affiliates/gotchas.md`/session history for that account's
credentials). Confirmed the deployed bundle contains the fix (grepped the
live `main.*.js` for `aff_tracked_` and `storefrontHandles`), confirmed
`POST /api/clicks/create` with the resolved code creates a real click
(cookie set, `200`), and confirmed it immediately shows up via
`GET /api/affiliates/stats?code=TESTAFF72` (`clicks: 1`). The one thing
not verified by this pass — since RTDB reads happen client-side, not
something `curl` can exercise — is the actual browser round trip of
"visit `/@testaffiliate` → Firebase resolves handle → code → beacon
fires automatically." Worth a real-browser click-through to be fully sure,
though the resolution chain and the beacon call are identical code to what
was directly tested.

## Known remaining gaps (not fixed, flagged for later)

- No `published` gate is actually enforced by the viewer — it reads
  `storefronts/{uid}` regardless of the `published` field's value. The
  editor UI has a `published` field in its data shape but nothing reads it
  on the public side to decide whether to render. Not a security issue
  (nothing sensitive is exposed) but means "unpublish" currently does
  nothing.
- `AffiliateStorefrontViewer`'s `theme` rendering will throw if
  `storeData.theme` is ever missing (`storeData.theme.bgType` with no
  optional chaining, `AffiliateShopBuilderPage.js` around line 1094) —
  every storefront created through the real editor always includes a
  `theme` object by default, so this is latent, not currently hit, but
  worth guarding if any future path (an import tool, a manual RTDB edit)
  ever creates a storefront record without one.
