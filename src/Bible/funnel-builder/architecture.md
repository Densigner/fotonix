# Funnel Builder — Current Architecture

Four frontend pieces, zero backend. Read this alongside `gotchas.md`, which
explains why each piece is disconnected from the others.

## The editor — `src/components/marketing/funnelBuilder/FunnelBuilder.js`

A real drag-and-drop page builder (1200+ lines). Block registry (`BLOCKS`
object) supports exactly these types, nothing else:

- `hero`
- `volunteerHero`
- `heading`
- `paragraph`
- `image`
- `button`
- `emailCapture` — a lead-capture form block
- `features`

No `product`, `checkout`, or `affiliate-link` block exists. Reordering is
drag-and-drop (`@dnd-kit`, hence the `ref={setNodeRef}` calls if you go
looking). Image blocks upload directly to Firebase Storage
(`uploadBytesResumable`/`getDownloadURL`) — that part is real and working,
it's the only genuinely-connected-to-a-backend piece of the whole feature.

**Persistence**: a single `useEffect` writes the entire block array to one
global `localStorage` key, `funnel.blocks`, on every change. Load does the
reverse on mount. There is no per-funnel, per-user, or per-slug separation
— editing "funnel A" and "funnel B" both read/write the exact same key, so
you cannot actually have two funnels open/saved at once.

## The dashboard — `FunnelBuilderDash.js`

A list view seeded from a **hardcoded mock array** of 3 fake funnels
("Punked", "Q4 Holiday Promo", "Legacy—Spring 2024") kept in local React
state only. "Create funnel" appends a row to that in-memory array and
nothing else — no backend call, no localStorage, no link to what the
editor actually saves. Refresh the page and it's gone. There's a dead
comment in the create handler: `// OPTIONALLY: route to builder with modal
prefilled` — the dashboard and the editor were never actually connected.

## The public viewer — `FunnelViewer.js`

Routed in `App.js` at `/funnel/:companySlug/:funnelSlug` (two-part slug,
not an id). Despite the route existing and working, the component itself
is an explicit stub — its own comment says *"For now, we'll use mock data
based on the slug... In production, this would fetch from your
database."* It waits 500ms (fake loading state) then fabricates a landing
page purely from the URL params. The CTA button calls `alert(...)`. Any
slug you type resolves to visually-identical placeholder content — it
never reads the `funnel.blocks` localStorage key, never queries Postgres,
never calls an API.

## Templates — `templateRegistry.js` / `funnelBuilderTemplates/`

Starter presets that just pre-populate the same 8 block types listed above
(e.g. `productLaunch: ['hero','features','emailCapture']`) — "productLaunch"
is a label on a preset, not an actual product/commerce integration.

## Routing — hash/state-based, not React Router, for the editor UI

The editor/dashboard/templates pages are driven by a `currentPage`
string switched on in `App.js` (`funnel-builder`, `funnel-builder/templates`,
`funnel-builder/editor`), set via `window.location.hash`, not by the
`<Routes>` config. The **public viewer** is the one part that does use a
real React Router `<Route>` — a routing style split worth knowing before
you go looking for one and find the other.

Reachable from:
- `src/components/affiliate/AffiliateDashboard.js` — a "Funnel Builder"
  button, member-facing, not admin-gated.
- `src/components/admin/MembersDashboard.jsx` — same tool, also reachable
  from the general members dashboard despite the `admin` folder name (no
  role check gates this button specifically).

## The unused Postgres schema — `server/migrations/001_create_funnels.sql`

Defines `funnels` (id uuid, user_id uuid, name, slug, blocks jsonb,
variant char(1) default 'A' — looks like it was meant to support A/B
variant testing, never used — published boolean, version integer,
metadata jsonb, timestamps, unique index on `(user_id, slug)`) and
`funnel_revisions` (a snapshot/version-history table, `funnel_id` FK,
snapshot jsonb, version, note). **No route file, model, or query anywhere
in `server/` touches either table.** See `gotchas.md` for why this looks
like the same "migration written, never actually run or used" pattern as
the affiliates table.
