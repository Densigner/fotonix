# Email Routes

All mounted on the real production API (`server/index.js`, VPS). Base URL in
production: `https://api.fotonix.co.uk`.

`getTenantId(req)` (defined at the top of `emails.js`): reads `x-tenant-id`
header or `?tenant=`/`?tenantId=` query param. Single-tenant platform — always
resolves to integer `1` (maps `'fotonix-prod'`, `'default'`, or nothing, to
`1`; any other numeric string is used as-is, non-numeric falls back to `1`).
**Never pass the literal string `'default'` through to a SQL query as
`tenant_id`** — it's an integer column, that's a recurring bug class here
(see `gotchas.md`).

---

## `server/routes/email/emails.js` — mounted at `/api/email`

### `POST /send`
Send a single email.

Body: `{ to, from?, subject, html?, text?, templateName?, templateData?, businessEmailId?, attachments? }`
`attachments`: `[{ filename, contentType, dataBase64 }]` (optional).

Checks `email_suppressions` first (rejects with 400 if the recipient is
suppressed). If `businessEmailId` given, validates it's active and under its
daily send limit. Inserts an `email_messages` row (`status='queued'`) before
sending, updates to `'sent'`/`'failed'` after. Logs an `email_events` row on
send. Returns `{ success, messageId, providerMessageId, from, response }`.

### `POST /send-bulk`
Campaign send — one email to many recipients.

Body: `{ recipients: [...], subject, html?, text?, templateName?, templateData?, campaignId?, fromEmail?, fromName?, replyTo?, attachments?, trackOpens?, trackClicks? }`
`recipients`: array of email strings or `{ email, ...mergeFields }` objects —
if a recipient object has extra fields and `templateName` is set, those
fields are merged into the template render (`renderTemplate`, simple
`{{var}}` substitution, in `src/email/renderer.js`).

Attachments are uploaded **once** (not per-recipient) and the same file(s)
sent to everyone. Processes in batches of 10. Per-recipient: suppression
check, insert `email_messages` row, send, update status. Returns per-recipient
results array.

`trackOpens`/`trackClicks` (both default `true`, added 2026-07-28): if
either is true, `injectTracking()` rewrites `<a href>` links through
`GET /click/:messageId` and/or appends a 1x1 pixel pointing at
`GET /open/:messageId`, keyed by that specific recipient's own
`email_messages` row id — applied only to the HTML actually mailed via
nodemailer, **not** to what gets stored in the `html` column, so viewing a
sent campaign message later still shows the clean original. See
`architecture.md` for the full mechanism and why it's separate from the
single-send `/send` route (deliberately not tracked — see `gotchas.md`).

### `GET /messages`
List/search inbox messages. Query params:
- `limit` (default 25), `cursor` (created_at-based pagination — "less than"
  this timestamp), `sort` (`date:asc`/`date:desc`, only `date` field
  supported, aliases to `created_at`)
- `status` → `received`|`sent`|`draft`|`archived`|`spam`|`deleted` (maps to
  `direction`/`status` columns — see `database.md`)
- `filter=unread` → `is_read = false`
- `q` → searches `subject ILIKE` and `text ILIKE`
- `memberUid` → restricts to messages to/from that member's `business_emails`.
  **Fail-closed as of 2026-07-27**: if `memberUid` is present at all, the
  scoping clause always applies, even if that member has zero
  `business_emails` rows yet (matches nothing rather than silently falling
  back to every tenant message). Before that fix, the clause only applied
  when the member had ≥1 business email, which — combined with the frontend
  never actually sending `memberUid` at all (a dead `localStorage` key, see
  `gotchas.md`) — meant every account's inbox showed the entire tenant's
  mail, always. If `memberUid` is omitted, still unscoped (legacy path, only
  safe because the real inbox UI always sends it now).

Returns `{ items: [...], next_cursor, has_more }`.

### `GET /messages/:messageId`
Single message detail, joined with `business_emails` for display name. 404 if
not found (or wrong tenant). Accepts the same `memberUid` param and applies
the identical fail-closed scoping as `GET /messages` (added 2026-07-27) —
previously had **no** member scoping at all, just `tenant_id`, so any message
was fetchable by anyone who could guess/increment its plain sequential
integer id.

