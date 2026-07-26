# Store Builder — Architecture

## General Store Builder — Postgres-backed

`src/components/store-builder/storeBuilder/StoreBuilder.js` (6900+ lines —
not fully read line-by-line, this codebase's biggest single builder file
by far) and `StoreViewer.js` (377 lines).

Backend: `server/routes/stores/stores.js`, mounted at `/api/stores` in
`server/index.js:91`. Real Postgres CRUD, confirmed working (not a stub):

- `POST /api/stores` — upsert, `ON CONFLICT (user_id, handle) DO UPDATE`.
  Rejects with `409` if the handle is already taken by a different user.
- `GET /api/stores/check-handle?handle=` — availability check.
- `GET /api/stores/user/:userId/current` — most recently updated store.
- `GET /api/stores/:userId` — all of a user's stores.
- `GET /api/stores/view/:handle` — **public**, only returns
  `is_published = true` rows. This is what `StoreViewer.js` actually calls.
- `DELETE /api/stores/:userId/:handle`.
- `POST /api/stores/:handle/chat` — an AI chatbot scoped to that store's
  config, reads a `chatbot` block out of the store's own `blocks` if
  present.

Every route defensively catches `relation "stores" does not exist` and
degrades gracefully (empty list / `needsSetup: true`) rather than 500ing —
same defensive pattern seen elsewhere in this codebase for tables that may
not have been migrated on a given environment yet. Worth actually checking
`\d stores` on production before assuming this table exists, per the
pattern documented repeatedly elsewhere in this Bible.

Public routing: `StoreViewer.js` supports both a direct `useParams()`
route and a `handle` prop passed from `App.js`'s hash-based `currentPage
=== 'store'` branch (`App.js:672-676`) — two ways to reach the same
component depending on entry point.

## Affiliate Shop Builder ("Storefront") — Firebase-backed, no Express route at all

`src/components/affiliate/AffiliateShopBuilderPage.js` exports
`AffiliateStorefrontEditor` (the editor) and `AffiliateStorefrontViewer`
(the public `/@handle` page). Unlike the general Store Builder, this one
talks to Firebase Realtime Database **directly from the client** — there
is no backend route for it at all, not even a thin one. Data:

- `storefrontHandles/{handle}` → `uid`, claimed via a real `runTransaction`
  so two affiliates can't race for the same handle.
- `storefronts/{uid}` → the full page config (theme, links, product
  curation, page sections, SEO fields — see the editor's `data` state
  shape for the exact fields).
- `products/{uid}` — the affiliate's own product catalog node, same one
  used by the affiliate dashboard's "My Products" list elsewhere.

Reachable from the affiliate dashboard's **"Shop Builder"** button
(`AffiliateDashboard.js:110`) → `currentPage === 'affiliate-shop-builder'`
in `App.js:611-626` (requires a verified login) for editing, and from the
`/@handle` URL — parsed directly out of `window.location.pathname` in
`App.js` (not a React Router `<Route>`) — for public viewing.

### How this one connects to the affiliate commission pipeline

This is the part that didn't exist until 2026-07-26 — see `gotchas.md`.
Short version: visiting `/@handle` now resolves the owning affiliate's
real referral code (`users/{uid}.affiliateCode` — **not** the same string
as the `handle` itself) and fires the same click-tracking beacon
`src/hooks/useAffiliateRef.js` uses for plain `?ref=` links, so a purchase
made after browsing the storefront gets attributed through the exact same
pipeline documented in `../affiliates/architecture.md` — no separate
commission logic was needed once the click is recorded correctly.

## These are not the same feature — don't merge them casually

If you're asked to add a feature to "the store builder," check which
audience it's for first: general users building any store page (Postgres,
`StoreBuilder.js`), or affiliates specifically building a promotional page
tied to their referral code (Firebase, `AffiliateShopBuilderPage.js`).
They don't share a data layer, a backend, or even a routing mechanism.
