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
