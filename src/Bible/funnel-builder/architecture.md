# Funnel Builder — Current Architecture

**Updated 2026-07-26**: this used to describe four disconnected frontend
pieces with zero backend — that history (and why each piece was
disconnected) is preserved in `gotchas.md`. As of this date, Phase 1 of
`roadmap.md` is built: there's a real backend, real persistence, and a
real public viewer. This file now describes the current, working state.

## The backend — `server/routes/marketing/funnels.js`, mounted at `/api/funnels`

Real Postgres CRUD (didn't exist before 2026-07-26):

- `GET /api/funnels` — list the current user's funnels.
- `POST /api/funnels` — create `{name, slug, blocks}`; 409s if the user
  already has a funnel with that slug.
- `GET /api/funnels/:id` / `PATCH /api/funnels/:id` — load/save (owner-only,
  checked via the same weak `x-member-uid` header convention as
  `member.js` — not real auth, consistent with the rest of this codebase).
- `POST /api/funnels/:id/publish` / `POST /api/funnels/:id/unpublish` —
  publish snapshots the current blocks into `funnel_revisions` and bumps
  `version` before flipping `published = true`.
- `GET /api/funnels/company-slug/mine` / `POST /api/funnels/company-slug` —
  see "Company slugs" below.
- `GET /api/funnels/public/:companySlug/:funnelSlug` — **no auth**, the
  route the public viewer actually calls. Resolves `companySlug` →
  `user_id` via `funnel_owners`, then returns that user's funnel by
  `slug`, only if `published = true`.

Uses the same per-file `pg.Pool` pattern as `server/routes/stores/stores.js`
(see `../store-builder/architecture.md`) — not the tidiest architecture,
but consistent with the rest of this codebase.

## The Postgres schema — `server/migrations/001_create_funnels.sql`

Applied to production 2026-07-26 (confirmed via `\d funnels` beforehand
that it had never been run — see `gotchas.md`). One column type was fixed
before applying: `user_id` was originally typed `uuid`, but every identity
in this codebase is a Firebase UID (an arbitrary string, not an RFC4122
UUID) — changed to `varchar(255)` to match the convention used elsewhere
(e.g. `email_messages.member_uid`, see `../emails/database.md`).

- `funnels` — `id uuid, user_id varchar(255), name, slug, blocks jsonb,
  variant char(1) default 'A'` (unused — looks like it was meant for A/B
  testing, nothing reads it yet), `published boolean, version integer,
  metadata jsonb`, timestamps. Unique index on `(user_id, slug)`.
- `funnel_revisions` — a snapshot written on every publish (`funnel_id`
  FK, `snapshot jsonb`, `version`, `note`, timestamp). Nothing reads these
  back yet (no "revision history" UI exists) — they're captured for when
  that's wanted.
- `funnel_owners` (**new table, not in the original migration** — added
  2026-07-26) — `user_id varchar(255) PRIMARY KEY, company_slug text
  UNIQUE NOT NULL`. One company slug per user, claimed once via
  `POST /api/funnels/company-slug`, used as the first segment of every one
  of that user's public funnel URLs. Kept as its own table rather than a
  column on `funnels` because it's a single claim per *user*, not per
  funnel, with its own independent uniqueness constraint.

## Company slugs — why a separate claim step exists

The public URL is `/funnel/:companySlug/:funnelSlug` — two segments. The
`funnelSlug` half is just `(user_id, slug)` uniqueness, already enforced.
The `companySlug` half needed its own resolution mechanism, since two
different users can't be allowed to claim the same one. Rather than doing
that resolution against Firebase (which would have made this route depend
on a second database for something as simple as slug lookup), it's a
small dedicated Postgres table (`funnel_owners`) — one claim per user,
enforced with a plain `UNIQUE` constraint, resolved with one JOIN-free
query before looking up the funnel itself.

A funnel's own `slug` only has to be unique *per user* — two different
affiliates can each have a funnel called `summer-sale`. The `companySlug`
is what disambiguates them on a public URL that isn't scoped to a logged-in
session. It's a claim per **user**, not per **funnel** — if it were a
column on `funnels` instead, every one of a user's funnel rows would carry
a repeated copy of the same string, and a plain `UNIQUE` constraint on that
column would break the moment they created a second funnel.

### The two endpoints

- `GET /api/funnels/company-slug/mine` — returns the caller's current
  claim, or `companySlug: null` if they haven't picked one yet.
- `POST /api/funnels/company-slug` — claims it. First checks
  `WHERE company_slug = $1 AND user_id != $2` (taken by *someone else*) and
  `409`s if so; otherwise it's an upsert
  (`ON CONFLICT (user_id) DO UPDATE SET company_slug = EXCLUDED.company_slug`),
  so calling it again with the same user id just reconfirms/updates their
  own claim rather than erroring.

### How the dashboard uses it

`FunnelBuilderDash.js`'s "Create funnel" modal fetches the user's existing
claim on load (`existingCompanySlug` prop/state). If one exists, the
Company/Brand Name field is shown but **disabled** — the intent is one
company slug per user, chosen once, not retyped per funnel.

### Gotcha: the "locked after first choice" behavior is UI-only, not enforced by the backend

`POST /api/funnels/company-slug` itself does **not** refuse to change an
existing claim — the disabled input in the create modal is the only thing
stopping a normal user from picking a different one later. If it were ever
called again with a different value for the same `user_id` (directly, or
via some future UI that doesn't disable the field), the upsert would
happily overwrite the old claim. Since `funnel_owners` stores only the
*current* slug, not history, **every funnel that user had already
published would immediately stop resolving at its old public URL** — the
lookup would 404 for anyone who already had the old link, since
`GET /api/funnels/public/:companySlug/:funnelSlug` only ever checks the
live `funnel_owners` row. Nothing currently warns about this in the UI
beyond the field simply being disabled after the first claim.

## The editor — `src/components/marketing/funnelBuilder/FunnelBuilder.js`

Block registry (`BLOCKS`, now `export`ed so `FunnelViewer.js` can reuse the
exact same render functions) supports: `hero`, `volunteerHero`, `heading`,
`paragraph`, `image`, `button`, `emailCapture`, `features`, `cta`,
`endorsedReview`, `products`, `faq`, `testimonial`. `products` (2026-08)
self-fetches `products/{funnelOwnerUid}` from Firebase and reuses
`resolveProductClick` — the same `templateId`→destination routing table
`StoreCanvasBuilder.jsx` exports — rather than a second copy of that
routing logic. No dedicated `checkout` block exists — that's still Phase 2
of `roadmap.md`.

**Images (2026-07-26)**: every "Image URL" field in the inspector (hero,
`volunteerHero`'s background, the standalone image block) now has an
`ImageUrlField` — a paste-a-URL input plus an **Upload** button, instead of
URL-only. Any file picked (whether via that button or the canvas-side
`UploadImage` overlay) goes through `compressImageFile()` first — resized
to a max 1600px on the long edge, re-encoded as WebP (quality 0.82, JPEG
fallback if the browser can't encode WebP) — before `uploadFunnelImage()`
puts it in Firebase Storage. This matters for cost: an unresized phone
photo can be several MB; funnel images are never displayed larger than
page width, so storing/serving the original resolution was pure waste.
Block defaults were also swapped from generic Unsplash stock photos to
real Fotonix product photos served as static files from `public/images/`
(`hero` → `AmeliaBedroom.png`, the standalone `image` block →
`products/lucasroom.jpg`) — zero Storage cost since they're static assets,
not something uploaded through the editor.

**Mailing-list signup (2026-07-26)**: the `button` block gained an
`actionType` (`'link'` default, or `'subscribe'`) — in subscribe mode, the
Link field is replaced by an explanation, and the rendered button becomes
a real inline email-capture form (`SubscribeInlineForm`), not a link at
all. The `emailCapture` block's form — previously `onSubmit={(e) =>
e.preventDefault()}`, i.e. did genuinely nothing — now uses the same
`SubscribeInlineForm` for real. Both submit to `POST /api/contacts` with
the funnel owner's uid as `x-member-uid` (see
`../emails/gotchas.md`'s "There is no per-affiliate mailing list" entry —
**there's no separate list per affiliate**, this is the one shared
tenant-wide `contacts` table, just now correctly tagged with
`member_uid`/`source: 'funnel_signup'` so signups are at least
attributable to which affiliate's funnel brought them in). In the editor's
own canvas (`editable: true`), submitting doesn't actually call the API —
it just shows the success state, so testing the button doesn't pollute the
real contacts list with test emails; only the public `FunnelViewer.js`
page (`editable: false`) submits for real.

Image blocks upload to Firebase Storage, unchanged mechanism from before,
just compressed first now.

**CTA actions (2026-07-27)**: any block with a call-to-action button —
`button`, `hero`, and `cta` — now offers three actions via a shared
`ActionFields` inspector component and shared `CtaAction` renderer:

1. **Link to a URL** — the original behavior.
2. **Join mailing list** — described above.
3. **Follow / Subscribe** — a platform picker (YouTube, Spotify, Apple
   Podcasts, Instagram, TikTok, X, Facebook) plus a handle/URL field.
   YouTube builds a real `?sub_confirmation=1` deep link
   (`buildFollowLink`/`normalizeYouTubeLink` in `FunnelBuilder.js`) that
   pops YouTube's native one-click-subscribe prompt — the same mechanism
   already used for email campaigns in `SubscribeButtonBuilder.jsx`, just
   reimplemented for this React block tree rather than shared code (that
   version builds a raw HTML string for an email; this one renders a real
   anchor). Other platforms just link to a profile URL with the platform's
   brand color applied to the button. This is aimed squarely at this
   builder's actual audience — YouTubers/podcasters growing a following,
   not just sending traffic somewhere.
4. **Go to my Shop** (2026-07-27) — links to `/@<handle>`, resolved live
   from Firebase (`storefronts/{funnelOwnerUid}/handle`) since the handle
   isn't known until looked up. Renders visibly disabled if no storefront
   exists yet, rather than linking to a broken URL.
5. **Go to a Product** (2026-07-27) — a dropdown of the affiliate's own
   products (`products/{funnelOwnerUid}`), linking to
   `/product/{funnelOwnerUid}/{productId}` — the same real product page
   the rest of the site uses.

`volunteerHero`'s own CTA uses the same five actions too (added
2026-07-27, alongside the fake-form fix documented in `gotchas.md`).

**Async action resolution**: Link/Follow are computable synchronously from
the block's own data; Shop needs a real Firebase round trip. `useResolvedActionHref`
is a shared hook (not a plain function) handling both cases uniformly —
used inside `CtaAction` and `ClickableImage` below.

**Clickable images (2026-07-27)**: the standalone `image` block and
hero's own image (side-by-side layout only — see `gotchas.md` for why the
full-bleed overlay layout's background image was deliberately excluded)
can now have the same actions as a button, minus "Join mailing list" and
with an explicit "No click action" default. `ClickableImage` wraps the
`<img>` in a real `<a>` only once an action is actually configured.
Hero's image action uses a separate field namespace
(`imageActionType`/`imagePlatform`/etc., via the `prefixedAction` helper)
so it doesn't collide with the hero's own CTA action fields — one block,
two independent clickable things.

**Persistence, now real**: accepts `funnelId`/`currentUserId`/`companySlug`
props (passed from `App.js`, sourced from the dashboard). If `funnelId` is
set, it fetches the real saved blocks on mount and debounce-autosaves
every change via `PATCH /api/funnels/:id` (800ms after the last edit). The
old single-key `localStorage.funnel.blocks` write is still there
unconditionally — now a crash-recovery draft cache, not the source of
truth, and only ever read from if no `funnelId` was provided (e.g.
reaching the editor directly via a template with no funnel created yet).
The Publish button (previously had no `onClick` at all — completely dead)
now calls `POST /api/funnels/:id/publish` and shows the live public URL
with a copy button once published.

**Known limitation**: if the editor is opened without a `funnelId` (e.g.
picking a template straight from `TemplatesPage` without first creating a
funnel via the dashboard), Publish shows an alert asking the user to
create the funnel from the dashboard first, rather than silently failing
or auto-creating one — creating a funnel always goes through the
dashboard's create flow (which also handles claiming/confirming the
company slug), not through the editor itself.

## Design system — per-funnel theming (2026-08)

Before this, every block hardcoded its own Tailwind colors — nothing was
customizable beyond field content. Researched how real competitors do this
first (ClickFunnels 2.0's Style system, Leadpages' AI Brand Kit, Webflow/
Framer's design tokens) before building anything; findings and the
resulting scope decision:

- **Reused the Shop Builder's `theme.js` engine directly** rather than
  building a second, parallel one — `deriveThemeVars`/`toneStyle`/
  `FONT_PAIRINGS`/`useGoogleFont` are already generic (single brand hex →
  derived CSS-custom-property palette, Google Font pairings, mood presets)
  and nothing in that file is Shop-Builder-specific. This mirrors the
  validated industry pattern (Framer's own "Tokenit" plugin's entire pitch
  is "one brand color in, full design system out") — not a one-off
  invention.
- **No schema change** — the `funnels.metadata` JSONB column already
  existed (created as `{}`, already flowing through create/`PATCH`/the
  public `SELECT *`) but nothing read or wrote it before this. It's now
  used as `metadata: { theme }`.
- **Explicitly not built**: ClickFunnels' full granularity (5 background
  tiers, independent desktop/mobile font sizing, per-role letter-spacing),
  Leadpages-style AI brand extraction (rejected — same reasoning as the
  standing rejection of AI-driven page design elsewhere in this codebase),
  per-block font overrides (page-wide consistency is the actual goal).

**How it works**: `FunnelBuilder.js` holds `const [theme, setTheme] =
useState(DEFAULT_THEME)`, loaded from `funnel.metadata?.theme` on fetch
(falls back to `DEFAULT_THEME` for any funnel saved before this existed —
no migration needed), and included in the existing debounced autosave
(`PATCH .../:id` body gains `metadata: { theme }`). `deriveThemeVars(theme)`
is applied as inline `style` on the canvas's device-frame wrapper (editor)
and on `FunnelViewer.js`'s outer page wrapper (public), so every block
underneath just reads CSS vars (`var(--surface)`, `var(--text)`,
`var(--muted-text)`, `var(--accent)`, `var(--accent-foreground)`,
`var(--border)`, `var(--radius)`, `var(--font-display)`, `var(--font-body)`)
— the same substitution already proven across every Shop Builder block. A
palette-icon button in `EditorHeader` opens a third left-panel mode
(`showDesign`, alongside the existing Blocks/Inspector toggle) showing
`DesignPanel` — brand color, mood, font pairing, corner radius, spacing —
a direct, smaller port of `AffiliateShopBuilderPage.js`'s own Design
section, not a new design.

**Per-block `tone`**: most blocks (`hero`, `heading`, `paragraph`,
`emailCapture`, `features`, `products`, `faq`, `testimonial`) gained a
`tone` field (`default`/`muted`/`contrast`) via a shared `ToneField`
control, applying `toneStyle(data.tone)` from `theme.js` — the same
3-tier system already built for the Shop Builder, not ClickFunnels' 5-tier
version (3 tiers already proved sufficient there; more granularity is a
boundable follow-up if it's ever actually needed, not something to guess
at now). Three blocks were **deliberately excluded**:
- `image` and `cta`'s own background swatches (`CTA_BG_COLORS`) — `cta`
  already had its own explicit per-block color-override system before
  this (a CTA deliberately standing out from the page's palette is a real,
  distinct feature from page-wide theming), so it keeps that system as-is
  and only picked up font-family theming for its headline/subhead; adding
  a redundant `tone` on top of an always-explicit swatch would just be
  confusing.
- `hero`'s full-bleed `gradientOverlay` layout and `volunteerHero` — both
  always sit on a required background photo and already have their own
  explicit overlay/`textColor` contrast system designed for that; forcing
  page-theme colors on top would fight it. Both still picked up
  `font-family: var(--font-display)`/`var(--font-body)` for typographic
  consistency with the rest of the page.
- `endorsedReview` — a third-party embedded widget with its own explicit
  accent-color/light-dark controls (`EndorsedWidget`'s own `color`/
  `themeMode` props) — the same kind of deliberate per-block override as
  `cta`'s swatches, not something page theming should reach into.

`SubscribeInlineForm` (shared by `emailCapture`, `volunteerHero`, and
`button` with `actionType: 'subscribe'`) was themed once at the source —
its submit button reads `var(--accent)`/`var(--accent-foreground)` — so
all three call sites picked up the fix from a single edit, the same
"fix shared components once" pattern already used for `AlignField`/
`VariantField` and the shared `Button`'s `asChild` support (see
`gotchas.md`).

## The dashboard — `FunnelBuilderDash.js`

No longer a hardcoded mock array. On mount, fetches `GET /api/funnels`
(the real list) and `GET /api/funnels/company-slug/mine`. "Create funnel"
claims/confirms the company slug (`POST /api/funnels/company-slug` —
locked/disabled in the modal once a user already has one, since it's
shared across all of a user's funnels, not per-funnel) then creates the
funnel row (`POST /api/funnels`) and navigates straight into the editor
with a real `funnelId`. Clicking an existing row does the same — opens the
editor against that funnel's real id, which triggers the load-on-mount
effect described above.

**One funnel per affiliate (2026-08)**: `POST /api/funnels` 409s if
`SELECT COUNT(*) FROM funnels WHERE user_id = $1` is already > 0 — an
affiliate must delete their existing funnel before creating another. The
dashboard's Create button is disabled with an explanatory note once
`hasFunnel` is true, and the row-level Duplicate action was removed
entirely (it could never succeed once this limit exists, since there's
always already a funnel by the time Duplicate is clickable).

**The modal's "goal" choice is real (2026-07-27)**: `handleCreate` calls
`getStarterBlocks(form.goal)` (`templateRegistry.js`) and sends the result
as the new funnel's `blocks` — `'webinar'` seeds a full Evergreen Webinar
starter (hero/heading/features/paragraph/cta, CTAs set to `subscribe` so
"Save My Seat" opens the real signup form directly), `'audience'` and
`'sell'` seed simpler generic starters, `'custom'` is explicitly `[]`.
Before this, `goal` (and `currency`) were collected in the form but never
sent anywhere — see `gotchas.md` for that history. The five industry-
specific templates (Law Firm, Volunteer, Wildlife, Women's Empowerment,
plus a from-scratch blank) are a *separate* system, reachable only via
`FunnelTemplatesPage` — which, as of the same date, has no live route
pointing to it anywhere in the app (see `gotchas.md`).

## The public viewer — `FunnelViewer.js`

Routed in `App.js` at `/funnel/:companySlug/:funnelSlug` (real React
Router `<Route>`, unchanged). No longer fabricates content — fetches
`GET /api/funnels/public/:companySlug/:funnelSlug` and renders the actual
saved `blocks` array using the same `BLOCKS` registry the editor uses
(imported directly from `FunnelBuilder.js`, `editable: false`), so there's
only one place that knows how to render a `hero` or `features` block, not
two copies that could drift apart.

## Templates — `templateRegistry.js` / `funnelBuilderTemplates/`

Unchanged — starter presets that pre-populate the same block types listed
above. `productLaunch` is still just a preset label, not a real
product/commerce integration (see roadmap Phase 2).

## Routing — hash/state-based for the editor UI, real Router for the public page

Unchanged split: the editor/dashboard/templates pages are driven by a
`currentPage` string in `App.js` (`funnel-builder`, `funnel-builder/templates`,
`funnel-builder/editor`), set via `window.location.hash` — but `App.js` now
also carries `selectedFunnelId`/`selectedFunnelCompanySlug` state alongside
the existing `selectedTemplateId`, threaded through to `FunnelBuilder` as
props so the editor knows which real funnel it's editing. The public
viewer remains the one real `<Route>`.

Reachable from the same two places as before: `AffiliateDashboard.js`'s
"Funnel Builder" button, and `MembersDashboard.jsx`'s equivalent (neither
admin-gated).
