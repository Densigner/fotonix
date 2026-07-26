# Funnel Builder

A drag-and-drop landing-page editor, reachable from both the affiliate
dashboard and the members dashboard. **Read `gotchas.md` before you assume
anything here works end-to-end** — this is the single most "looks finished
but isn't wired to anything" feature found in the whole codebase this
session, more so even than the affiliate Links dashboard that got removed.

- `architecture.md` — what actually exists today: the editor, the block
  types, the (fake) dashboard, the (fake) public viewer, how it's routed.
- `gotchas.md` — the investigation that found none of it is actually
  connected: no backend, an unused Postgres migration, mock data
  everywhere, a broken dead duplicate file.
- `roadmap.md` — the agreed plan for making this real and wiring it into
  the affiliate program (2026-07-26). **Nothing in this plan has been built
  yet** — it's a plan, not a changelog. Check git history / re-read the
  actual files before assuming any phase is done.

## One-paragraph summary

The editor (`FunnelBuilder.js`) is genuinely well-built as a UI — hero,
heading, paragraph, image, button, email-capture, features blocks, drag
reordering, image upload to Firebase Storage. But it only ever saves to one
global `localStorage` key, the dashboard list is hardcoded mock rows, there
is a `funnels` Postgres table defined in a migration that nothing in the
codebase queries, and the public page renderer (`/funnel/:companySlug/:funnelSlug`)
literally fabricates content from the URL slug — it never reads anything
you actually built. Nothing published here reaches a real visitor today.
