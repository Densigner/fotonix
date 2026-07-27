# Roadmap — making Funnel Builder real, and wiring it to affiliates

Sketched 2026-07-26. **Phase 1 is built and verified live as of the same
day** — see `architecture.md` for the current real implementation and
`gotchas.md` for what changed. Phases 2 and 3 below are still just a plan
— don't trust either as "done" without checking the actual files first.

## Note on a separate, related system (2026-07-26)

There's also an **Affiliate Shop Builder** (`/@handle` storefronts,
`AffiliateShopBuilderPage.js`, Firebase-backed) — a different, already-
working page builder for affiliates, documented in `../store-builder/`.
It briefly got conflated with this Funnel Builder mid-session (a click-
tracking bug in it was found and fixed the same day — see
`../store-builder/gotchas.md`), but the user clarified they specifically
mean **this** file (`FunnelBuilder.js`) and want it built out, not the
storefront. Treat the two as genuinely separate efforts: the storefront is
a curated-product landing page per affiliate, already live; this roadmap
is about single-purpose funnel/landing pages with their own drag-and-drop
block editor. Both can end up affiliate-promotable independently.

## Why phases matter here specifically

Phase 1 has to happen regardless of the affiliate angle — right now
nothing published in the funnel builder reaches a real visitor at all (see
`gotchas.md`). Affiliate integration is Phase 3 deliberately, not because
it's hard, but because the mechanism it needs (global `?ref=` tracking)
already exists and works automatically once Phase 1+2 are real — there is
close to nothing affiliate-specific to build once funnels themselves are
real pages with a real checkout block.

## Phase 1 — persistence (make a funnel a real, saved thing) — ✅ DONE 2026-07-26

1. ~~Build `server/routes/marketing/funnels.js`~~ — done, plus a
   `company-slug` claim/lookup pair and unpublish that weren't in the
   original sketch below but turned out to be needed (see
   `architecture.md`).
2. ~~Confirm (or apply) `001_create_funnels.sql`~~ — done; confirmed via
   `\d funnels` it had never been applied, fixed a `user_id uuid` →
   `varchar(255)` type mismatch first (see `gotchas.md`), then applied it.
3. ~~Point `FunnelBuilderDash.js` at the real list/create routes~~ — done.
4. ~~Point `FunnelBuilder.js`'s save at `PATCH /api/funnels/:id`~~ — done,
   plus a working Publish button (previously had no `onClick` at all).
5. ~~Point `FunnelViewer.js` at the new public GET route~~ — done, reusing
   the editor's own `BLOCKS` registry to render instead of a second copy.

Original sketch, kept for reference:

- `POST /api/funnels` — create `{name, slug, blocks}`, enforce the
  `(user_id, slug)` uniqueness the migration already defines.
- `GET /api/funnels` — list the current user's funnels.
- `GET /api/funnels/:id` / `PATCH /api/funnels/:id` — load/save.
- `POST /api/funnels/:id/publish` — flips `published`, bumps `version`,
  writes a `funnel_revisions` snapshot row.
- `GET /api/funnels/public/:companySlug/:funnelSlug` — unauthenticated,
  only returns funnels with `published = true`.

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

8. ~~Add an `affiliateEnabled` boolean~~ — **moot per the 2026-07-26
   decision above**: no gating exists, every affiliate can already
   publish their own funnels freely. Skip this.
9. On the affiliate dashboard, add a "Your funnels" section (next to the
   existing "My Products" list and the "Shop Builder" entry point) linking
   into `FunnelBuilderDash.js`, each row with a ready-made "copy your
   link" button once published — `buildReferralLink()`-style helper
   already exists for products (`AffiliateDashboard.js`), reuse the same
   pattern against the funnel's public URL instead of a product URL. Not
   built yet — `FunnelBuilderDash.js` is reachable today but not
   surfaced directly from the affiliate dashboard itself.
10. *(Optional, not blocking)* Snapshot a `funnelId` onto the click record
    (`clicks.json`) when a click originates from a funnel page, so
    affiliate stats can eventually break down "which funnel drove this
    sale" the same way they already break down by product. Pure
    analytics granularity — the core commission mechanism works without
    it.

## Decision (resolved 2026-07-26): who actually builds funnels?

Two options were on the table — (a) you build official funnels and
affiliates just get a link, vs. (b) affiliates get their own builder
access to make their own pages, with a moderation/branding question
attached to (b). **Decided: (b), and explicitly not worried about
branding/review** — affiliates get full builder access with no approval
gate. This matches how Phase 1 was actually built: any user (via
`x-member-uid`) can create, edit, and publish their own funnels with no
ownership/role check beyond "is this your `user_id`." No review-queue or
`affiliateEnabled`-gate concept was added, since the decision was to skip
that entirely. Phase 3 below should be read with this in mind — the
affiliate dashboard section is "funnels I've built," not "funnels I can
promote," since every affiliate is already free to publish their own.
