# Roadmap — making Funnel Builder real, and wiring it to affiliates

Agreed 2026-07-26, nothing built yet. This is a plan, not a changelog —
before trusting any phase below as "done," check the actual files (see
`architecture.md`/`gotchas.md` for what "done" would even look like).

## Why phases matter here specifically

Phase 1 has to happen regardless of the affiliate angle — right now
nothing published in the funnel builder reaches a real visitor at all (see
`gotchas.md`). Affiliate integration is Phase 3 deliberately, not because
it's hard, but because the mechanism it needs (global `?ref=` tracking)
already exists and works automatically once Phase 1+2 are real — there is
close to nothing affiliate-specific to build once funnels themselves are
real pages with a real checkout block.

## Phase 1 — persistence (make a funnel a real, saved thing)

1. Build `server/routes/marketing/funnels.js`, mount at `/api/funnels` in
   `server/index.js`. Routes needed:
   - `POST /api/funnels` — create `{name, slug, blocks}`, enforce the
     `(user_id, slug)` uniqueness the migration already defines.
   - `GET /api/funnels` — list the current user's funnels (replaces
     `FunnelBuilderDash.js`'s hardcoded seed array).
   - `GET /api/funnels/:id` / `PATCH /api/funnels/:id` — load/save for the
     editor (replaces the single global `localStorage` key).
   - `POST /api/funnels/:id/publish` — flips `published`, bumps `version`,
     writes a `funnel_revisions` snapshot row.
   - `GET /api/funnels/public/:companySlug/:funnelSlug` — unauthenticated,
     only returns funnels with `published = true`. This is what
     `FunnelViewer.js` should call instead of fabricating content.
2. Confirm (or apply) `001_create_funnels.sql` against production Postgres
   — don't assume it's live, check `\d funnels` first per the pattern in
   `../DEPLOYMENT.md`'s database-changes section.
3. Point `FunnelBuilderDash.js` at the real list/create routes.
4. Point `FunnelBuilder.js`'s save at `PATCH /api/funnels/:id` — keep
   `localStorage` only as a crash-recovery draft cache, not the source of
   truth.
5. Point `FunnelViewer.js` at the new public GET route, rendering the
   actual saved `blocks` array instead of the current fabricated content.

## Phase 2 — commerce blocks (give a funnel something to sell)

6. Add a `product` block: pick a real product from Firebase RTDB
   `products/{uid}` (the same store the affiliate dashboard's "My
   Products" list already reads), render image/price/description.
7. Add a `checkout` block that embeds the **existing**
   `PayPalButton.js` component, configured with the block's chosen
   product. Deliberately reuse it rather than write new payment code — it
   already handles `credentials: 'include'`, the `aff_click` cookie, and
   the `localStorage` ref fallback (see `../affiliates/architecture.md`),
   so a purchase made inside a funnel automatically flows through the
   exact same create-order → capture → webhook → attribution pipeline
   that already works for normal product pages.

## Phase 3 — affiliate wiring (the part actually asked about)

**The key point: no new click-tracking mechanism is needed.**
`useAffiliateRef` already runs globally in `App.js` on every page load,
including `/funnel/:companySlug/:funnelSlug` once that route serves real
content — so an affiliate link like
`fotonix.co.uk/funnel/yourco/summer-sale?ref=THEIRCODE` gets tracked by the
existing pipeline the moment Phase 1+2 are live. Nothing below is required
for tracking/commission to function; it's about making funnels
discoverable and promotable for affiliates specifically.

8. Add an `affiliateEnabled` boolean (store it in the funnels table's
   existing `metadata` jsonb column — no schema change needed) so you can
   mark specific published funnels as available for affiliates to promote,
   separately from funnels you're using for your own campaigns.
9. On the affiliate dashboard, add a "Funnels you can promote" section
   (next to the existing "My Products" list) listing every
   `affiliateEnabled` funnel, each with a ready-made "copy your link"
   button — `buildReferralLink()` already exists and does exactly this for
   products (`AffiliateDashboard.js`), reuse the same helper against the
   funnel's public URL instead of a product URL.
10. *(Optional, not blocking)* Snapshot a `funnelId` onto the click record
    (`clicks.json`) when a click originates from a funnel page, so
    affiliate stats can eventually break down "which funnel drove this
    sale" the same way they already break down by product. Pure
    analytics granularity — the core commission mechanism works without
    it.

## Open decision — who actually builds funnels? (needs your call, not mine)

The current nav wiring (funnel builder reachable directly from the
affiliate dashboard, not admin-gated) hints the original intent may have
been to let affiliates build their own pages — but that's a real product
decision with tradeoffs, worth deciding explicitly rather than defaulting
into it:

- **(a) You build official funnels, affiliates just get a link.** Simpler,
  you control messaging/compliance, less flexible for affiliates. Fits a
  small number of curated campaigns.
- **(b) Affiliates get their own builder access to make their own pages.**
  More flexible/powerful for them, but raises moderation questions (do you
  want to review a funnel before `affiliateEnabled`/publish, given it'll
  carry your product name and branding) and needs an ownership model
  (can an affiliate only publish, or also edit after you've reviewed it).

Either model works with Phases 1–3 above unchanged — the difference is
just who's allowed to create/publish a given funnel and whether a review
step sits in between. Worth deciding before Phase 3's UI work, since it
changes what the affiliate-facing dashboard section actually needs to show
("funnels I can promote" vs. "funnels I've built that are pending review").
