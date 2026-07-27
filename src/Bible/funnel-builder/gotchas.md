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

## Clicking a CTA/button block in the editor actually navigated the browser (fixed 2026-07-27)

Reported live, right after the overlay fix above: clicking the hero's
"Donate Now" button in the editor — trying to select it to edit its
label/link — actually navigated the browser to `#donate` instead. Root
cause: blocks render **real `<a href>` elements** (hero's CTA, the plain
`button` block in link mode, the new `cta` block) so that they work
normally as actual links on the *public* funnel page. `BLOCKRenderer`
(the editor's canvas wrapper) had no guard against that — clicking one
selects the block (via `SortableItem`'s separate `onMouseDown` handler)
*and* the browser still followed the link, since nothing told it not to.

Fixed with a single capture-phase click handler on `BLOCKRenderer`'s
wrapper: `onClickCapture={(e) => { if (editable && e.target.closest('a'))
e.preventDefault(); }}`. Two things worth knowing about this fix
specifically:

- **It's centralized, not per-block.** Rather than patching every
  individual anchor inside `hero`/`button`/`cta`'s `render()` functions
  (and remembering to do the same for every future block that renders a
  link), one guard at the wrapper catches all of them — capture-phase
  handlers run before the anchor's own native navigation, so
  `preventDefault()` here reliably stops it regardless of how deep the
  `<a>` is nested inside the block's markup.
- **It's scoped to `<a>` elements specifically, not the whole block** —
  `e.target.closest('a')` — because a blanket `preventDefault()` on every
  click would *also* suppress a `<button type="submit">`'s default action
  (triggering its form's `submit` event), which is exactly the mechanism
  the "Join mailing list" button/Email Capture block rely on to show
  their editor-preview success state (see the mailing-list entry above —
  `SubscribeInlineForm`'s `handleSubmit` only runs *because* the browser's
  default submit action fires). A naive fix here would have silently
  broken that feature while fixing this one.

This only affects `BLOCKRenderer` (the editor's canvas). `FunnelViewer.js`
(the public page) calls each block's `render()` directly, not through
`BLOCKRenderer` — links behave completely normally there, as they should.

## A batch of usability/consistency fixes (2026-07-27)

Several smaller issues reported together in one pass, fixed and deployed
together. None of these are individually large, but they add up to a much
more trustworthy-feeling editor.

### `POST /api/users/sync` was 404ing on every single login — site-wide, not a funnel-builder bug

Noticed via the browser console while testing the funnel builder, but this
has nothing to do with funnels specifically — `src/contexts/AuthContext.js`
calls this on *every* Firebase login/signup, site-wide, to keep a
PostgreSQL copy of user data in sync. Same root cause as `chatbotServer.js`
and (before 2026-07-26) the funnels API: **`server/routes/auth/users.js`
was a real, complete, already-written route file that was simply never
`require`d/mounted in `server/index.js`.** The call was already wrapped in
a try/catch that only logs a `console.warn` (see `AuthContext.js`'s
`syncUserToPostgres`), so nothing else broke — it's just been silently
failing on every login, forever, until someone actually looked at the
console.

Compounding it: the `users` table it needs didn't exist either (confirmed
via `\d users` — matches the earlier finding in `../emails/gotchas.md` that
`contacts.js`'s `syncStencilUsers` always no-ops because `users` doesn't
exist — same missing table, two different pieces of code both silently
depending on it). Added `server/migrations/002_create_users.sql` (`users` +
`user_activity`, columns taken directly from `users.js`'s own queries —
nothing guessed) and mounted the route at `/api/users`. This is a genuine
two-for-one fix: it makes `/api/users/sync` work for the first time ever,
*and* it means `syncStencilUsers` (in `contacts.js`) will actually start
populating real Stencil Forge users into the contacts list going forward,
instead of being a permanent no-op.

**If you're ever chasing down another "why does this call 404" question in
this codebase, check `server/index.js`'s `require()`/`app.use()` list
first** — there's now a confirmed pattern of complete, correct route files
sitting unmounted (`chatbotServer.js`, the funnels API before 2026-07-26,
and now this).

### Four more broken template images, found by checking every Unsplash URL in the folder

The tiger-photo fix (above, same day) prompted a systematic check: grepped
every `images.unsplash.com/photo-...` URL used anywhere under
`funnelBuilder/` and curl'd each one. Four were dead (404s pointing at
since-removed Unsplash photos), on top of the Wildlife one already found:

- `LawFirmLanding.jsx`'s hero background ("Law library" — replaced with a
  real grand-library photo, `photo-1505664194779-8beaceb93744`).
- `templateRegistry.js`'s Women's Empowerment hero image *and* the matching
  reference in `WomenEmpowermentPage.jsx` (both pointed at the same dead
  URL — replaced with `photo-1495837174058-628aafc7d610`, three women
  silhouetted at sunset).
- The `volunteerHero` block's **default** background image in
  `FunnelBuilder.js` (`photo-1600055701524-4040df79c3d3`, dead) — replaced
  with `photo-1511632765486-a01980e01a18`.
- `templateRegistry.js`'s real Volunteer template schema (`getVolunteerSchema()`)
  and the matching standalone preview (`VolunteerTemplate.jsx`) were **each
  independently pointing at `/templates/volunhero.png`** — a local file
  that was never actually added anywhere under `public/`. Not a dead
  remote URL this time, just a path to a file that doesn't exist. Both
  fixed to the same real Unsplash photo used for the block default above.

**Lesson**: an Unsplash photo URL that worked when the template was
originally written can silently 404 later if the photo gets taken down —
this isn't a code bug that static analysis would catch, and it renders as
"just a gradient, no image" or a broken-image icon depending on the
block's layout, easy to miss in a quick glance. If a template's hero looks
empty/plain, curl the image URL before assuming it's a rendering bug.

### The two hero layouts weren't clearly two different things in the inspector

Before this pass, whether a hero was "side-by-side" or "full-bleed image
with overlaid text" was controlled by a single checkbox buried among other
fields, labeled "Text overlays image (full-bleed background)" — easy to
miss, and didn't communicate that this is a fundamental choice between two
distinct visual layouts, not a minor option. Replaced with a `Field`
labeled **"Hero Style"** at the top of the inspector, presented as two
clearly-described clickable cards ("Side-by-side" vs "Full-bleed image,
text overlaid"), each with a one-line explanation of what it does.

### `ToggleField`/`Switch` were genuinely hard to use — not just a labeling nitpick

Reported as "what does this say? Unreadable" about the "Gradient
background" toggle. Root cause was two compounding styling problems:

1. Every toggle's label used `text-xs uppercase tracking-wider
   text-gray-600` — fine for a short field label like "IMAGE URL," but
   turns into a cramped, hard-to-parse wall of tiny spaced-out capital
   letters for anything longer.
2. `Switch` itself was a **completely unstyled native `<input
   type="checkbox">`** — despite being named "Switch," it didn't look like
   a toggle at all, just a small default browser checkbox easy to miss
   entirely next to its own label.

Fixed both, globally (affects every `ToggleField` across every block, not
just hero): `ToggleField`'s label is now `text-sm text-gray-700` (normal
case, readable at any length), and `Switch` is now a real pill-shaped
toggle with a sliding circle (`role="switch"`, `aria-checked`), colored
indigo when on. Also renamed hero's "Gradient background" toggle to
"Subtle gradient tint behind text" — it does something completely
different from the new "Hero Style" full-bleed overlay feature above, and
sharing the word "gradient" between two unrelated features was itself part
of the confusion.

### Blocks were inconsistent about what's inline-editable vs. inspector-only — now every block supports both

Reported directly: some blocks let you click text in the canvas and type
(only `hero`'s headline/subhead had this), while everything else — 
`heading`, `paragraph`, `volunteerHero`, `button`'s label, `emailCapture`'s
headline, `features`' title *and* each item's title/description, the new
`cta` block's headline/subhead/button label, and hero's own CTA label —
could only be changed through the Inspector panel. Added
`contentEditable`/`onBlur` to all of them, following the exact same
pattern hero's headline already used, so every block now supports **both**
inline click-to-edit *and* the Inspector — not one or the other.

**Deliberate exception, not an oversight**: the "Join mailing list" button
and the Email Capture block's button/input (`SubscribeInlineForm`) stay
Inspector-only for their button label. That component's button is a real
interactive submit control (see the mailing-list entries above) — making
it simultaneously a text-edit target risks fighting with its actual click
behavior. Its label is still fully editable, just from the Inspector, not
inline.

**Known remaining gap, not fixed in this pass**: `volunteerHero`'s nav bar
(logo text, nav links, its own separate CTA button) is still
Inspector-only — secondary/less commonly touched content, and the nav
links are an array, which would need more than a simple `contentEditable`
span. Flagging so it isn't assumed to be part of the "both editable"
guarantee above.

### The Create Funnel modal didn't explain what happens after you click Create

Reported as "how are they actually publishing this funnel? this is
confusing." The modal walked through name/company/goal/currency but never
mentioned that creating a funnel just opens the editor with a **draft** —
nothing is publicly visible until the separate Publish button (top-right
of the editor, added 2026-07-26) is clicked. Added a plain-language note
directly in the modal, right above the Create button, saying exactly that.

### There were genuinely two different "Create funnel" modals — one real, one dead

Found right after the note above, from a screenshot of a "Create funnel"
dialog with a `<storename>.fotonix.co.uk`-style domain field, goal icons,
and a "Save" button — a form that looks almost identical to the real one
on the Funnels dashboard, but isn't it. This second modal
(`CreateFunnelModal`, defined *inside* `FunnelBuilder.js` itself, opened
via a "+ Create" button in the editor's own header) predates the 2026-07-26
backend build and was simply never removed: its "Save" button only ever
called `setShowCreateModal(false)` — closes the dialog, no API call, no
funnel created, nothing saved anywhere. Its own local `funnelData` state
(name/domain/goal/currency) was written to and read from *only within this
one dead component* — nothing downstream ever consumed it.

Removed entirely rather than wired up — the "+ Create" button, the modal,
its state, and its four now-unused icon imports
(`funnel-icon_audience.svg` etc.) — since you're already inside the editor
for a specific real funnel by the time you'd see this button; a second
"create another funnel" entry point nested inside the editor doesn't add
anything the dashboard's own real "Create" button doesn't already do, and
having two near-identical forms where only one actually works is strictly
worse than having one. The Funnels dashboard's "Create" button
(`FunnelBuilderDash.js`) is now the only create-funnel entry point in the
app.

## CTA buttons gained real "Follow / Subscribe" actions for creators (2026-07-27)

The affiliates this builder is actually for are YouTubers and podcasters —
their goal with a button usually isn't "link somewhere," it's "grow my
following on a specific platform." A working pattern for this already
existed, just nowhere near the funnel builder: `src/components/email/
MailBuilder/SubscribeButtonBuilder.jsx` builds a real YouTube subscribe
button for email campaigns, using the channel's `?sub_confirmation=1` query
param — a real YouTube feature that pops their native one-click-subscribe
prompt directly, instead of just linking to the channel page.

Added a third CTA action (alongside the existing Link and Join-mailing-list
options) — **Follow / Subscribe** — to the `button` block, `hero`'s CTA,
and the `cta` block. Picking it shows a platform picker (YouTube, Spotify,
Apple Podcasts, Instagram, TikTok, X, Facebook) and a handle/URL field.
YouTube reuses the exact `sub_confirmation` mechanism from
`SubscribeButtonBuilder.jsx` (`normalizeYouTubeLink`/`buildFollowLink` in
`FunnelBuilder.js` — same logic, re-implemented rather than imported,
since the Mail Builder version is coupled to that editor's own HTML-string
output, not a React block); every other platform just takes a profile
URL, since none of them have an equivalent deep-link trick. Each platform
also has its own brand color, applied to the rendered button so a
"Subscribe on YouTube" button is recognizably red without the affiliate
having to pick a color manually.

**Built once, shared three ways** — `ActionFields` (the inspector's
Action/Platform/Handle controls) and `CtaAction` (the actual rendered
button/form) are both shared components, used by all three CTA-bearing
blocks. A minor tradeoff of sharing across blocks that use different field
names for their label (`button` uses `data.label`, `hero`/`cta` use
`data.ctaLabel`): `ActionFields` writes both `label` and `ctaLabel` on any
change that sets a default label, so each block just reads whichever one
it actually uses — the other sits as a harmless unused key in that block's
`data`. Cheaper than parameterizing field names through props for three
call sites.

### `volunteerHero` was missed entirely in the above — and had its own separate fake-button bug

Reported directly: "check out Volunteer Hero block, its button is still
wrong, its not a drop down." Correct — the CTA/hero/button rollout above
only touched `button`, `hero`, and `cta`; `volunteerHero`'s own nav CTA
was never wired to `ActionFields`/`CtaAction` at all, still just a plain
`ctaLabel`/`ctaHref` link with no action choice. Fixed the same way as the
others.

While fixing it, found a second, independent bug in the same block: the
email input + button sitting right below the headline **had never
actually done anything** — the button had no `onClick`/submit handler at
all, and its `buttonHref` field was defined in `defaults()` and editable
in the Inspector but never once read inside `render()`. Purely decorative,
the whole time. Replaced it with the same real `SubscribeInlineForm` used
everywhere else — but made it **conditional on the button label being
non-empty**, not always-on: the actual Volunteer template
(`getVolunteerSchema()` in `templateRegistry.js`) deliberately blanks
`buttonLabel`/`placeholder` to keep this row hidden, since that template
already has a separate, real `emailCapture` block further down the page —
making the row always render would have put two signup forms on one
funnel. `buttonHref` itself is now fully removed (dead field, nothing
reads it) rather than left as inert leftover data.

Also noted, not fixed (dead code, doesn't affect the live app):
`VolunteerTemplate.jsx` — the *preview* component for this template, not
the schema actually used — has its own internal `getSchema()` function
with a *different*, non-blanked `buttonLabel`. It's never called;
`getStarterBlocks('volunteer')` only ever calls `templateRegistry.js`'s
`getVolunteerSchema()` (confirmed via the `case 'volunteer':` switch).
Harmless as long as nothing ever wires that dead function up for real.

## "Run an evergreen webinar" had nothing behind it — and neither did the other three goals (fixed 2026-07-27)

Asked directly: what's behind the "Run an evergreen webinar" option in the
Create Funnel modal? Checked, and the honest answer was **nothing at
all** — same shape as several other findings this session. `goal` is
collected in the modal's form state and required to enable the Create
button (`disabled={... || !form.goal || ...}`), but `handleCreate` only
ever sent `{name, slug}` to `POST /api/funnels` — `goal` (and `currency`,
see below) were captured and then silently discarded. Every funnel, no
matter which goal you picked, started as an empty draft.

This also surfaced a bigger, related gap: the five *real* templates with
actual pre-built content (Law Firm, Volunteer, Wildlife, Women's
Empowerment, Custom Blank — see `getStarterBlocks()` in
`templateRegistry.js`) were, as of the 2026-07-27 dead-modal removal
(above), **completely unreachable from the live app.** The only route to
`FunnelTemplatesPage` (`currentPage === 'funnel-builder/templates'`) was
the dead internal "+ Create" button removed earlier the same day — nothing
else in the codebase ever navigates there. Grepped the whole
`funnelBuilder/` folder for that hash string to confirm: zero hits outside
`App.js`'s own route definition.

**Fixed by making the modal's goal choice actually do something**,
rather than trying to re-surface the orphaned `FunnelTemplatesPage` flow
(the goal categories — audience/sell/custom/webinar — don't map cleanly
onto the five industry-specific templates anyway, so keeping them as a
separate, simpler system made more sense than forcing a merge):

- Built a real **Evergreen Webinar** schema (`getWebinarSchema()` in
  `templateRegistry.js`) — hero (full-bleed image + `actionType:
  'subscribe'` CTA, so "Save My Seat" opens the real inline signup form
  directly, no separate page section needed), heading, features, paragraph,
  a closing `cta` block (also `subscribe`). "Evergreen" specifically means
  presented as available on-demand any time, not a scheduled live event —
  hence no date/countdown copy anywhere in it.
- Added `'audience'` and `'sell'` cases to `getStarterBlocks()` too, so
  every goal in the modal now seeds something real, not just webinar —
  `'audience'` → hero/features/emailCapture, `'sell'` → hero/features/cta.
  `'custom'` now explicitly returns `[]` (a real, addressed case) rather
  than silently falling through to the `default:` case's generic
  "Start from Scratch" hero.
- `FunnelBuilderDash.js`'s `handleCreate` now calls
  `getStarterBlocks(form.goal)` and sends the result as `blocks` in the
  `POST /api/funnels` body — this is the actual fix; everything above was
  pointless without this one-line wiring change, since `templateRegistry.js`
  already had four other working schemas that nothing was calling from
  the real creation flow.

## Currency selector in the Create Funnel modal was, and still is, purely decorative — added an honest disclaimer instead of pretending otherwise

While fixing the goal-wiring bug above, noticed `currency` has the exact
same problem `goal` did: collected in form state, shown in the UI, never
sent anywhere. Unlike `goal`, this wasn't asked to be wired up to real
tax/currency-conversion logic — there's no VAT/tax-agreement handling with
EU countries anywhere in this codebase, and building real multi-currency
checkout support is a much bigger job than this modal. Instead, added a
plain-language disclaimer that appears in the modal whenever a non-GBP
currency is selected:

> Prices may be displayed in your local currency. The final amount can
> vary slightly due to exchange rates or fees charged by your bank or
> payment provider. International delivery charges, import VAT, customs
> duties or handling fees may also apply depending on the customer's
> country.

This doesn't make the currency field *functional* — it still isn't sent
anywhere — but it stops the UI from silently implying a level of
international pricing support that doesn't exist.

## New CTA actions: Go to my Shop, Go to a Product (2026-07-27)

Requested directly: buttons (and images, see below) should be able to
send visitors to the affiliate's own storefront or to one specific
product, not just an arbitrary URL. Added as two more options in
`ActionFields`'s Action row, alongside Link/Join-mailing-list/Follow:

- **Go to my Shop** — resolves to `/@<handle>`, where `<handle>` is looked
  up live from Firebase RTDB (`storefronts/{funnelOwnerUid}/handle`) —
  this is a genuinely different identifier from the funnel's own
  `company_slug` (Postgres), see `architecture.md`'s "Company slugs"
  section for that distinction. If the affiliate hasn't set up a
  storefront yet, the button renders visibly disabled (dimmed, not
  clickable, with a title tooltip) rather than linking to a broken `/@`
  URL.
- **Go to a Product** — a dropdown in the Inspector, populated by fetching
  the affiliate's own product catalog (`products/{funnelOwnerUid}` —
  the same Firebase node the affiliate dashboard's "My Products" list
  already reads), linking to the real product page
  (`/product/{funnelOwnerUid}/{productId}`, the same route
  `CustomerProductPage.jsx` already serves for normal product links).

**Why this needed a hook, not just a function**: resolving "Go to my Shop"
requires an actual network round trip (the handle isn't known until it's
looked up), unlike Link/Follow which are computable synchronously from
data already on the block. `useResolvedActionHref` is a real hook
(`useState`/`useEffect` inside it) for exactly this reason — used inside
`CtaAction` and `ClickableImage`, both genuine components invoked via
JSX, so the hook is safe there regardless of how the *calling* block's
`render()` is written (see the `BLOCKRenderer`/anchor-guard gotcha above
for the same reasoning applied to a different problem).

**The standalone `button` block was refactored to stop duplicating
`CtaAction`'s logic a third time** — it had its own separate,
slightly-different copy of the follow-link computation before this
change. It now renders `<CtaAction labelKey="label" .../>` like
hero/cta/volunteerHero do — `labelKey` exists specifically because
`button` stores its text in `data.label`, while hero/cta/volunteerHero use
`data.ctaLabel`; `useResolvedActionHref`'s plain "link" case already
checked both `data.href` and `data.ctaHref`, so only the *label* field
name needed a real parameter, not a bigger refactor to unify the data
shapes (which would risk breaking already-created button blocks that
have real `label`/`href` data saved).

## Images can now have a click action too (2026-07-27)

Requested directly: "treat \[an image] like a button if they want an
onclick." Added the same Action system to the standalone `image` block,
minus "Join mailing list" (an inline email form doesn't make sense
appearing in place of an image) and with an explicit "No click action"
default (unlike buttons, where "Link" is the sensible default — a plain
image shouldn't suddenly become clickable just because this feature
shipped). `ActionFields` gained `allowSubscribe`/`allowNone` props for
this; `ClickableImage` is the rendering counterpart — wraps its children
in a real `<a>` only when an action is actually configured, otherwise
returns the image completely unchanged.

**Hero's own image, not just the standalone image block** — but only in
the *side-by-side* layout, not the full-bleed overlay one. In overlay
mode the image already fills the entire hero section behind the CTA
button; wrapping it in its own separate anchor would mean an anchor
containing another interactive element (the CTA), which is both invalid
markup and confusing UX (two independently-clickable areas stacked on top
of each other). Side-by-side mode's image is a genuinely separate visual
element from the CTA, so it got the feature; the overlay background did
not, on purpose. The Inspector reflects this — the image click-behavior
section only appears when Hero Style is set to Side-by-side.

Hero's image action needed a **separate field namespace from the CTA's
own action** (`imageActionType`/`imagePlatform`/`imageHandle`/
`imageProductId` vs. the CTA's plain `actionType`/`platform`/`handle`/
`productId`) since one block now has two independent clickable things.
`prefixedAction(data, onChange, 'image')` handles the remapping — it lets
the exact same `ActionFields`/`ClickableImage` components (which only
know about plain field names) be reused for the image without either
click action's inspector fields overwriting the other's.

## Hero's image was needlessly capped to the text's reading width (fixed 2026-07-27)

Reported from a screenshot: the default hero's image rendered noticeably
narrower than the card around it, with visible empty space on both sides
that wasn't just the section's own padding. Root cause: in centered-align
mode, the image lived as a sibling *inside* the same wrapper
(`max-w-2xl`, 672px) used to keep the headline/subhead at a comfortable
reading width. That width cap makes sense for text — it doesn't for a
photo, which generally looks better filling the available card width.

Fixed by moving the centered-mode image **out of** the `max-w-2xl`
wrapper entirely, so it now defaults to the full width of the hero
section (minus the section's own padding) instead of being squeezed to
672px. Side-by-side mode was already fine — there, the image is a grid
column, not a sibling of the text-width wrapper.

Also added an actual **Width** control (a percentage slider, 20–100%,
matching the pattern the `paragraph` block's "Max width" already used) to
both hero's image and the standalone `image` block — so once the
default-too-narrow bug above was fixed, there's still a real, deliberate
way to make an image narrower if that's the look someone wants, rather
than it happening by accident.
