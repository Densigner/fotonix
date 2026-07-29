# Gotchas — the debugging story

The affiliate program looked essentially complete before this session — a
full dashboard, click charts, a commissions table, a signup flow. **Almost
none of it actually worked.** It's worth reading this roughly in order,
because the debugging path itself explains how the pieces connect, and the
final bug (found last, after fixing everything else) is a good reminder that
"looks done" and "is done" are very different things.

## The starting state: a complete-looking UI wired to nothing

- The dashboard's "My Products" button called `/api/products`, a JSON-file
  endpoint that had nothing to do with the actual products system (which
  lives in Firebase). Fixed to read Firebase RTDB `products/{uid}` directly.
- `AffiliateDashboard` was given a **hardcoded** `affiliateCode="ALEX10"`
  prop — every affiliate saw the same fake code and the same fake stats,
  regardless of who was logged in. Fixed to `auth.userProfile?.affiliateCode`.
- A sibling component (`AffiliateDashboardclick`) was passed the Firebase
  UID as if it were the affiliate code — same bug, different component.
- Login routing had a typo-class bug: successful login set the page to
  `'member'`, but the actual page constant was `'member-dashboard'` — so
  login silently did nothing visible.
- `affiliates.js`'s `DATA_DIR` pointed at `routes/data/` instead of `data/`
  — one directory level wrong — so every stats/settings read/write silently
  hit an empty or wrong location. All dashboard numbers showed zero,
  indistinguishable from "no clicks yet."
- `writeJSON` was called in the settings-save route but **never defined** in
  that file — saving settings threw immediately.
- The click timeseries (the little bar chart) was initialized but never
  incremented in a loop — always showed zero regardless of real click count.

None of the above produced a visible error anywhere — every one of them
degraded to "shows zero" or "silently does nothing," which is
indistinguishable from "just hasn't been used yet" unless you go looking.

## Then: click capture itself was dead code

The actual `useAffiliateRef` hook wasn't even wired into `App.js` — it
existed as a file but nothing imported/called it, so `?ref=` was never read
at all regardless of anything else. Fixed by importing and calling it in
`AppContent()`.

Also found and fixed: a React 18 StrictMode double-invoke bug — the
session-storage "already tracked this ref" guard was being set *inside* the
`.then()` of the fetch, so StrictMode's intentional double-render in dev
could fire the beacon twice before the guard took effect. Fixed by setting
the guard synchronously before the fetch, not after.

## Checkout wiring

- PayPal SDK failed to load in production ("Retry PayPal SDK" loop) because
  `REACT_APP_PAYPAL_CLIENT_ID` was missing from `.env.production` — CRA
  bakes `REACT_APP_*` vars in at build time, so the SDK script loaded with
  `client-id=undefined` and PayPal rejected it outright.
- PayPal webhook signature verification always failed — the code used
  `Authorization: Basic <client_id:secret>` against
  `/v1/notifications/verify-webhook-signature`, but that endpoint requires a
  Bearer OAuth token (Basic auth is only valid for the token-exchange
  endpoint itself). Fixed by doing a proper `POST /v1/oauth2/token` first.
- Separately, even after that fix, verification *still* failed — because
  `server/index.js` loads env vars from `/var/www/.env`, not
  `/var/www/fotonix-api/.env` (see `path.resolve(__dirname, '../.env')`),
  and the webhook ID had only been updated in the wrong file. Always check
  which `.env` is actually being loaded before assuming an env var change
  took effect.
- `PayPalButton.js`'s fetch calls were missing `credentials: 'include'` —
  without it, the `aff_click` cookie never crossed from `fotonix.co.uk` to
  `api.fotonix.co.uk` (different subdomains = cross-origin, cookies aren't
  sent by default even though CORS itself was configured correctly
  server-side).

## The big one: clicks still weren't recording, after everything above was fixed

Three real test purchases in a row still showed `clickId: 'no_aff'`, with
**zero** matching rows in `clicks.json` for any of them — meaning
`/api/clicks/create` was never even being *called*, not failing after being
called. Every earlier fix (credentials, cookies, webhook auth) was real and
necessary, but none of them were the actual blocker for this specific
symptom. The investigation initially (reasonably) suspected the test
purchaser's browser — ad blockers, Safari ITP, or the referral link being
mangled by a messaging app on share.

