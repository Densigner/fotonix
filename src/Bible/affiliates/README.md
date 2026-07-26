# Affiliate System — Bible

How affiliate signup, referral links, click tracking, and commission
attribution actually work end to end. This was rebuilt from a broken state
this session (affiliate clicks were never actually recorded — a UI that
looked complete but the whole pipeline was dead) and then verified with real
PayPal purchases, so everything documented here is confirmed working, not
just "should work."

## Files in this folder

- **`architecture.md`** — the full click → attribution → commission pipeline,
  and the three separate data stores involved (yes, three — that's not a
  typo, see below).
- **`routes.md`** — every backend route.
- **`database.md`** — where affiliate data actually lives (flat JSON files,
  Postgres, and Firebase Realtime DB — genuinely three different systems).
- **`gotchas.md`** — the actual bugs found and fixed, in the order they were
  found, since the debugging story itself explains a lot about how the
  pieces fit together.
- **`storefront.md`** — the affiliate "Shop Builder" self-serve page
  (`/@handle`), the real answer to "how do affiliates build their own
  page" — separate from, and much further along than, the Funnel Builder
  (see `../funnel-builder/`). Read this if you're working on anything
  affiliate-facing that isn't the plain `?ref=` link flow.

## The one-sentence version

A visitor clicks `fotonix.co.uk/?ref=CODE`, that gets recorded as a "click"
and remembered (cookie + localStorage). When they buy, the click ID rides
along inside the PayPal order's `custom_id`. When PayPal's webhook confirms
the payment, the server looks up that click ID and creates a commission
"attribution" record. Nothing about this touches PayPal's money movement —
it's tracking only, you still pay affiliates manually (see
`architecture.md`'s "no fund custody" note).

## Fastest orientation

- Referral capture: `src/hooks/useAffiliateRef.js`
- Checkout wiring: `src/components/payments/PayPalButton.js`,
  `server/routes/payments/create-order.js`, `server/routes/webhooks/webhook.js`
- Affiliate's own dashboard: `src/components/affiliate/AffiliateDashboard.js`
  and its children (`AffiliateDashboardclick.jsx`, `AffiliateMasterDashboard.jsx`,
  `AffiliateProductsPanel.js`)
- Self-signup: `src/components/affiliate/AffiliateSignupPage.js`
- Seller/member's view of what they owe affiliates:
  `src/components/admin/MembersDashboard.jsx` (different audience, different
  backend route, different data source than the affiliate's own dashboard —
  see `architecture.md`, this split trips people up)
- Backend: `server/routes/affiliate/affiliates.js` (stats/attributions/
  settings), `server/routes/affiliate/clicks.js` (click capture),
  `server/routes/payments/create-order.js` + `capture-order.js` (checkout),
  `server/routes/webhooks/webhook.js` (PayPal webhook → attribution)

## Deploying a change in this area

Same manual process as documented in `../emails/README.md` — copy changed
files into the deploy clone, build, push, pull on cPanel for frontend;
`scp` + syntax-check + `pm2 restart` on the VPS for backend. The flat-file
data (`server/data/*.json`) lives on the VPS filesystem directly — no deploy
step needed for data changes, but also **no backup** beyond whatever you
manually copy — see `database.md`.
