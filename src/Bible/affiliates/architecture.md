# Affiliate Architecture

## Track-only, no fund custody

This system tracks clicks and calculates commissions owed — it does not move
money. PayPal payments go straight to the seller as normal; affiliates get
paid manually/externally based on what this system says they're owed. Keep
that framing when extending it — there's no payout/disbursement flow here,
only "how much does affiliate X earn from what's sold."

## Three separate data stores — genuinely three, not a simplification

This is the single most important thing to understand before touching this
code. Different parts of the affiliate system store data in three unrelated
places:

1. **Flat JSON files** on the VPS filesystem (`server/data/*.json`, read via
   `server/db.js`) — clicks, orders, commission attributions. This is the
   **real, working, verified-with-live-money** pipeline. See `database.md`.
2. **Firebase Realtime DB** (`affiliates/{uid}`, `users/{uid}`) — affiliate
   *account* data: who's signed up, their code, approval status. Used by the
   self-signup flow and by the frontend to know "is this logged-in user an
   affiliate and what's their code."
3. **Postgres** (`affiliates` table referenced by `member.js`) — a
   **member's own sub-affiliate network** feature (a seller creating and
   tracking their *own* affiliates, one level up from Fotonix's own
   program). This table doesn't currently exist in production (confirmed via
   `\d affiliates` returning nothing) — the related create/edit UI was
   removed this session; see `gotchas.md`. Don't confuse this with #1's
   flat-file attribution data, which is the real, live commission pipeline.

If you're asked to "check the affiliate data" and only look in one of these
three, you may be looking at the wrong one for what's being asked about.

## The click → purchase → commission pipeline (the real, working one)

1. **Referral link visited**: `fotonix.co.uk/?ref=CODE`. On every page load,
   `src/hooks/useAffiliateRef.js` runs once, reads `?ref=`, and:
   - writes it to `localStorage` (`fotonix_aff_ref`) immediately — no
     network call needed, can't be blocked by anything
   - fires a background beacon `POST ${API_URL}/api/clicks/create` with
     `{ affiliateId: ref }`, `credentials: 'include'`

2. **Click recorded**: `server/routes/affiliate/clicks.js`'s
   `POST /api/clicks/create` creates a click record in `clicks.json` (via
   `db.createClick`, which snapshots the *effective commission rate* at
   click time — program default, or product-specific, or a custom rate if
   the click came through a per-link tracked URL — see `database.md`), and
   sets a signed httpOnly cookie `aff_click` = the click ID (30-day expiry).

3. **Checkout**: `src/components/payments/PayPalButton.js`'s `createOrder`
   sends `credentials: 'include'` (so the `aff_click` cookie rides along
   cross-subdomain from `fotonix.co.uk` to `api.fotonix.co.uk`) **and** reads
   `fotonix_aff_ref` from `localStorage`, sending it explicitly as `ref` in
   the request body — a deliberate belt-and-suspenders fallback (see below,
   "why the localStorage fallback exists").