**The real cause**: `useAffiliateRef.js` posted to a **relative** path,
`fetch('/api/clicks/create', ...)`. On `fotonix.co.uk` (the static frontend
host), there's no reverse proxy for `/api/*` — that relative path resolved
to `fotonix.co.uk/api/clicks/create`, which doesn't exist there, so the
static host's SPA fallback served `index.html` with an ordinary `200 OK`.
The fetch "succeeded" (no network error, nothing to `.catch()`), the
response body was just useless HTML that nothing checked, and the real API
at `api.fotonix.co.uk` never received the request at all. Fixed by using
the full `API_URL` from `src/config/environment.js` instead of a relative
path.

**This exact same bug pattern** (bare `/api/...` relative fetch, works fine
in local dev because CRA's `package.json` `"proxy"` field masks it, silently
broken in production) turned out to affect ~40 other call sites across the
codebase, not just this one — see the general note about it in
`../emails/gotchas.md` item 8. If you're adding a new `fetch()` call
anywhere in the frontend, always use `API_URL`, never a bare `/api/...`
string, and don't trust that it working in `npm start` means anything about
production.

## Known, currently-unfixed gaps

- **`AffiliateMasterDashboard.jsx`** calls `/api/affiliates/stats` and
  `/api/affiliates/attributions` with no `code` query param — both routes
  require it and will 400. This component's underlying data-fetching design
  doesn't match what the backend actually expects (looks like it wants an
  "all affiliates, admin view" endpoint that doesn't exist — the real
  `/stats` is always scoped to one affiliate's code). Not fixed yet;
  flagged during a routes audit but out of scope at the time.
- **The Postgres `affiliates` table** referenced by `member.js`'s `/stats`
  doesn't exist — see `database.md`'s "Postgres" section. Defensively
  handled (returns zero instead of 500) but not actually fixed/rebuilt.

## The manual affiliate-creation system was removed, not fixed

A whole parallel feature — members manually creating and managing their own
affiliate accounts, backed by that missing Postgres table — was deleted this
session rather than repaired: the UI (`AffiliateCreator.jsx`,
`AffiliateManager.jsx`), the "Manage Affiliates" dashboard button, and the
`POST/PATCH/DELETE /api/member/affiliates` routes are all gone. Reasoning:
the table never existed in production, so nothing created through that UI
was ever actually persisted — it was pure UI theater, same failure pattern
as the Star/Archive/Delete bugs described in `../emails/gotchas.md`. The
read-only search endpoint (`/api/member/affiliates/search`, backed by the
flat-file `member_affiliates.json`) was left alone since another live
feature (`LinkCreator.jsx`) depends on it, even though it's currently always
empty for the same underlying reason.

## The "Links" dashboard was pure filler and was removed (2026-07-25)

`AffiliateLinkDashboard.js` existed as two near-identical copies
(`src/links/` and `src/components/affiliate/`, only the former was ever
imported) and was reachable from the affiliate dashboard's "Links" button.
Both fetched `/api/links?user=...`, `/api/links/:slug/stats`, and linked to
`/l/:slug` — **none of these routes exist in the production backend**
(`server/index.js`). The fetch always failed and silently fell back to
`Math.random()` mock data (fake slugs like `promo-100`, fake click counts) —
indistinguishable from real data unless you read the code. Removed both
files, the lazy import, the `affiliate-links` page case, and the dashboard
button in this session; no functionality was lost since it never worked.

This surfaced a **third, previously-undocumented, entirely dead codebase**:
`src/server.js` (2000+ lines, started only via `npm run start:server`, never
part of the deployed `fotonix-api` PM2 process) implements its own
`/l/:slug` redirect and its own Postgres tables (`tracked_links`,
`link_clicks`) — completely separate from the three real data stores in
`database.md`. Don't confuse code found there with what's actually live.

**The real, working referral mechanism remains simple**: appending
`?ref=CODE` to *any* page URL on `fotonix.co.uk` is the whole thing — see
`architecture.md` step 1. No slug, no "create a link" step, no dashboard
needed for the basic case.

One real feature is still an orphaned dead end, not yet fixed: `LinkCreator.jsx`
(used from `MembersDashboard.jsx` with `userType="member"`) genuinely writes
to `member_links.json` via the real `POST /api/member/links` route — but
since there's no `/l/:slug` handler in production, a link created this way
has nowhere to resolve to if visited. If custom per-affiliate/per-product
tracked links are wanted, that redirect route needs to be built (reading
`member_links.json`, not the dead `tracked_links` Postgres table) — it does
not currently exist anywhere in the deployed system.

