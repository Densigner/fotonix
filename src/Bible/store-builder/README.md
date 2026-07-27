# Store Builder — Bible

Two genuinely separate "build a page to sell/showcase products" systems
share the "store builder" name in this codebase. Both are real and working
(unlike the Funnel Builder — see `../funnel-builder/`), but they're
different products for different audiences, with different backends.
Confirm which one you mean before editing anything here.

- **General Store Builder** — `StoreBuilder.js`/`StoreViewer.js`
  (`src/components/store-builder/storeBuilder/`), backed by Postgres
  (`server/routes/stores/stores.js`, `/api/stores`). Any user builds one
  store page for their own products.
- **Affiliate Shop Builder** (a.k.a. "Storefront") —
  `AffiliateShopBuilderPage.js` (`src/components/affiliate/`), backed by
  Firebase RTDB. Affiliate-specific, reachable from the affiliate
  dashboard's "Shop Builder" button, public at `fotonix.co.uk/@handle`.
  This is the one that was fixed 2026-07-26 (see `gotchas.md`) — it
  existed and worked as a page builder, but generated zero commission
  until a click-tracking bug and a dead product link were fixed.

See `architecture.md` for how each one actually works, `gotchas.md` for
the commission-tracking bug found and fixed in the affiliate one.

## Fastest orientation

- General Store Builder editor: `StoreBuilder.js` (6900+ lines — the
  larger, more fully-featured of this codebase's page builders)
- General Store Builder public page: `StoreViewer.js`, fetches
  `GET /api/stores/view/:handle`
- Affiliate Shop Builder editor: `AffiliateStorefrontEditor` (exported
  from `AffiliateShopBuilderPage.js`)
- Affiliate Shop Builder public page: `AffiliateStorefrontViewer` (same
  file), resolves `/@handle` via Firebase `storefrontHandles/{handle}`
- Backend for the general one: `server/routes/stores/stores.js`
- The affiliate one has **no dedicated backend** — it talks to Firebase
  RTDB directly from the client, no Express route involved at all.
