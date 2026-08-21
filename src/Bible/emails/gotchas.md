# Gotchas — read this before assuming something is broken (or working)

This area had an unusual amount of "code exists and looks reasonable, but
was never actually connected to anything real." Every item below was found
by testing live, not by reading code — the code alone looked fine in every
case. If something here "seems to work with no error but doesn't actually do
anything," this is almost certainly why.

## The recurring pattern: silent failure via error-swallowing

Most of the Postgres `query()` helpers in this area (in `emails.js`,
`receive-webhook.js`, `member.js`, etc. — each file has its own copy, not
shared) catch errors like this:

```js
catch (error) {
  if (error.code === '42P01' || error.message.includes('does not exist')) {
    return { rows: [] };
  }
  throw error;
}
```

This was written to gracefully handle "table doesn't exist yet" — but it
also silently swallows **column-doesn't-exist** errors (same Postgres error
message pattern), which turned a real, INSERT-breaking schema bug into "the
list is just empty," with no error anywhere. Several bugs below were only
found by testing an endpoint directly and getting `{"items":[]}` when data
should have existed, then digging into *why*.

**When debugging "this returns nothing but should have data": don't trust
the empty result. Run the underlying SQL directly via `psql` first.**

## Specific bugs found and fixed this session (all live-fixed, verified working)

1. **`getTenantId()` mapped `'fotonix-prod'`/`'default'` to the *string*
   `'default'`**, not the integer `1`. Every query using it as `tenant_id`
   (an integer column) failed with `invalid input syntax for type integer`.
   Fixed in `emails.js`; the same function is duplicated (not shared) in
   other files — if you add a new route file, check it doesn't have its own
   copy of this same bug.

2. **`business_email_id` column referenced in an INSERT but never added to
   the table** — `/api/email/send` always failed. Fixed by adding the
   column (matches a migration file, `006_normalize_business_emails.sql`,
   that existed in the repo but was apparently never actually run against
   production — a recurring theme, see below).

3. **`updated_at` column referenced in `receive-webhook.js`'s INSERT but
   doesn't exist** on `email_messages`. Removed from the query (the column
   just isn't needed there).

4. **`contacts.js` imported the wrong `query()` module** —
   `require('../../db')` (the flat-JSON-file store used for
   clicks/orders/attributions, unrelated system, no `query` export at all)
   instead of `require('../../../src/db/client')` (the real Postgres pool).
   Caused `TypeError: query is not a function` on every contacts route.

5. **Two duplicate-key crashes in `contacts.js`'s auto-sync functions** —
   `syncPBNCustomers`'s `INSERT ... ON CONFLICT DO UPDATE` tried to update
   the same target row twice in one statement when the source table
   (`user_email_verification`) had duplicate emails (Postgres error 21000:
   "ON CONFLICT DO UPDATE command cannot affect row a second time"). Fixed
   by wrapping the source `SELECT` in `DISTINCT ON (email) ... ORDER BY
   email, created_at DESC` before the INSERT, in both `syncPBNCustomers`
   and `syncConversionLeads`.

6. **Search was broken by two independent bugs stacked on top of each
   other**: (a) the query referenced `m.text_content`, but the real column
   is just `text`; (b) after fixing that, a stray extra `paramIndex++` left
   over from a previous edit created a gap in the SQL placeholder numbering
   (`$4, $5` referenced but only `$4` had a bound value), causing
   `could not determine data type of parameter`. Both had to be fixed before
   search worked at all — fixing only one still errored, just differently.

