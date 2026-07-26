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

## Two campaign systems that are just dead — don't get confused by them

- `server/campaigns.js`, mounted only by the repo-root `server.js` (port
  5002) — nothing in the live site calls this port.
- `src/server.js` (legacy dev server, has its own separate `/api/email/send`
  implementation) — not what production actually runs. Production runs
  `server/index.js` on the VPS under PM2.

If you're debugging and find yourself in either of those two files, you're
almost certainly in the wrong place — go to `server/routes/email/emails.js`
instead.

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