### `POST /messages/mark-read`
Body: `{ message_ids: [...], read? }` (`read` defaults to `true`). Real
`UPDATE ... SET is_read = ...`. Built this session — previously called a
route that didn't exist.

### `POST /messages/archive`
Body: `{ message_ids: [...] }`. Sets `status = 'archived'`. Built this
session (same story as mark-read).

### `DELETE /messages/delete`
Body: `{ message_ids: [...] }` (yes, DELETE with a JSON body — Express parses
it fine since `express.json()` is global middleware). Soft-delete: sets
`status = 'deleted'`, which is what the "Trash" folder filter checks for. No
hard-delete route exists. Built this session.

### `GET /stats`
Query param `timeframe` (`24h`|`7d`|`30d`, default `24h`). Returns send
counts by status + open/click counts + suppression counts grouped by reason.

`campaignId` (added 2026-07-28, optional): when given, replaces the time
window entirely — filters on `meta->>'campaignId' = $1` instead, so a
specific campaign's real open/click numbers can be checked regardless of
when it was sent. Used by `CampaignSendPage.js`'s post-send stats panel.

### `GET /open/:messageId`
Open-tracking pixel (added 2026-07-28). Returns a 1x1 transparent gif
unconditionally (even on DB error — a recipient should never see a broken
image because of a hiccup), and asynchronously sets
`email_messages.opened_at = COALESCE(opened_at, NOW())` for that id. Only
ever embedded in campaign sends via `injectTracking()` in `/send-bulk` — see
`architecture.md`.

### `GET /click/:messageId?url=...`
Click-tracking redirect (added 2026-07-28). 302s to `url` immediately, then
asynchronously sets `email_messages.clicked_at = COALESCE(clicked_at, NOW())`.
Only ever linked to by `injectTracking()`-rewritten `<a href>`s in campaign
sends. **Not the same routes as** `routes/email/tracking.js`'s
`/api/email/track/open|click/:trackingId` (mounted separately at
`/api/email/track`) — that older pair is real too, but wired to the dead
Firebase-backed "Email Automation" feature, not these Postgres
`email_messages` rows. Don't confuse the two if debugging tracking issues —
check which `trackingId`/`messageId` format you're looking at first.

### `POST /webhook`
Delivery-event webhook (opens/clicks/bounces/complaints) — for an email
service provider to call. **Nothing currently calls this** (no ESP like
SendGrid/Postmark is wired up) — it's built and functional but dormant. Not
to be confused with `receive-webhook.js` below, which is for *inbound mail*,
not delivery events.

### `POST /suppressions` / `DELETE /suppressions/:email`
Manually add/remove an address from the suppression list (checked before
every send). Body for POST: `{ email, reason, detail? }`.

### `GET /labels`
**Hardcoded stub** — returns 4 fixed labels (`important`/`work`/`personal`/
`shopping`), no labels table exists. Label filtering on `/messages` was
previously broken (referenced a non-existent `m.labels` array column) and
was removed this session rather than built out, since it wasn't in scope.
If you want real labels, this needs an actual table + the `/messages` filter
rebuilt.

### `GET /signatures`
**Hardcoded stub** — returns one fixed "Default" signature. No signatures
table exists. Fine as-is unless multiple signatures are actually needed.

---

## `server/routes/email/receive-webhook.js` — mounted at `/api/email/receive-webhook`

### `POST /`
This is where inbound mail actually lands (called internally by
`mail-poller.js`, see `architecture.md`). Requires header
`x-webhook-secret` matching `WEBHOOK_SECRET` in `/var/www/.env`.

Body: `{ from, to: [...], subject, html?, text?, attachments?, headers: { message-id, in-reply-to, references } }`

