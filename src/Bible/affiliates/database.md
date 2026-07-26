# Affiliate Data — Three Separate Stores

See `architecture.md` for why there are three. This file is the concrete
shape of each.

## 1. Flat JSON files — the real, working pipeline

Location: `server/data/*.json` on the VPS filesystem, read/written via
`server/db.js` (for clicks/orders/attributions) and direct `readJSON`/
`writeJSON` calls in `affiliates.js`/`member.js` for the rest. **No
database engine, no transactions, no backups beyond manual copies** — every
write is a full-file rewrite (`JSON.stringify(data, null, 2)` over the
whole file). Fine at this scale, but be aware two simultaneous writes to the
same file could race and clobber each other — there's no locking.

### `clicks.json` — `{ [clickId]: click }`
```js
{
  id: 'click_<timestamp>_<random4digits>',
  affiliateId: 'JOSH42',           // the affiliate's code
  productId: null,                  // or a product id if click was product-scoped
  ratePct: 10,                      // the EFFECTIVE rate, resolved once at creation
  programDefaultRatePct: 10,        // what the program default was at the time
  linkCustomRatePct: null,          // non-null if this came through a custom tracked link
  createdAt: '2026-07-...'          // ISO string
}
```
Created by `db.createClick()`. Rate resolution order documented in
`architecture.md`.

### `orders.json` — `{ [orderId]: order }`
Written by `upsertOrder()` (merges into any existing entry). Populated from
the PayPal capture — `amountCents, currency, status, paidAt, raw` (the raw
PayPal resource object).

### `attributions.json` — array of attribution objects
```js
{
  id: 'attr_<timestamp>_<random4digits>',
  orderId,
  clickId,
  affiliateId,
  commissionCents,
  ratePct,
  status: 'pending' | 'approved' | 'void',
  createdAt,
  approvedAt?,      // set when member marks it paid (mark-paid route)
  voidedAt?,        // set on refund/void webhook
  voidReason?
}
```
Created by `db.createAttribution()` — deduped on `(orderId, clickId,
affiliateId)` triple, so a redelivered webhook can't double-create one for
the same purchase. `db.voidAttributionsForOrder()` is the refund path.

### `affiliateSettings.json`
```js
{ programDefaultCommissionPct: 10 }
```
Single global object, not per-affiliate. Edited via `POST /api/affiliates/settings`.

### `ids.json`
```js
{ processed: ['<paypal-transmission-or-event-id>', ...] }
```
Webhook idempotency — grows forever, never pruned. Not a problem at current
volume; worth revisiting if this ever processes high webhook volume.

### `member_affiliates.json` / `member_links.json`
Member's own sub-affiliate list and tracked links (`{ [memberUid]: [...] }`
shape). **`member_affiliates.json` is effectively always empty** — the only
thing that would have populated it (the manual affiliate-creation UI) was
removed this session (see `gotchas.md`), and the search endpoints that read
it (`/api/member/affiliates/search`) will just return no results until
something writes to it again.

### `products.json`
`{ [productId]: { commissionRate, ... } }` — `commissionRate` is a
**decimal** (e.g. `0.15` for 15%), unlike everywhere else in this system
which uses whole-number percentages (`ratePct: 15`). `createClick()`
multiplies by 100 when reading from here — if you add new code that reads
`products.json`'s `commissionRate` directly, remember it's decimal, not
percent.

## 2. Firebase Realtime Database — affiliate *accounts*

- `affiliates/{firebaseUid}`: `{ email, joinedAt (server timestamp), approved: boolean, code }`
  — the canonical "who has signed up" list, queried by code for uniqueness
  checks during signup (`orderByChild('code')`).
- `users/{firebaseUid}`: includes `affiliateCode`, `affiliateApproved`,
  `updatedAt` merged into the broader user profile object (this node has
  lots of other non-affiliate fields too — it's the general user profile).
  This is what the frontend actually reads (`auth.userProfile?.affiliateCode`)
  to gate affiliate-only UI.

No index is configured on `affiliates/code` — Firebase logs a performance
warning on every query ("Using an unspecified index... Consider adding
`.indexOn: "code"`"). Harmless at current scale (small number of affiliates),
worth fixing in Firebase console's RTDB rules if the affiliate list ever
grows large.

## 3. Postgres — member's own sub-affiliate network (mostly inert)

An `affiliates` table (`affiliate_code, member_uid, contact_name, email,
paypal_email, paypal_username, notes`) was designed for members to create
and manage their *own* affiliates, one level up from Fotonix's program. The
creation/edit UI (`AffiliateCreator.jsx`, `AffiliateManager.jsx`) and the
routes that wrote to it (`POST/PATCH/DELETE /api/member/affiliates`) were
**removed this session** — the table was confirmed to not exist in
production (never migrated), and the UI let you "create" affiliates that
silently failed to save. `member.js`'s `GET /stats` still queries this table
by name; the query is now defensively wrapped to return zero-stats instead
of a 500 when the table's missing, but it will never have real data unless
this whole feature is rebuilt properly (real migration + working create
routes). See `gotchas.md` for the full story and `routes.md` for exactly
which routes still reference it.

If this feature is ever wanted back: don't just re-add the old UI. Decide
first whether it should write to Postgres (as originally designed) or reuse
the flat-file pattern the rest of this system uses (`member_affiliates.json`
already exists and is simpler, if per-member Postgres relational queries
aren't actually needed).
