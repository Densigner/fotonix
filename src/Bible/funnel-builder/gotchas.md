# Gotchas — the "looks finished" investigation

This is the most thoroughly-disconnected feature found in the whole
codebase this session — more so than the affiliate Links dashboard that
got removed, because here *every single piece* looked plausible in
isolation and none of them actually talk to each other. Worth reading in
full before building on top of any of it.

## No backend exists at all

Searched all of `server/routes/` for "funnel" — zero route files. The only
three hits anywhere in `server/` are cosmetic: a comment in `contacts.js`
that doesn't lead anywhere, marketing-copy strings inside
`chatbotServer.js`'s AI prompt text, and the migration file itself.
`server/index.js` mounts every real route explicitly — there's no
`/api/funnels` mount, no `require(...)` of anything funnel-shaped. Also
worth knowing: `server/chatbotServer.js` itself isn't part of the deployed
`fotonix-api` process — `server/package.json`'s `"main"`/`"start"` both
point at `index.js`, which never requires it. Same dead-standalone-file
pattern as `src/server.js`, documented in `../affiliates/gotchas.md`.

## Three pieces that each look done, but don't connect to each other

1. **Editor → localStorage only.** `FunnelBuilder.js` saves the entire
   block array to one global key, `funnel.blocks`. Not per-funnel, not
   per-user. There's no `fetch`/`axios` call anywhere in the file except
   the (real, working) Firebase Storage image upload.
2. **Dashboard → hardcoded mock, in-memory only.** `FunnelBuilderDash.js`
   seeds 3 fake rows and appends new ones to local React state on
   "create." No import of `fetch`, `axios`, `localStorage`, or `firebase`
   anywhere in the file at all (checked directly). A refresh loses
   everything created here — and nothing created here has any ID
   relationship to what the editor actually persists.
3. **Public viewer → fabricates content from the URL, on purpose.** The
   component's own inline comment says it's a placeholder ("mock data
   based on the slug... in production this would fetch from your
   database"). It's routed correctly in `App.js` and *looks* like a real
   page load (500ms fake spinner) but the rendered content is generated
   purely from `companySlug`/`funnelSlug` params, not from anything saved
   anywhere. The CTA button is `alert('CTA clicked!...')`.

None of these three pieces read or write the same place as either of the
other two. Building an integration on top of "the dashboard" or "the
editor" as if they already talk to a real funnel record would be building
on a piece that currently does nothing durable.

## The Postgres migration is the same dead-schema pattern found in affiliates

`server/migrations/001_create_funnels.sql` defines `funnels` +
`funnel_revisions` tables. Grepped every `.js` file in `server/` for either
table name used in a query — zero hits. No route, no model touches it.
Exactly the same shape as the `affiliates` table documented in
`../affiliates/database.md` (migration file exists in the repo, nothing in
the running code reads or writes it) — treat it as **not proven live**
until independently checked with `\d funnels` on the production DB, don't
assume writing a migration file once means it was ever applied.

## A genuinely broken dead duplicate — worse than just redundant

`src/pages/FunnelBuilder/templateRegistry.js` (2 lines) re-exports from
`../../components/funnelBuilder/templateRegistry` — a path missing the
`marketing` segment. That path **does not exist** (the real file is at
`src/components/marketing/funnelBuilder/templateRegistry.js`). Anything
that imported this file would fail at runtime, not just serve stale data.
Confirmed nothing in `src/` actually imports it, so it's inert rather than
actively broken in production — but if you're ever searching for "the
template registry" and land on this file first, know that it doesn't
resolve, don't waste time debugging a codepath through it.

## No existing connection to products or affiliates — starting from zero, not extending something

Grepped the whole `funnelBuilder/` folder for `productId`, `affiliateId`,
`commission`, `ref` — zero real hits (the only `ref` matches were unrelated
Firebase Storage refs and React DOM refs, not affiliate referral codes).
Contrast with `../affiliates/architecture.md`'s `buildReferralLink()`
pattern, already used elsewhere (`AffiliateDashboard.js`) — nothing in
funnelBuilder calls or references it. Any affiliate integration here is new
work, not wiring up something half-built. See `roadmap.md` for the plan.