## Main dashboard graphs were half-real (fixed 2026-07-25)

Auditing `AffiliateDashboard.js` (the main per-affiliate dashboard, not the
deleted Links one) after the above: the "Clicks (last 30 days)" line chart
and the KPI tiles were genuinely wired to live data — this file was written
more carefully than the deleted `AffiliateLinkDashboard.js` and explicitly
avoided fabricating data on fetch failure (shows an empty state instead).
Two real bugs found and fixed anyway:

- **"Commission by Day" bar chart used a hardcoded 10% rate.** A local
  `toCommissionSeries()` helper recomputed `commissionCents` as
  `revenue * 0.1` client-side, ignoring the fact that real commission rates
  vary (link-custom or product-specific, per `architecture.md`'s rate
  resolution order) and that the *correct* per-order `commissionCents` was
  already being fetched via `/api/affiliates/attributions` and used
  correctly elsewhere on the same page (KPI tiles, Commissions table). Fixed
  by having `/api/affiliates/stats`'s timeseries aggregation
  (`server/routes/affiliate/affiliates.js`) sum each attribution's real
  `commissionCents` per day server-side, and pointing the chart at that
  field directly instead of re-deriving it. Any affiliate not on exactly the
  default 10% rate was seeing a chart that silently disagreed with their own
  commissions table.
- **"Visitors" KPI tile always showed 0.** It read `stats.unique_visitors`,
  a field `/api/affiliates/stats` never returns — there is no unique-visitor
  concept anywhere in the real pipeline (`clicks.json` has no visitor/session
  id, just one row per click event, see `database.md`). Removed the tile
  rather than fabricate the concept; building real unique-visitor tracking
  would need a visitor-id cookie and dedup logic that doesn't exist yet.

Also removed: `genMockTimeseries`, `genMockRows`, `safeGet` — three unused
helper functions left over in `AffiliateDashboard.js` from an earlier
mock-data version, never called from the live render path.

## The affiliate storefront's commission-tracking bug moved to store-builder/gotchas.md

A separate affiliate self-serve page (`/@handle`, via
`AffiliateShopBuilderPage.js`) had a commission-tracking bug found and
fixed 2026-07-26 — full writeup lives in `../store-builder/gotchas.md`
(grouped with the codebase's other page-builder systems rather than
nested under affiliates specifically). Short version: the page itself was
real and worked, but never tracked a click or linked to a working product
page, so it generated zero commission until fixed.

## Self-signup codes were improved, not just left alone

Original codes were fully random (`AFF` + 6 random base36 chars, e.g.
`AFF813A73`) — secure and collision-resistant, but unpronounceable, which
matters if an affiliate wants to say their referral link out loud (e.g. in a
YouTube video). Changed to a short code derived from the signup email's
local-part + a random 2-digit suffix (e.g. `JOSH42`), with a real uniqueness
check against existing codes in Firebase RTDB (retries on collision, up to
25 times, with a timestamp-based guaranteed-unique fallback if that
somehow still collides). See `architecture.md`'s "Self-signup" section for
the exact mechanism.

## "Master Dashboard" was broken by design, not just missing a param (fixed 2026-07-27/28)

Found while investigating a user report that the commission dashboard "looks
bad" and showed another affiliate's order. Turned out to be several stacked
problems, not one:

1. **`AffiliateMasterDashboard.jsx` called `/api/affiliates/stats` and
   `/api/affiliates/attributions` with no `code` query param at all** — both
   routes require it and always 400'd (`{"error":"Missing code"}`), so the
   modal never loaded real data regardless of anything else. This was
   already flagged as a known gap further up this file before being
   properly fixed.
2. **Despite the name, neither route was ever a cross-affiliate "admin"
   view** — both filter to `attributions.filter(a => a.affiliateId === code)`
   server-side. So even giving it a `code` would only ever show *that one
   affiliate's* data, never "every affiliate's owed commissions" the
   component's own "What You Owe to Affiliates" section implied.
3. **The ledger table read field names neither route actually returns**
   (`a.orderId`, `a.ratePct`, `a.createdAt`, `a.affiliateId`) — the real
   `/attributions` shape is `{id, orderNumber, date, amountCents,
   commissionCents, status, notes}`, matching what `AffiliateDashboard.js`'s
   own (correctly working) commissions table already used. `a.ratePct.toFixed(1)`
   would have thrown outright the moment any real attribution existed to
   render — it just hadn't triggered yet because the test account being
   used had zero commissions.
