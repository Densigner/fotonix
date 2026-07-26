# Affiliate Routes

Two backend "audiences" here with separate route files — easy to grab the
wrong one:

- **`server/routes/affiliate/affiliates.js`** (mounted at `/api/affiliates`)
  — the **affiliate's own** view of their clicks/commissions.
- **`server/routes/member/member.js`** (mounted at `/api/member`) — the
  **seller/member's** view of what they owe their affiliates, plus their
  own tracked-link creation tools. Different data source for stats (see
  below), different table naming even though the concepts overlap.

Both use flat-file storage via `server/db.js` / direct `readJSON`/`writeJSON`
against `server/data/*.json` for anything to do with clicks/attributions
(**not** Postgres) — see `database.md`.

---

## `server/routes/affiliate/affiliates.js` — `/api/affiliates`

### `GET /stats?code=<affiliateCode>`
**Requires `code` as a query param — 400s without it.** Auth: in production,
also requires header `x-affiliate-code` matching `code` exactly
(`simpleAuth`, bypassed entirely when `NODE_ENV === 'development'` — and
recall `NODE_ENV` is unset in production, so double-check which branch
actually applies before assuming this check is active).

Returns clicks count, conversions, pending/approved commission totals, and a
daily timeseries (clicks + conversions + revenue + **commissionCents** per
day) — all computed by filtering `clicks.json`/`attributions.json`/
`orders.json` in memory for `affiliateId === code`. `commissionCents` per
day was added 2026-07-25 (summed from each attribution's real, snapshotted
commission) so `AffiliateDashboard.js`'s "Commission by Day" chart no longer
has to guess a flat 10% rate — see `gotchas.md`. **Known gap**:
`AffiliateMasterDashboard.jsx` calls
this without a `code` param at all, so it currently 400s for that component
— see `gotchas.md`.

### `GET /attributions?code=<affiliateCode>`
Same auth as above. Returns every attribution for that affiliate, most
detail already flattened for display (order id, date, amount, commission,
status).

### `GET /settings`
No auth. Returns `{ programDefaultCommissionPct }` from
`affiliateSettings.json` (defaults to `10` if the file's missing/empty).

### `POST /settings`
Body: `{ programDefaultCommissionPct }`. Overwrites the program default.
Used by `src/components/admin/AdminAffiliateSettings.js` — this changes the
rate for **future** clicks only, doesn't touch already-created click records
(rate is snapshotted at click time, see `architecture.md`).

---

## `server/routes/affiliate/clicks.js` — mounted at root (no prefix)

### `POST /api/clicks/create`
Body: `{ affiliateId, productId?, linkCustomRatePct? }`. Creates a click
record (`db.createClick`), sets the signed `aff_click` cookie. This is the
one endpoint that must be reachable from `fotonix.co.uk` (the static
frontend) calling `api.fotonix.co.uk` — always use the full `API_URL`, a
relative path here silently hits the frontend's own SPA fallback instead
(this exact bug is why clicks never recorded for months — see
`gotchas.md`).

---

## `server/routes/affiliate/leads.js` — mounted at `/api/leads`

Separate feature (lead-magnet capture / gated downloads), not part of the
core click-tracking pipeline. `POST /capture`, `POST /download-link`,
`GET /stats`. Not covered in depth here — if you're working on referral
clicks/commissions, you don't need this file.

---

## `server/routes/payments/create-order.js` / `capture-order.js`

Not affiliate-specific files, but where the click ID actually gets attached
to a real purchase:

- `create-order.js`: reads `aff_click` cookie, falls back to `body.ref`
  (backfilling a click record if needed — see `architecture.md`), sets the
  resolved click ID as the PayPal order's `custom_id`.
- `capture-order.js`: unrelated to attribution — this is where the
  buyer/owner confirmation emails get sent (see `../emails/` for that).

## `server/routes/webhooks/webhook.js` — `/api/paypal/webhook`

PayPal calls this directly (raw body, signature-verified before parsing —
see `gotchas.md` for the Bearer-vs-Basic-auth history). On
`PAYMENT.CAPTURE.COMPLETED`, reads `custom_id`, looks up the click, creates
the attribution. On refund/void events, voids any attribution tied to that
order (`db.voidAttributionsForOrder`).

---

## `server/routes/member/member.js` — `/api/member` (the seller's side)

### `GET /stats`
**Different endpoint from `/api/affiliates/stats` above** — this is "what
does this member (seller) owe across all their affiliates," not one
affiliate's own numbers. Queries a Postgres `affiliates` table
(`SELECT affiliate_code FROM affiliates WHERE member_uid = $1`) to find
which affiliate codes belong to this member, then joins Postgres
`attributions`/`orders` tables. **That Postgres `affiliates` table doesn't
exist in production** — the query is wrapped so a missing-table error
returns zero-stats gracefully rather than a 500 (fixed this session), but
this route fundamentally can't return real data until that table exists (it
never has data in it — the feature that would have populated it, member's
own sub-affiliate creation, was removed — see `gotchas.md`). Don't confuse
this with the real, working `attributions.json`-based data.

### `GET /attributions` / `POST /attributions/mark-paid`
Reads/writes `attributions.json` directly (the same real flat-file data as
`/api/affiliates/attributions`, just not filtered to one affiliate — this
one currently returns **all** attributions regardless of member, with a
`// TODO: filter by member ownership` in the code — fine for a single-seller
site, would need real filtering if this ever supports multiple sellers).
`mark-paid` flips `status: 'pending'` → `'approved'` for the given
attribution IDs — this is the actual "I've paid this affiliate externally,
mark it settled" action.

### `GET /affiliates/search` (deprecated) / `GET /affiliates/search` (duplicate route path, second one is dead code)
Both registered at the literal same path `/affiliates/search` — Express
matches the first one registered, so the second is unreachable dead code.
Both read `member_affiliates.json` and filter by `displayName`/`email`/
`affiliateCode`/`notes`. This is **not** the same list as Fotonix's own
affiliate program members — it's the (currently unpopulated, since the
creation UI was removed) list of a member's own tracked sub-affiliates.

### `GET /member/affiliates/search`
The real, working, currently-used search — same `member_affiliates.json`
source, used by `src/features/links/components/LinkCreator.jsx` and
`MemberAffiliateLinker.jsx` for the "pick an affiliate to attach to this
link" autocomplete.

### `GET /links` / `POST /links`
Member's own tracked links — `{ productId, affiliateId, slug, linkCustomRatePct? }`.
This is how a custom per-affiliate commission rate gets set (see
`architecture.md`'s rate resolution order). Backed by `member_links.json`.