4. **Order creation attaches the click**: `server/routes/payments/create-order.js`
   reads `req.signedCookies.aff_click` for the click ID. **If that's missing**
   (cookie didn't arrive — ad blocker, ITP, whatever) but `ref` was sent in
   the body, it creates the click record right there instead (same
   `db.createClick`, just later) — so a purchase is never lost just because
   the early tracking beacon failed. Either way, the resulting click ID gets
   set as the PayPal order's `custom_id`.

5. **Payment happens** — normal PayPal checkout, nothing affiliate-specific.

6. **Webhook confirms it**: PayPal calls `server/routes/webhooks/webhook.js`
   on `PAYMENT.CAPTURE.COMPLETED`. After verifying the webhook signature
   (see `gotchas.md` — this took real debugging to get right), it reads
   `custom_id` off the capture, looks up the click
   (`db.getClick(clickId)`), and if found, creates an **attribution**
   (`db.createAttribution`) — `commissionCents = round(amountCents * ratePct / 100)`,
   `status: 'pending'`. Idempotent — a PayPal transmission/event ID is
   tracked (`db.markProcessedId`/`hasProcessedId`) so a redelivered webhook
   doesn't double-attribute.

### Why the localStorage fallback exists (don't remove it)

The early click-tracking beacon (step 2) is a background `fetch()` at page
load — exactly the shape ad blockers and Safari ITP are designed to kill,
silently, with no error surfaced anywhere. Relying on it alone means a
purchase can arrive with a valid PayPal order but no attributable click,
with zero visibility into why. The `localStorage` + explicit `ref` in the
checkout body means the click gets recorded **even if the early beacon was
blocked** — worst case it's recorded a few minutes later than the real
click happened (cosmetic timestamp difference only), not lost.

## Self-signup (Firebase RTDB, not the flat files)

`src/components/affiliate/AffiliateSignupPage.js`: on signup, generates a
short, **speakable** code from the email's local-part + a random 2-digit
suffix (e.g. `josh@gmail.com` → `JOSH42`), checks it's unique by querying
Firebase RTDB (`affiliates` node, `orderByChild('code')`), retries up to 25
times on collision. Writes:
- `affiliates/{uid}`: `{ email, joinedAt, approved: false, code }`
- `users/{uid}`: `{ affiliateCode, affiliateApproved: false, updatedAt }`

The frontend reads `auth.userProfile?.affiliateCode` (from `users/{uid}`)
throughout to determine "is this user an affiliate and what's their code" —
this is what gates access to the affiliate dashboard pages in `App.js`.

Note: `approved`/`affiliateApproved` being `false` by default does **not**
currently block dashboard access anywhere in the frontend — it's tracked but
unenforced. If you're asked to add an approval gate, this is the field to
check against.

### Email address at signup (added 2026-07-27)

Affiliate signup didn't create any email address for the new affiliate at
all before this — `POST /api/member/business-email/create-standard` (the
flow member signup uses) was never called from `AffiliateSignupPage.js`.
Added a lighter sibling, `POST /api/member/business-email/create-affiliate`
(`server/routes/member/member.js`), called right after the referral code is
generated: one `business_emails` row, address
`support+<affiliateCode>@fotonix.co.uk`. Deliberately **not** a
`storeName@fotonix.co.uk`-style address like `create-standard` produces —
those are database rows only with no matching real Postfix/Dovecot mailbox,
so they can send (rides the shared `noreply@` SMTP identity) but can't
receive (real inbound mail bounces, "user unknown"). The `support+` scheme
instead rides the one real, already-working `support@` mailbox via Postfix
and Dovecot's `recipient_delimiter = +` (confirmed set on both, via
`postconf`/`doveconf`, not just the on-disk config — see `../emails/architecture.md`'s
"How a mailbox is actually defined" section) — inbound mail to the `+tag`
address lands in `support@`'s real Maildir and gets attributed back
correctly by `mail-poller.js` (which matches by the literal `to` address
string, unaffected by which physical mailbox it landed in). Zero new VPS
provisioning per affiliate, real send **and** receive, at the cost of not
being a standalone mailbox account (no separate login/password — usable
through Fotonix's own inbox UI only, not an external mail client).

## Commission rate resolution order

Set once, at click-creation time, and snapshotted onto the click record (so
a later rate change doesn't retroactively change historical commissions):

1. A link-specific custom rate (`linkCustomRatePct`, set when a member
   creates a tracked link for a specific affiliate+product via
   `MemberAffiliateLinker.jsx` → `POST /api/member/links`), if present.
2. Otherwise, a product-specific `commissionRate` (from `products.json`), if
   the click was tied to a specific product.
3. Otherwise, the program-wide default (`affiliateSettings.json`'s
   `programDefaultCommissionPct`, editable via `AdminAffiliateSettings.js` →
   `POST /api/affiliates/settings`).

## Campaign-sending sales gate (added 2026-07-29)

Deliberate anti-abuse measure: an affiliate needs `CAMPAIGN_SALES_REQUIRED`
(3) real sales (`status !== 'void'`) in the trailing
`CAMPAIGN_SALES_WINDOW_DAYS` (30) days to send email campaigns, and has to
keep clearing that bar every month to keep the ability — implemented as one
continuously-re-evaluated rolling window, not separate lifetime + calendar-
month tracking. Lives entirely in the frontend:
`src/components/automationscomposer/AutomationsEditor.js`'s `ComposerPage`
fetches `GET /api/affiliates/attributions?code=<their code>` (the same
per-affiliate-scoped route `AffiliateMasterDashboard` uses), filters to the
window, and reports the result upward via a new `onSendGateChange` prop so
`AutomationsComposerPage.jsx`'s own separate "Send Campaign" button (a
second control that calls the editor via `sendCampaignRef`, not the same
button) greys out in sync.

**This is frontend-only** — `/api/affiliates/attributions` and `/send-bulk`
themselves have no server-side enforcement of this rule. A technically
determined affiliate could still call `/send-bulk` directly. Fine for now,
but worth knowing if this is ever reported bypassed.

The platform admin (`joshmarsden28@gmail.com`) and any account with no
`affiliateCode` on its `users/{uid}` profile (i.e. a regular member/seller,
not an affiliate) are exempt entirely — the gate only applies to affiliates.

Buttons are deliberately never given the `disabled` attribute — a real
`disabled` button doesn't fire `onClick` in the browser, which would kill
the explanatory alert the whole feature depends on. They're greyed via
`className` only and stay clickable.