7. **Star/Archive/Delete/Mark-read were pure UI theater** — the frontend
   called `POST /api/email/messages/star`, `/archive`, `/delete`,
   `/mark-read`; **none of these routes existed on the backend at all**
   (confirmed by grepping the actual route list). None of the frontend fetch
   calls checked `response.ok` either, so a 404 was silently ignored and the
   UI updated optimistically anyway — looked like it worked, reverted on
   every refresh. Star was removed entirely (column `is_starred` also never
   existed, and it wasn't needed going forward). Archive/Delete/Mark-read
   were actually built this session (real routes now exist, see
   `routes.md`), and the frontend now checks `.ok` before updating state.

8. **The Inbox screen wasn't hooked up to the real API domain** — used
   `process.env.REACT_APP_API_BASE || "http://localhost:4000"` (env var
   that's never set anywhere), so in production it tried to talk to the
   user's own machine and got `ERR_CONNECTION_REFUSED`. Same root cause
   independently hit `src/features/links/services/linkService.js` — **check
   for `REACT_APP_API_BASE`/bare `localhost:4000` fallbacks in any new file
   before assuming `API_URL` from `src/config/environment.js` is what's
   actually being used.** That's the one correct source of truth for the
   API base URL on the frontend.

9. **Inbound mail was never bridged to the app's inbox at all** — real mail
   landed in Postfix/Dovecot's Maildir on disk just fine, but nothing
   connected that to the Postgres-backed inbox the UI reads from. A
   `receive-webhook.js` route existed with a comment saying "your mail
   server will POST to this," but Postfix was never actually configured to
   call it. Built `mail-poller.js` (see `architecture.md`) as a safe,
   read-only bridge instead of touching Postfix's live routing config.

10. **Inbound mail was being rejected server-wide** by a broken Spamhaus
    DNSBL check — `reject_rbl_client zen.spamhaus.org` in Postfix's
    `smtpd_recipient_restrictions` was rejecting mail from every sender,
    including Gmail, because the VPS's DNS resolver is flagged by Spamhaus
    as an "open resolver" (their queries return the generic
    `127.255.255.254` "blocked" signal regardless of the actual sender).
    Confirmed via `dig +short 1.0.0.127.zen.spamhaus.org` returning that
    exact sentinel. Removed the broken `zen.spamhaus.org` check from
    `/etc/postfix/main.cf`, kept `bl.spamcop.net` (confirmed still working
    correctly via its own test query). **This wasn't a code bug** — it's
    infrastructure, and it silently blocked all inbound mail (to any
    mailbox, not just new ones) for an unknown period before anyone
    noticed, since nothing alerts on this. Worth periodically re-testing
    the DNSBL query above if inbound mail seems to stop arriving again.

## Things that look like bugs but are actually just unbuilt features

- **Labels** (`/api/email/labels`) and **signatures**
  (`/api/email/signatures`) are hardcoded stub responses, not real per-tenant
  data. If someone asks "why can't I add a label," the answer is "that
  feature was never built," not "it's broken."
- **Personalization / merge tags** (`{{firstName}}` in campaign emails) —
  the rendering engine (`renderTemplate` in `src/email/renderer.js`)
  supports `{{var}}` substitution, but the campaign send screen's recipient
  list is just a plain textarea of email addresses with no name data
  attached, and the actual send call uses raw `html`/`text`, not
  `templateName`, so the merge path never runs. To actually support this:
  the recipient list needs to carry `{email, firstName}` pairs (e.g. from
  the now-working `/api/contacts` list, which does have `first_name`) and
  `/send-bulk` needs to use `templateName` + per-recipient `templateData`
  instead of raw pre-rendered `html`.
- **`business_email_id.daily_send_count`** increments but nothing resets it
  daily — `send_count_reset_at` exists but nothing writes to it. If daily
  limits actually matter, this needs a cron job (same pattern as
  `mail-poller.js`) or a check-and-reset-if-stale in the send route itself.
- **The "Email Automation" lifecycle dashboard** (abandoned cart, win-back
  etc.) is a real, clickable UI with zero effect — toggling an automation on
  writes config to Firebase but nothing ever reads/acts on it. The intended
  processor (`server/email-automation/vpsMailClient.js`) is never
  instantiated anywhere in the codebase.
- **`contacts.engagement_score` is a one-time snapshot of *product/signup*
  behavior, not real email engagement** — computed only when a contact is
  synced in from PBN/conversion-leads/Stencil Forge (`syncPBNCustomers`/
  `syncConversionLeads`/`syncStencilUsers` in `contacts.js`), based on things
  like "did they complete a PBN order" or "what's their lead score" — it has
  nothing to do with whether they've ever opened or clicked an actual email.
  It's what backs the `vip`/`high_engagement`/`low_engagement` segment
  filters in Contact Management and the Mail Builder's audience segments
  today. **Revisit this once real per-recipient open/click tracking on
  campaign sends (`email_messages.opened_at`/`clicked_at`, see the
  "Open/click tracking" section in `architecture.md`, added 2026-07-28) is
  actually being used to sort people through email funnels** — at that
  point "engagement" for a contact could/should be driven by real email
  interaction (has this person ever opened a campaign, clicked a link,
  gone cold after N sends) rather than a frozen snapshot from whatever
  funnel they originally signed up through. Also note `GET /contacts/mine`
  (unlike `GET /contacts`) doesn't re-run the sync, so scores on
  already-synced rows won't update at all under the per-member view fixed
  2026-07-28 — worth deciding whether that matters once this is revisited.

## Two campaign systems that are just dead — don't get confused by them

- `server/campaigns.js`, mounted only by the repo-root `server.js` (port
  5002) — nothing in the live site calls this port.
- `src/server.js` (legacy dev server, has its own separate `/api/email/send`
  implementation) — not what production actually runs. Production runs
  `server/index.js` on the VPS under PM2.

If you're debugging and find yourself in either of those two files, you're
almost certainly in the wrong place — go to `server/routes/email/emails.js`
instead.

## A third, real (not dead) email-campaign builder exists: `AutomationsEditor.js` — and it had the same block type defined in 7 places, correctly, in only some of them (fixed 2026-08-18)

Not the same system as `AdvancedInboxScreen.js`'s compose modal or the
`MailBuilder`/`ActualEditor.js` template editor covered elsewhere in this
file — a third one, `src/components/automationscomposer/AutomationsEditor.js`
(~3200 lines), reachable at the `/automationscomposer` route, gated by
`campaignSalesGate.js` (see `../affiliates/gotchas.md`'s "Send Campaign"
sales-gate story for that part). It sends real campaigns — worth knowing it
exists at all before assuming the other two are the only places email gets
composed.

Its block system (`text`, `image`, `button`, `divider`, `spacer`, `product`,
`social-follow`, plus `video` and `youtube-subscribe`) is defined once
(`defaultBlock()`) but then **switched on again separately in six more
places** with no shared rendering function: the live editing canvas
(`EmailBlock`'s `renderBlockContent`), the inspector panel
(`InspectorEmail`), the read-only preview (`renderBlockPreviewEmail`, also
reused for blocks nested inside `columns`), and three near-identical
HTML-serializers (`exportHTML`'s download button, `sendCampaign`'s actual
send path, `renderBlockHtml` for nested columns). Adding a block type
correctly to `defaultBlock()` and one preview function is not the same as
adding it everywhere it's used — that's exactly what had happened to `video`
and `youtube-subscribe` before this session:

- **Neither had a button in the "Available Blocks" palette at all.** Both
  were fully built (data shape, preview, inspector) but literally
  unreachable through the UI — the only way to invoke `addBlock('video')`
  was to call it programmatically. Added both palette buttons.
- **Both were missing from all three HTML-export switches**, silently
  producing an empty string (`default: return ''`). A video or subscribe
  block added to a campaign would render fine in-editor and then **vanish
  from the actual sent email** with no error anywhere. This is why "the
  video block doesn't work in real emails" would have looked like a
  provider/rendering problem rather than "it was never implemented" — the
  in-editor preview genuinely does show an embedded `<iframe>`
  (`VideoBlockPreview`), which was never going to survive export anyway
  since Gmail/Outlook/most mail clients strip iframes from email entirely.
  Added `videoBlockToHtml()`/`youtubeSubscribeBlockToHtml()` — shared by all
  three export sites — which always render the only pattern that actually
  works in a real inbox: a clickable YouTube-thumbnail image (play-button
  overlay via `position:absolute`, degrades safely to a plain clickable
  thumbnail in Outlook, which ignores that CSS) linking straight to the
  video, plus a guaranteed-visible text link underneath regardless of
  whether the graphical overlay renders anywhere.
- **`VideoInspector` was fully written and exported but never actually
  referenced anywhere** (`grep -c "<VideoInspector"` was 0) — the inspector
  switch had no `case 'video'` at all, so selecting a video block showed
  "No inspector available," meaning there was no way to fix a wrong URL or
  set a title after the initial add. Wired it in.
- **`EmailBlock`'s own switch (the one that actually renders the live
  editing canvas) had no `case` for either type**, falling to `default:
  return <div>Unknown block type: {block.type}</div>` — visibly broken in
  the editor itself, not just at send time. Fixed by reusing
  `renderBlockPreviewEmail(block)` (the same function `columns` already
  calls for its nested blocks) rather than writing a fourth copy of the
  same JSX.
- **A genuine duplicate `case 'youtube-subscribe':` inside the same switch**
  in `renderBlockPreviewEmail` — one returned a raw HTML template-literal
  *string* (clearly written for one of the export functions, but pasted
  into the wrong one), the other returned real JSX. Since the string version
  came first, it silently shadowed the correct JSX version — the canvas
  would have shown literal `<div style="...">` text instead of a real
  subscribe button had this case ever been reachable (it wasn't, until the
  palette button above was added). Deleted the misplaced string version —
  its logic is what became `youtubeSubscribeBlockToHtml()`.

**If a new block type is ever added to this file**, it needs a case in all
seven of the places listed above, not just `defaultBlock()` — that's the
actual lesson here, not just "these two were broken."

**Confirmed the same day on a pre-existing block type, not just the new
ones**: the `button` block's Style (Solid/Outline) dropdown updated
`block.meta.style` correctly (the shared `updateBlock()` merge into `meta`
was never the problem), but `EmailBlock`'s canvas-rendering case for
`'button'` had the button's colors **hardcoded** (`backgroundColor:
'#3b82f6'`, `border: 'none'`) instead of reading `meta.style`/
`meta.background`/`meta.color` — so picking Outline in the inspector never
visibly changed anything on the live canvas, while `renderBlockPreviewEmail`'s
own `'button'` case (used by Preview and nested `columns` blocks) already
read those fields correctly. Fixed to read them, verified live: canvas
button background went `rgb(59,130,246)` solid → transparent with a
matching border the instant Outline was selected. Worth checking the other
block types' `EmailBlock` cases against their `InspectorEmail` counterparts
if a similar "I changed a setting and nothing happened" report comes in —
this file's structural problem (block logic scattered across switches with
no shared source of truth) isn't unique to video/youtube-subscribe, it's
just where it happened to be found first.

## There is no "per-affiliate mailing list" — investigated 2026-07-26, one shared list exists

Asked to wire up "add this email to the affiliate's mailing list" from the
Funnel Builder, the honest finding first: **there is no concept anywhere in
this codebase of each affiliate having their own separate contact list.**
There is exactly one — `contacts`, scoped to `tenant_id = 1` (the whole
site, see `database.md`'s single-tenant note) — used for the site's own
campaign/newsletter sends.

The table *does* have a `member_uid` column (confirmed live via `\d
contacts`) that looks like it was meant to support per-member/per-affiliate
attribution — but `POST /api/contacts`, the one route that requires an
`x-member-uid` header at all, never actually wrote that header's value into
the row. Same for the `source` column. Both existed, both were always
`NULL` in practice. Grepped `contacts.js` for `member_uid` before this date:
zero matches, despite the header being required for auth.

**What this means for "affiliate mailing list" requests going forward**:
there's no ready-made per-affiliate segment to plug into. What was actually
built (2026-07-26, see `routes.md`'s `POST /` entry): the two dormant
columns are now genuinely populated — a funnel's "Join mailing list"
button/Email Capture block sends the *funnel owner's* uid as
`x-member-uid` on a public visitor's behalf, so signups from a given
affiliate's funnel are now attributable to them (`member_uid` = that
affiliate's uid, `source = 'funnel_signup'`). That's real attribution data,
not a fake feature — but it lands everyone in the **same shared list**,
just taggable per contact. If genuinely separate, affiliate-owned lists are
wanted later (e.g. so an affiliate can only ever see/export *their* leads,
not everyone's), that's new work: either a `GET /api/contacts?member_uid=`
filter (route doesn't currently support this — `GET /` has no such param,
see `routes.md`) plus a real permission boundary, or a genuinely separate
table/system. Don't assume the `member_uid` column alone gives affiliates
any kind of list boundary today — nothing currently enforces or exposes
one.

### The exact save path, step by step

Useful to have written down plainly, since "where does this actually land"
is the first question anyone building on top of this will ask:

1. Visitor is on a published funnel page, `fotonix.co.uk/funnel/:companySlug/:funnelSlug`
   (`src/components/marketing/funnelBuilder/FunnelViewer.js`). The page
   already has the funnel record in memory, including `funnel.user_id` —
   the affiliate who owns this funnel.
2. Visitor fills in the email field of a `button` block in `'subscribe'`
   mode, or an `emailCapture` block — both render
   `SubscribeInlineForm` (`FunnelBuilder.js`), which receives
   `funnelOwnerUid={funnel.user_id}` as a prop from the viewer.
3. On submit: `fetch(`${API_URL}/api/contacts`, { method: 'POST', headers:
   { 'x-member-uid': funnelOwnerUid }, body: JSON.stringify({ email,
   source: 'funnel_signup' }) })` — a plain, unauthenticated browser
   `fetch`, no Firebase/session token attached at all.
4. Hits `server/routes/email/contacts.js`'s `POST /` (mounted at
   `/api/contacts` in `server/index.js`), which reads `x-member-uid`
   straight off the request header — **whatever value the client sent,
   with no verification that the request actually came from that user, or
   from the funnel page at all** (see "the security gap" below).
5. `INSERT INTO contacts (tenant_id, member_uid, email, first_name,
   last_name, is_vip, source, engagement_score) VALUES (1, <that header
   value>, email, '', '', false, 'funnel_signup', 0.5)`.
6. Lands in the `fotonix_dev` Postgres database on the VPS
   (`178.104.153.63`), `contacts` table, `tenant_id = 1` always (see
   `database.md` — this is a single-tenant deployment, there's no
   multi-tenant partitioning at the database level either).
7. Nothing reads it back out scoped to that affiliate — `GET /api/contacts`
   (the only read path) returns the *entire* tenant's contact list to
   whoever calls it, regardless of what `x-member-uid` they send. There is
   currently no code path anywhere that filters contacts down to "just
   this member's."

### The security gap this depends on — worth fixing before any permission model

Step 4 above is the real problem, and it's bigger than just this one
route: `x-member-uid` is a **client-supplied, unverified header** —
literally any value the caller decides to send. This isn't unique to
contacts — `server/routes/member/member.js`, `server/routes/marketing/funnels.js`,
and every other "member" route in this codebase trusts the same header the
same way (see each file's own `getUserId()`/equivalent). Today, anyone who
knows (or guesses) another affiliate's Firebase uid can already call
`GET /api/contacts` with that uid in the header and get back... the same
full tenant list everyone else gets, since the route doesn't even filter by
it — but the moment a `?member_uid=` filter or a "my funnels only" check
gets added anywhere, it would be trivially bypassable by just changing the
header, unless real verification is added first. **Any permission system
built on top of `x-member-uid` as it exists today would be security
theater** — it would look like access control without actually being any.

### A real per-affiliate filtered view was added anyway (2026-07-26) — deliberately, not by accident

The auth-hardening work above was explicitly deferred (user's call), but a
genuinely filtered "my contacts" view was still wanted so affiliates could
be told "this is your list" truthfully. Added `GET /api/contacts/mine` —
same `x-member-uid` trust model as every other route here (not hardened),
but it does now actually filter `WHERE member_uid = $1`, unlike the plain
`GET /` which returns everyone's regardless of the header. Verified live:
two different `x-member-uid` values each only see their own row, not each
other's (see `../store-builder/architecture.md`-style verification —
create as A, create as B, confirm `/mine` under A never returns B's row).

**This does not close the gap above.** It's an *additive* filtered view on
top of the same unverified header — someone who already knows or guesses
another affiliate's Firebase uid could still pass it as `x-member-uid` and
pull up *their* mailing list through this same endpoint. What changed is
that the app now has a real "my list" concept to show an affiliate, not
that the underlying identity check became trustworthy. If real
security/API-key-swapping between affiliates is ever a concrete worry (not
just theoretical), the auth-hardening work is still the actual fix — this
addition doesn't substitute for it, it just delivers the visible feature on
the same foundation everything else in this codebase already stands on.

Frontend: `src/components/affiliate/AffiliateMailingList.js` (new), a
simple table + CSV export, reachable from the affiliate dashboard's "Your
Mailing List" button. Fetches `/api/contacts/mine` with the logged-in
Firebase uid as `x-member-uid` — note this is the **Firebase uid**, not the
affiliate's referral *code* (`TESTAFF72`-style) used elsewhere on that same
dashboard for stats — see `../funnel-builder/architecture.md`'s "Company
slugs" section for the same code-vs-uid distinction playing out elsewhere
in this codebase.

## The inbox showed every account's email to every account (fixed 2026-07-27)

Found by the user directly: logged in as a non-admin account, the Advanced
Inbox showed the same messages as the admin's own inbox. Root cause was pure
dead code, not a spoofing/guessing attack — worse, actually, since it needed
no attacker at all:

`AdvancedInboxScreen.js`'s `fetchMessages` read
`localStorage.getItem('memberUID')` to scope the request, but **nothing
anywhere in `src/` ever calls `localStorage.setItem('memberUID', ...)`** —
grepped the whole tree, zero matches. So `memberUid` was always `null` for
every user, the `if (memberUid)` branch never fired, and the query param was
never sent at all.

On the backend, `GET /messages` (`server/routes/email/emails.js`) only
applied its member-scoping `WHERE` clause when `memberUid && memberBusinessEmails.length > 0`
— since the param never arrived, this was always false, and the query fell
through to `WHERE m.tenant_id = $1` only. Since this is a single-tenant
platform (`tenant_id` always `1`), that clause doesn't isolate anyone —
every account's inbox returned literally every message on the entire
platform, always.

Fixed in two parts:
1. **Frontend**: use the real Firebase uid (`getAuth().currentUser?.uid`,
   already fetched correctly elsewhere in the same file for the "From"
   dropdown) instead of the dead localStorage key, in both `fetchMessages`
   and the message-detail fetch (`GET /messages/:messageId` had **no** member
   scoping at all before this — a second, separate IDOR, since message IDs
   are plain sequential integers with no auth check beyond `tenant_id`).
2. **Backend**: made the scoping **fail-closed** — `if (memberUid)` alone now
   applies the `WHERE` clause (matching zero rows if this member genuinely
   has no `business_emails` yet), instead of `if (memberUid && ...length > 0)`
   silently skipping the filter and falling back to "show everything."
   Applied to both `GET /messages` and the newly-scoped `GET /messages/:messageId`.

Verified live: a fabricated `memberUid` now returns `{"items":[]}` / 404 on
detail, instead of the full tenant's mail.

## Compose "From" address silently coming up empty (fixed 2026-07-27/28)

Two unrelated bugs, both making the compose modal's From field end up empty
(Send disabled, "Missing: From") even when the member has a real business
email:

1. **Race condition on fresh loads.** The business-emails-loading `useEffect`
   read `getAuth().currentUser` synchronously, once, in a `useEffect(..., [])`
   — but Firebase's session restore is async, so on a fresh page load
   `currentUser` can still be `null` at that exact instant. The fetch would
   then silently skip ("no authenticated user"), with **no retry** since the
   effect never re-runs. Fixed by subscribing to `onAuthStateChanged` instead,
   so it fires as soon as auth state actually resolves.
2. **`startCompose()` and the post-send reset both replaced `composeData`
   with a brand-new object instead of spreading previous state, and neither
   included a `from`/`fromEmailId` key at all.** This silently wiped
   whatever the loader effect had auto-selected, every single time "New
   Message" was clicked or right after a successful send. Confusingly, the
   `<select>` still *looked* like it had the right address selected — a
   `<select>` whose `value` matches no `<option>` just falls back to
   displaying its first option, which happened to be the one real address.
   The visual was a lie; `composeData.from` was genuinely empty underneath.
   Fixed by defaulting both fields to the first loaded business email in
   both reset call sites. `startReply` and the popup's reply/forward
   handlers already used the `prev => ({...prev, ...})` spread form, so they
   were unaffected.

## `GET /api/member/business-emails/:memberUid` handed out Fotonix's own real addresses to anyone (fixed 2026-07-27)

Found while investigating the above: this route (`server/routes/member/member.js`)
fell back to a hardcoded list of the platform's real mailboxes
(`noreply@`/`orders@`/`support@fotonix.co.uk`) whenever the requested member
had zero `business_emails` rows of their own (or the query errored) — meaning
**any** logged-in account with no addresses of its own got offered the
platform's own official identities as legitimate "From" options, able to
send campaign mail that looked like it came from Fotonix itself. The admin
account already has real rows for all 4 real mailboxes tied to its own
`member_uid` (confirmed via `\d`/direct query), so this fallback was never
actually needed for legitimate use — it only ever fired for everyone else.
Removed the fallback (both the empty-result branch and the on-error catch
branch); now returns `[]`, and the frontend already had a proper "No
business emails available" empty state for exactly this case.

## Affiliates never got a real email address at signup (built 2026-07-27)

`AffiliateSignupPage.js` never called the `create-standard` business-email
flow that member signup uses — affiliates got zero `business_emails` rows,
ever. Even for members who do get addresses via `create-standard`, those are
**database rows only** — nothing provisions a real mailbox on the VPS's
Postfix/Dovecot, so an address like `mystore@fotonix.co.uk` can send (rides
the shared `noreply@` SMTP identity) but any real inbound mail to it bounces,
since only 5 mailboxes physically exist (see `architecture.md`).

Added `POST /api/member/business-email/create-affiliate` (`member.js`):
gives each affiliate one address, `support+<affiliateCode>@fotonix.co.uk` —
confirmed live (via `postconf`/`doveconf`, not just reading the on-disk
config) that both Postfix and Dovecot already have `recipient_delimiter = +`,
so this rides the real, already-working `support@` mailbox with **zero new
VPS provisioning**. Inbound mail to the `+tag` address lands in `support@`'s
real Maildir and gets attributed back correctly by `mail-poller.js`/
`receive-webhook.js`, which already match by the literal `to` address
string — no changes needed there. Wired into `AffiliateSignupPage.js` right
after the referral code is generated. Idempotent (a retried signup returns
the existing row instead of hitting the `UNIQUE(email_address)` constraint).

One real limitation: it's not an independent mailbox account (no separate
login/password) — an affiliate can send and receive through Fotonix's own
inbox screen, but can't configure the address into an external mail client
like Outlook. Confirmed acceptable for this use case (send/receive within
the platform, not standalone use).

## The "Track opens" checkbox in the small inbox compose modal was pure UI theater (removed 2026-07-28)

`tracking_enabled` was sent in the `/send` request body but never once read
anywhere in `emails.js` — checking or unchecking it changed nothing.
Deliberately **not** fixed by wiring it up: per-open tracking isn't worth the
infrastructure (or the mild invasiveness) for a compose box used for
one-to-one correspondence with one or two people, versus bulk campaign sends
where engagement rate is an actually useful signal. Removed the checkbox,
its `composeData.trackingEnabled` state, and the payload key entirely rather
than build tracking a small personal-inbox compose box doesn't need.

## The Advanced Inbox screen and its compose modal weren't usable on mobile at all (fixed 2026-08-15/16)

Never tested below desktop width before. Three separate, stacked layout
bugs, found by actually loading the screen in a real mobile viewport
(375×667) rather than reading the JSX:

1. **Compose modal**: the footer row (priority/signature selects + "Missing:
   ..." warning + Cancel/Send buttons) was a non-wrapping `flex
   items-center justify-between`. On a narrow screen that row is wider than
   the modal, so Send got pushed past the right edge and clipped by the
   modal's own `overflow-hidden` — invisible, not just hard to reach. Fixed
   with `flex-wrap` on both the outer footer and the inner button group.
2. **Main 3-pane layout** (`Folders` sidebar `w-64` + message list `w-96`,
   both fixed pixel widths, side by side): those two columns alone total
   640px, guaranteed horizontal overflow under any viewport narrower than
   that. Sidebar is now a slide-over drawer below `md` (opened via a
   hamburger button, `mobileFoldersOpen` state), and the list/detail panes
   now show one at a time below `md` (`activeItem ? 'hidden md:flex' :
   'flex'` and the inverse), with a "Back to inbox" button in the detail
   header to return. Both stay exactly as before at `md`+ — verified
   side-by-side rendering unchanged at 1280px.
3. **Message detail header**: subject/from/to text plus 6 action buttons
   (Reply/Reply All/Forward/Archive/Delete/More) in one non-wrapping
   `justify-between` row — the 6 buttons alone (~360px) already didn't fit
   under ~640px regardless of the sibling text. Now `flex-col` below `sm`
   (stacks instead of squeezing), buttons wrapped.

Verified with a real headless-Chromium pass at 375×667 (`document.scrollWidth
=== document.clientWidth`, i.e. zero horizontal overflow, both closed and
with a message open) and re-confirmed desktop at 1280px is pixel-identical
to before.

Also removed the blocking `alert('Message sent successfully! ✅')` after a
successful send in the same compose modal (`AdvancedInboxScreen.js`) — the
modal already closes and the inbox refreshes as visible confirmation; the
extra native browser dialog was a leftover from early testing, not asked
for since.

## Short, guessable Message-ID; no unsubscribe mechanism at all (fixed 2026-08-17)

An external mail deliverability tester flagged both. `/send` and
`/send-bulk` were both setting `Message-ID: <${messageId}@fotonix.co.uk>`
where `messageId` is just the sequential `email_messages.id` — reads as
auto-generated/spammy to mail testers, and every message's ID is trivially
guessable (increment-and-fetch). Fixed to `crypto.randomUUID()` in both
routes — RFC 5322 only requires global uniqueness, a UUID is enough.

No `List-Unsubscribe` header existed anywhere, and no one-click unsubscribe
endpoint existed either — required for Gmail/Yahoo bulk-sender
qualification at the volumes campaign sends run at. Built for `/send-bulk`
only (same scoping as tracking, above): per-recipient HMAC token, `List-
Unsubscribe`/`List-Unsubscribe-Post` headers, a visible unsubscribe link
injected into the HTML footer, and `POST`/`GET /api/email/unsubscribe`
routes. Removing this **actually stuck** required also fixing the three
`contacts.js` auto-sync functions (see that file's `GET /` entry in
`routes.md`) and a real bug in `contacts.js`'s own, separate `POST
/unsubscribe` route — both documented there in full; the short version is
neither one respected `email_suppressions` before this pass, so an
unsubscribe could get silently undone by an unrelated page load. Full
mechanism: `architecture.md`'s "One-click unsubscribe" section.

**Still needs a real `UNSUB_SECRET` set in the VPS's `.env`** before this
means anything security-wise — ships with a hardcoded dev fallback
otherwise (see `architecture.md`).

## Campaign sends (`/send-bulk`) had the same dead tracking checkboxes — this time actually built (2026-07-28)

`CampaignSendPage.js`'s "Track Opens"/"Track Clicks" toggles (`config.trackOpens`/
`config.trackClicks`, both default `true`) were never included in the actual
`/send-bulk` request body at all — same "checkbox exists, does nothing"
pattern as the inbox one above. Unlike the inbox case, this one was worth
actually building, since campaign engagement rate across many recipients is
a real signal. See `architecture.md`'s "Real open/click tracking" section
for how it works — the short version: a per-recipient tracking pixel + link
rewrite injected only into what's actually mailed (not the stored `html`
column), landing on two new routes (`GET /open/:messageId`, `GET /click/:messageId`)
that update the already-existing (previously always-null) `email_messages.opened_at`/
`clicked_at` columns. `GET /stats` gained an optional `?campaignId=` filter
so a specific send's real numbers can be checked regardless of when it went
out — surfaced in `CampaignSendPage.js`'s post-send panel with a manual
refresh button (opens/clicks only happen after someone actually reads the
mail, so there's nothing to show immediately after sending).

**Don't confuse this with `routes/email/tracking.js`** (mounted at
`/api/email/track/*`) — that one is real too, but wired to the *dead* "Email
Automation" lifecycle feature's Firebase-backed tracking IDs
(`emailTracking/{trackingId}` in Realtime DB), not real Postgres
`email_messages` rows. The new campaign tracking added here is a separate,
independent mechanism living directly in `emails.js`.