4. **The "Mark Paid" button called `POST /api/affiliates/mark-paid/:affiliateId`,
   which didn't exist anywhere on the backend** — would have 404'd.

**`AffiliateMasterDashboard.jsx`** (still reached via the "Master Dashboard"
button — name not yet changed) is now fixed to be a real "your own
commissions" page: correct `code`/`x-affiliate-code` header, correct field
names, no cross-affiliate section, no fake Mark Paid button. Converted from
an inline modal to a real page (`currentPage === 'affiliate-master-dashboard'`
in `App.js`) per explicit request — reachable via hash navigation with a
"← Back to Affiliate Dashboard" link, same auth/`emailVerified` gate as the
dashboard it's linked from.

For the genuine cross-affiliate "what do I owe everyone" view: **a whole new
admin page (`AdminAffiliatePayouts.jsx`) was built first, then deleted again
in the same session** once it turned out to be redundant — see the very next
entry. `MembersDashboard.jsx`'s existing "Overview" tab (reachable via the
pre-existing "Member Dashboard" nav link, already `isMember`-gated) already
does this job: real `attributions.json` data, a working "What You Owe (by
Affiliate)" breakdown, Mark Paid via the already-existing
`POST /api/member/attributions/mark-paid`, full ledger, CSV export. It just
looked broken (empty state) because of a DATA_DIR bug — see below. Once that
was fixed, the new page was pure duplication and got removed rather than
kept alongside it.

## A new admin payouts page was built, then found to be redundant and removed (2026-07-28)

Straightforward "measure twice" lesson worth writing down in full since it
cost real (avoidable) work: `AdminAffiliatePayouts.jsx` (new component),
`GET /admin/overview` + `POST /admin/mark-paid/:affiliateId` (new routes in
`affiliates.js`), a new "Affiliate Payouts" nav link, and a new gated page in
`App.js` were all built and deployed live before it was checked whether
something already covered this. It did: `MembersDashboard.jsx`'s "Overview"
tab (see above) computes the identical "owed by affiliate" breakdown and
ledger from the same real `attributions.json` data, with a working mark-paid
action already wired to a real route (`POST /api/member/attributions/mark-paid`
in `member.js`) — it was just returning empty results because of the
DATA_DIR bug below, which read as "no data yet," not "broken."

All of the new admin-specific code was deleted once this was confirmed:
`AdminAffiliatePayouts.jsx`, its import/page-block in `App.js`, its nav link
in `Header.js`, and `ADMIN_EMAIL`/`isAdmin()`/`amountCentsForOrder()` plus
the two new routes in `affiliates.js`. The `DATA_DIR`/`writeJSON` fixes
below (which is what actually made the *existing* Overview tab start working)
were kept, since those are real, independent bug fixes regardless of which
UI ends up using them.

**Takeaway**: before building a new admin-facing view from scratch, check
whether an existing admin-gated page (`MembersDashboard.jsx` here) already
computes the same thing from the same data source — an empty-looking result
from a real feature and "this was never built" look identical from the
outside, and this codebase has enough of the latter that it's easy to
default to assuming that's what you're looking at.

## `AffiliateDashboard.js`'s own stats were also silently all-zero in production (fixed 2026-07-28)

Found while building the above: the *main* per-affiliate dashboard (not just
the broken modal) defaulted `apiBase` to `''` and was never passed a real
value from `App.js` (`<AffiliateDashboard affiliateCode={...} programUrl={...} />`
— no `apiBase` prop at all). Its stats/attributions fetches then used a bare
relative `${apiBase || ''}/api/affiliates/stats?code=...` path — on
`fotonix.co.uk` (the static frontend host, no reverse proxy for `/api/*`),
that silently hit the SPA's own `index.html` fallback (a `200 OK` with HTML,
not JSON) instead of erroring, which threw on `.json()` and fell into the
existing "show empty state on error" branch. Same failure signature as
`../emails/gotchas.md`'s item 8 (~40 other call sites hit by the identical
bug pattern) — confirmed live by curling both the relative and full-URL
paths directly and comparing responses, not just reading code. Fixed by
falling back to the imported `API_URL` instead of an empty string. This had
apparently been broken in production for a while — nothing about it looked
wrong in local dev, since CRA's proxy config masks the exact same class of
bug there.

