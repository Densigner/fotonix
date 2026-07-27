# Gotchas — the "looks finished" investigation

**This describes the state as found, before the 2026-07-26 build** (see
the dated section at the end of this file, and `architecture.md`, for what
changed). Kept as-is rather than rewritten, because the investigation
itself — how each piece looked plausible in isolation while none of them
actually talked to each other — is exactly the kind of thing worth
recognizing early in any other "looks done" feature in this codebase.

This was the most thoroughly-disconnected feature found in the whole
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

## Phase 1 built (2026-07-26): everything above is now fixed

All four disconnected pieces described above were wired together in one
session:

- Built the missing backend (`server/routes/marketing/funnels.js`,
  `/api/funnels`) — real Postgres CRUD, publish/unpublish, and a public
  by-slug route.
- Applied the migration to production — confirmed via `\d funnels`
  beforehand that it had genuinely never been run (this file's claim
  above, verified true). Fixed one bug in the migration before applying
  it: `user_id` was typed `uuid`, but Firebase UIDs aren't valid
  RFC4122 UUIDs — changed to `varchar(255)` to match the convention used
  elsewhere in this codebase (e.g. `email_messages.member_uid`).
- Added a new `funnel_owners` table (not in the original migration) to
  resolve the public URL's `companySlug` segment — see `architecture.md`
  for why this needed its own table rather than a column or a Firebase
  lookup.
- Wired the dashboard to the real list/create endpoints, the editor to
  real load/autosave/publish, and the public viewer to the real
  by-slug endpoint, rendering actual saved blocks via the editor's own
  `BLOCKS` registry (now exported) instead of a second, separate copy of
  block-rendering logic.
- The dead duplicate `src/pages/FunnelBuilder/templateRegistry.js` was
  left as-is (still unreferenced, still broken if anything ever did import
  it) — out of scope for this build, noted above for whoever eventually
  cleans it up.
- Verified end-to-end via direct API calls (create → claim company slug →
  publish → fetch by public slug → confirm the real React Router page
  returns `200`) — see `architecture.md` for the current, accurate
  description of how each piece works now.

**Not done in this pass** (see `roadmap.md` Phases 2–3): no product/checkout
block exists yet, so a funnel still can't actually sell anything; no
affiliate-facing "here are funnels you can promote" UI exists yet, though
the underlying click-tracking needs no new work once that UI is built —
any real page on this domain already gets the referral tracking
automatically.

## "Unknown block: cta" — a block type referenced everywhere but never defined (fixed 2026-07-27)

Reported live: picking a template showed a red "Unknown block: cta" box
instead of real content — `BLOCKRenderer`'s fallback for `BLOCKS[block.type]`
being `undefined`. Grepped `templateRegistry.js` for every `type:` string
used across all starter schemas: `cta` is referenced by three of them —
**the Wildlife and Women's Empowerment templates, and, more importantly,
the default "Custom Blank" starter** (`CustomBlankTemplate.jsx`'s
`getSchema()`) — but `BLOCKS` never had a `cta` entry at all. Since "Custom
Blank" is presumably the most commonly picked starting point (it's the
generic "start from scratch" option), this was likely the single most
commonly hit bug in the whole builder, not an edge case in a rarely-used
template.

The three call sites' data shapes weren't even fully consistent with each
other — Wildlife/Women's Empowerment pass `background: { color: 'emerald-800' | 'rose-600' }`
and a real `ctaHref`; Custom Blank's placeholder passes neither, just
`{headline, subhead, ctaLabel, theme: 'light'}`. The new `cta` block
(`FunnelBuilder.js`) handles both: resolves `background.color` through a
small hardcoded hex map (`CTA_BG_COLORS`) rather than interpolating a
Tailwind class name like `` `bg-${color}` `` — Tailwind's build-time
class scanner only picks up literal strings that appear in source, so a
runtime-constructed class name would have silently rendered with no
background at all — and falls back to a light/dark default when
`background`/`ctaHref` are missing, matching Custom Blank's minimal shape.

**If you add a new template to `templateRegistry.js` (or any of the
`funnelBuilderTemplates/*.jsx` files) that references a block `type` in its
starter schema, that type has to already exist in `FunnelBuilder.js`'s
`BLOCKS` registry** — nothing checks this at write time, it only surfaces
as "Unknown block" the first time someone actually picks that template.

## The hero block silently ignored its own overlay fields (fixed 2026-07-27)

Reported live: editing the Wildlife Conservation template's hero, the
image rendered as a plain box stacked *below* the headline/CTA, not as a
full-bleed background with the text overlaid on top of it — despite the
template clearly being designed for the latter (see the comment right
above the block in `templateRegistry.js`: "HERO (emerald overlay, center
CTA)").

Root cause: `getWildlifeSchema()`/`getWomenSchema()`'s hero blocks set
`gradientOverlay: true`, `gradientColor: "emerald-900/70"` (or
`"rose-900/70"`), and `textColor: "white"` — but the `hero` block's
`render()` function in `FunnelBuilder.js` never read any of those three
fields at all. It only ever knew about `headline`, `subhead`, `ctaLabel`,
`ctaHref`, `image`, `align`, and a separate, unrelated `gradient` boolean
(a subtle background tint behind the whole card, not an image overlay).
The data was being saved and loaded correctly the whole time — it just had
nowhere to go once it got to render.

Fixed by giving `hero`'s `render()` a real branch for
`data.gradientOverlay`: a full-bleed absolutely-positioned image, a
semi-transparent color layer on top (resolved from `gradientColor` via a
small hex/opacity lookup — `HERO_OVERLAY_HEX` — rather than an interpolated
Tailwind class like `` `bg-${color}` ``, which Tailwind's build-time
scanner would never generate CSS for since it only picks up literal class
strings already present in source), and the headline/subhead/CTA rendered
on top in `textColor`. The inspector got a matching toggle ("Text overlays
image") plus color swatches, so this is now editable from either template
starters or a block added from scratch — not just something baked into
template data with no UI to control it.

**Same underlying lesson as the missing `cta` block above**: a template's
starter schema can set fields a block's `render()` doesn't use, and nothing
flags this at write time — the data round-trips through save/load
perfectly, so it doesn't look broken until you actually look at the
rendered result. Worth grep-ing `templateRegistry.js`'s `data: {...}` shapes
against the actual block's `render()` destructuring if a template's visual
result doesn't match its own descriptive comment.

Also swapped Wildlife's hero image from a generic Unsplash mountain photo
to a real tiger photo (`photo-1508817628294-5a453fa0b8fb`) — fits "Protecting
Nature's Giants" specifically rather than generic nature stock.
