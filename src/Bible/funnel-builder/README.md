# Funnel Builder

A drag-and-drop landing-page editor, reachable from both the affiliate
dashboard and the members dashboard. **As of 2026-07-26, Phase 1 of
`roadmap.md` is built and live** — funnels are now real, persisted,
publishable pages, not the mock/localStorage-only prototype described
throughout the rest of this folder's history. Read `gotchas.md` for that
history before assuming anything *else* here works — Phase 2 (commerce
blocks) and Phase 3 (affiliate-facing promotion UI) are still not built.

- `architecture.md` — how it actually works now: real backend, real
  persistence, real public viewer, plus what's still not done.
- `gotchas.md` — the investigation that originally found none of it was
  connected (useful history/context), plus what changed in the 2026-07-26
  build.
- `roadmap.md` — the phased plan. Phase 1 (make it real) is done. Phase 2
  (product/checkout blocks) and Phase 3 (affiliate-facing "promote this
  funnel" UI) are not.

## One-paragraph summary

The editor (`FunnelBuilder.js`) is a genuinely well-built drag-and-drop UI
— hero, heading, paragraph, image, button, email-capture, features blocks,
drag reordering, image upload to Firebase Storage. As of 2026-07-26 it's
also genuinely persisted: `server/routes/marketing/funnels.js` (`/api/funnels`)
is a real Postgres-backed CRUD API, the dashboard lists and creates real
funnel rows, the editor autosaves to the backend and has a working Publish
button, and the public page at `/funnel/:companySlug/:funnelSlug` fetches
and renders the actual saved blocks — no more fabricated placeholder
content. What's still missing: a way to actually sell something from a
funnel (no product/checkout block exists yet), and any affiliate-specific
UI for discovering/promoting a funnel (the underlying `?ref=` tracking
already works automatically on any real page, including this one, once
someone shares a link to it — see `roadmap.md` Phase 3).