## The DATA_DIR/writeJSON bugs turned out to exist independently in *two* files (fixed 2026-07-28)

Both are repeats of bugs this very file already documented as fixed once in
`affiliates.js` — worth a strong warning for next time:

1. **Regression in `affiliates.js` itself.** `writeJSON` (called in
   `POST /settings`, never defined) and `DATA_DIR` pointing one directory
   level too shallow (`path.join(__dirname, '..', 'data')` = `routes/data/`,
   empty on the VPS, instead of `path.join(__dirname, '..', '..', 'data')` =
   the real `server/data/`) both reappeared in the version of this file that
   had been sitting in the local working copy — despite both already being
   documented above as "found and fixed" during the original affiliate-
   program repair. Deploying that stale local copy (as part of the
   now-removed admin-payouts work) briefly broke `/stats` in production —
   verified working with real numbers earlier this same session, verified
   broken (all zeros) immediately after that deploy, caught and fixed within
   the same session. Classic "two copies drift" (`DEPLOYMENT.md`) — the VPS
   had a fix that was never committed to git, and the local copy overwrote it.
2. **The exact same bug, independently, in `member.js`** (a completely
   separate file, `server/routes/member/member.js`) — same one-level-too-
   shallow `DATA_DIR`, same missing `writeJSON`. This one wasn't a
   regression, just never fixed in this file at all — found while checking
   whether `MembersDashboard.jsx`'s "Overview" tab (see above) could replace
   the newly-built admin page, since its `/api/member/attributions` fetch
   was mysteriously returning `[]` despite `attributions.json` genuinely
   having 4 rows. This is also what was silently breaking
   `member_links.json`/`member_affiliates.json` reads/writes elsewhere in
   the same file (the tracked-links feature, the affiliate-search
   autocomplete) — worth re-checking those now that the path is fixed,
   they weren't independently re-verified live this session.

**Takeaway**: after any deploy touching either of these files, don't just
check the API responds — check the *numbers* match what's actually in
`server/data/*.json`. Both of these bugs return a perfectly well-formed,
error-free, empty-looking response, indistinguishable from "no data yet"
unless you already know what real data should look like. If a route's data
source is `readJSON`/`writeJSON` against `DATA_DIR`, and it's ever returning
suspiciously empty results, check `DATA_DIR`'s resolved path against
`server/data/` directly before assuming the underlying data is actually
missing.

## Email verification was a dead end for every new affiliate (fixed 2026-07-29)