Looks up `business_emails` by the `to` address to link `business_email_id`
(null if the address isn't a known business email — message is still saved).
Uploads any attachments (non-fatal on failure — saves the message anyway,
just without them, and logs the error). Inserts one `email_messages` row per
recipient in the `to` array (`direction='inbound'`, `status='received'`).

---

## `server/routes/email/contacts.js` — mounted at `/api/contacts`

Auth via `x-member-uid` header throughout (not JWT/session — matches the
pattern the rest of the member API uses).

### `GET /`
List contacts for the member's tenant. **Side effect**: on every call, syncs
in leads from three other sources into the `contacts` table — PBN customers
(`syncPBNCustomers`, from `user_email_verification`/`pbn_orders`/
`contact_events`), conversion leads (`syncConversionLeads`, from
`conversion_leads`), and Stencil Forge users (`syncStencilUsers`, from
`users`). **Update 2026-07-27**: the `users` table now exists (see
`../funnel-builder/gotchas.md`'s "`POST /api/users/sync` was 404ing on
every login" entry — same table, fixed while working on something
unrelated) — `syncStencilUsers` should start actually populating rows from
here on, instead of permanently no-op'ing via its `.catch(() => {})`.
Not independently re-verified live as of this note; if Stencil Forge
signups still aren't appearing in contacts, check that this sync is
actually finding rows in `users` before assuming it's still broken.
Supports `?search=`, `?segment=` (`vip`|`high_engagement`|
`low_engagement`|a named `audience_segments` label), `?page=`/`?limit=`.

### `GET /mine`
Same shape as `GET /` but filtered `WHERE member_uid = <x-member-uid
header>` — a real per-affiliate view, added 2026-07-26 so an affiliate's
"Your Mailing List" page only shows contacts attributed to them, not the
whole tenant. No sync-from-other-sources side effect (unlike `GET /`) —
those other sources (PBN, conversion leads, Stencil Forge) never set
`member_uid` anyway. See `gotchas.md` for the caveat this shares with every
other route here (the header itself isn't verified against a real session).

### `POST /`
Add one contact. Body: `{ email, firstName?, lastName?, isVip?, source? }`.
Requires `x-member-uid` — **note this isn't really "the logged-in member
adding a contact" specifically**, it's just whatever uid is in that header,
stored directly onto the new row's `member_uid` column. This is what the
Funnel Builder's "Join mailing list" button/Email Capture block uses for
real public signups (2026-07-26) — the funnel's *owner* uid is sent as
`x-member-uid` on behalf of an anonymous visitor, so a public, unauthenticated
signup form can still populate `member_uid` correctly. Until 2026-07-26,
`member_uid` and `source` were columns on the table that this route never
actually wrote to (see `gotchas.md`) — they're populated for real now.

### `POST /import-csv`
Multipart form upload, field name `file`. Flexible column mapping — accepts
`email`/`Email`/`EMAIL`/`Email Address` for the email column, `first_name`/
`firstName`/`First Name`/`name` for the name column (so a plain `name`
column, like a typical scraped-leads spreadsheet, works fine). Skips invalid
rows (reported in an `errors` array), dedupes against existing contacts via
`ON CONFLICT (tenant_id, email) DO NOTHING`.

### `DELETE /:id`
Removes a contact (GDPR-style — also adds them to `email_suppressions` so
they can't be re-imported/re-emailed accidentally).

### `POST /unsubscribe`
Body: `{ email }`. Marks unsubscribed + suppresses.

### `GET /segments`
Lists named `audience_segments` for the tenant with member counts.

---

## Frontend routes calling these

- `src/components/email/AdvancedInboxScreen.js` — the inbox UI. Calls
  `/messages`, `/messages/:id`, `/messages/mark-read`, `/messages/archive`,
  `/messages/delete`, `/labels`, `/signatures`, `/send`, plus
  `/api/member/business-emails/:uid` (in `server/routes/member/member.js`,
  not this folder) for the compose "From" dropdown. That route **no longer
  falls back to Fotonix's own real addresses** for members with none of
  their own (fixed 2026-07-27 — see `gotchas.md`); returns `[]` instead, and
  the frontend shows "No business emails available." Also note
  `server/routes/member/member.js`'s `POST /business-email/create-standard`
  (member signup) and the newer `POST /business-email/create-affiliate`
  (affiliate signup, added 2026-07-27 — one `support+<code>@fotonix.co.uk`
  address per affiliate, see `../affiliates/gotchas.md`) are what actually
  populate the rows this dropdown reads.
- `src/components/email/MailBuilder/CampaignSendPage.js` — campaign builder.
  Calls `/send`, `/send-bulk`, and `/api/contacts` + `/api/contacts/segments`
  to auto-populate the recipient list from a segment (this used to silently
  fail — see `gotchas.md` — but `contacts.js` was fixed this session and it
  now works; only carries emails through though, not names, see the
  personalization note in `gotchas.md`).
- `src/components/email/ContactManagement.jsx` — contacts CRUD/import UI,
  reachable from the Mail Builder dashboard.