`AffiliateSignupPage.js` sends a **custom** verification email (own token,
own Postgres table `user_email_verification`, own VPS SMTP send) rather than
using Firebase's built-in one. Clicking that link hit the backend's
`/api/auth/verify-email?token=...`, which marked our own table verified —
but the line that would also flip Firebase Auth's real `emailVerified` flag
(`server/CustomFirebaseEmailVerification.js`'s `verifyEmailToken()`) was
commented out: `// Update Firebase user as verified (skip for now - can be
done from frontend)`. It was never done from the frontend either.

`App.js` gates essentially every affiliate page (`affiliates`,
`affiliate-shop-builder`, `affiliate-add-product`, `store-builder`, etc. —
~9 separate checks) on `auth.currentUser.emailVerified`, which only gets
set by Firebase's *own* verification flow: clicking a Firebase-hosted link
lands back on `?mode=verifyEmail&oobCode=...`, which `App.js` catches and
calls `auth.applyActionCode(oobCode)` on — this path works correctly, but
it's only reachable via the "Resend verification email" button (which sends
a second, different-looking email through Firebase's native template), not
the email every affiliate actually receives at signup.

**Net effect**: every affiliate who did exactly what their signup email
told them to do — click the link — landed back on "Verify your email...
please check your inbox and click the link," forever. Confirmed via
`AuthContext.js`'s own comment ("if verification happened server-side...
via Firebase Admin") assuming the Admin SDK call already happened, when it
didn't.

**Fix**: `verifyEmailToken()` now calls
`admin.auth().updateUser(firebase_uid, { emailVerified: true })` (using the
already-initialized `server/firebase-admin.js`) *before* marking our own
table verified, and only marks our table verified if that succeeds — so a
partial failure can't leave the two permanently out of sync the way the
original bug did.

If you're asked to check this again: sign up a fresh affiliate, click the
verification link in the real email (not "Resend"), and confirm the
dashboard loads without needing the resend button.

## A fully-built "lead magnet" that was entirely fabricated (found 2026-07-29)

Asked to add exit-intent email capture to the affiliate signup page. A
site-wide version already existed — `ExitIntentPopup.jsx` +
`emailCapture.js` + `server/routes/affiliate/leads.js` — commented out in
`App.js` as "TEMPORARILY DISABLED." Before reusing it, actually read it:

- The popup promised a **"£10,000 Affiliate Revenue Playbook"** with
  invented specifics — "1,247 downloads," a "4.9/5" rating, a named
  testimonial from a "Sarah M., TechCorp" who does not exist, and a link to
  a PDF (`/assets/lead-magnets/affiliate-revenue-playbook.pdf`) that was
  never created.
- The backend route's `POST /capture` called `db.query(...)` — but the `db`
  it imported (`server/db.js`) is the flat-file `readJSON`/`writeJSON`
  module used everywhere else in this codebase, which has no `query`
  method at all. This would throw on the very first real request,
  independent of the fake content — the whole feature was never actually
  run, just written and shelved.
- The `leads`/`lead_sources`/`daily_stats` Postgres tables it also expected
  don't exist in production (verified via `information_schema.tables`).

**Did not fix or resurrect this** — publishing fabricated statistics and a
fake customer testimonial would be actively dishonest, not just a bug.
Built a fresh, honest replacement instead (new `AffiliateExitIntentPopup.jsx`,
real "leave your email, we'll follow up" copy, a new working
`POST /api/affiliates/leads` following the working file's own flat-file
pattern) and left the old trio disabled. See `architecture.md` and
`routes.md`.

**Takeaway**: "there's already a component/route for this" is not the same
as "this works." Before wiring up or extending something that already
exists but is disabled/unused, actually read what it does and check its
claims (fake stats are a strong tell) and its wiring (does the module it
imports actually have the method it calls?) before trusting it.

## Campaign sales gate — three separate UI entry points, one shared source of truth (2026-07-29)

First pass only gated the composer's own "Send Campaign" buttons
(`AutomationsEditor.js` / `AutomationsComposerPage.jsx`). Follow-up request:
"gate it on the affiliate dashboard first" — the green "Mail Campaign"
button on `AffiliateDashboard.js` had no gate at all, so an affiliate could
click straight past the composer's protection before ever reaching it.
Extracted the threshold/window/messaging into `src/utils/campaignSalesGate.js`
before adding the third copy, specifically to avoid the "same bug fixed
twice, independently, in two files" pattern this codebase has hit more than
once (see the `DATA_DIR` regression story earlier in this file). See
`architecture.md` for the full breakdown of all three entry points.

## Hidden nav link ≠ protected route: member-dashboard was reachable by any affiliate (found 2026-07-29)

A logged-in affiliate reported seeing `MembersDashboard.jsx`'s "What You
Owe (by Affiliate)" panel — a cross-affiliate commission + PayPal-email
breakdown meant only for the seller/admin — and asked "has it got me
logged in as someone else?" It hadn't; something worse. `Header.js`'s
"Member Dashboard" nav link was already correctly hidden behind `isMember`
(the `currentUser?.email === 'joshmarsden28@gmail.com'` check used
throughout this codebase), but `App.js`'s actual `currentPage ===
'member-dashboard'` route only required `auth.isAuthenticated &&
auth.currentUser` — no admin check at all. Hiding the link isn't access
control; anyone logged in could reach the full seller admin panel (Store
Builder, Mail Campaign, Email Automation, Master Dashboard, Funnel
Builder, the works) just by navigating to `#member-dashboard` directly.
Confirmed live with the test affiliate account before fixing.

`member-linker` (`MemberAffiliateLinker` — lets a seller set custom
per-affiliate commission rates on tracked links) had the identical gap,
gated only by `emailVerified`. Same fix, same pattern.

**Takeaway, and worth actively re-checking**: a hidden nav link says
nothing about whether the route behind it is actually protected. Any
`currentPage === 'x'` block in `App.js` that renders seller/admin-only
content should be audited for whether its own gate condition includes the
admin email check, independent of whether the link that leads to it is
hidden elsewhere. This is exactly the same class of "nav link hidden, page
still open" gap in two different features found on the same page section
— check for siblings whenever one turns up.
