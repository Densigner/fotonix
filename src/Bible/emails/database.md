# Email Database Schema

Postgres, `fotonix_dev` database, on the VPS (`178.104.153.63:5432`,
user `fotonix` / password `fotonixpass`, local connections only). All tables
below verified live via `\d tablename` — **trust this file over
`database/migrations/*.sql` in the repo**, several of those migrations were
never actually applied and describe a schema that doesn't match reality (see
`gotchas.md`).

Single-tenant platform: every `tenant_id` column is an integer and every row
in this whole area uses `tenant_id = 1`.

## `email_messages` — the core table

```
id                    integer, PK
tenant_id             integer, FK -> tenants(id)
template_id           integer (unused in practice — templates are looked up
                       by name at send time, not linked by id after sending)
from_address           varchar(255) not null
to_address              varchar(255) not null
subject                varchar(255) not null
html                   text
text                   text
status                 varchar(50), default 'queued'
                       values used in practice: queued, sent, failed, draft,
                       archived, spam, deleted, bounced, complained, received
                       (no CHECK constraint — any string is accepted)
provider_message_id   varchar(255) — nodemailer's returned message id
error                 text — populated on send failure
meta                  jsonb — the raw request body, stashed for debugging
created_at            timestamptz
queued_at             timestamptz
sent_at               timestamptz
opened_at             timestamptz
clicked_at            timestamptz
unsubscribe_token     varchar(255)
direction              varchar(20), default 'outbound'
                       CHECK constraint: only 'inbound' or 'outbound'
message_id             varchar(255) — the email Message-ID header, used for
                       inbound dedup (mail-poller.js checks this before
                       importing)
in_reply_to            varchar(255)
email_references        text — JSON-stringified array (not a real array
                       column, despite the name — always JSON.stringify
                       before inserting, JSON.parse-adjacent after reading)
received_at            timestamptz — set on inbound only
is_read                boolean, default false
business_email_id      bigint, FK -> business_emails(id) ON DELETE SET NULL
attachments             jsonb, default '[]' — array of
                       {filename, contentType, size, url}, added this
                       session
```

`direction` + `status` together determine what folder a message shows up in
on the `/messages` list route — see `routes.md`'s `GET /messages` section for
the exact mapping (`status=received` → `direction='inbound'`, etc).

## `business_emails`

One row per sender identity (`josh@`, `noreply@`, `orders@`, `support@`, all
currently `member_uid` = the one member using this system). Drives:
- the compose "From" dropdown (`GET /api/member/business-emails/:uid` in
  `server/routes/member/member.js`, not this folder)
- daily send-limit enforcement in `/api/email/send`

```
id                    bigint, PK
member_uid            varchar(255) not null
business_name         varchar(100) not null
email_address         varchar(255) not null, UNIQUE
email_type            varchar(50) not null
                       CHECK: 'main' | 'noreply' | 'support' | 'orders' | 'custom'
display_name          varchar(255)
description           text
forward_to_email      varchar(255)
is_active             boolean, default true
is_verified           boolean, default true
verified_at           timestamptz
daily_send_limit      integer, default 500
daily_send_count      integer, default 0 — incremented on every /send that
                       includes a businessEmailId; nothing currently resets
                       this daily (send_count_reset_at exists but nothing
                       writes to it — if a real daily-limit workflow matters,
                       this needs a cron job)
send_count_reset_at   timestamptz, default now()
created_at / updated_at
```

## `email_suppressions`

Checked before every send in `/send` and `/send-bulk`; if the recipient is
in here, the send is rejected with 400.

```
id, tenant_id
address    varchar(255) not null
reason     varchar(100) not null  (e.g. 'bounce', 'complaint', 'unsubscribe')
detail     text
created_at
UNIQUE (tenant_id, address)
```

## `contacts`

Powers `server/routes/email/contacts.js`. Auto-populated from three other
data sources on every `GET /api/contacts` call (see `routes.md`).

**`member_uid` and `source` were dead columns until 2026-07-26** — always
`NULL` in practice, despite existing in the schema and despite `POST /`
requiring an `x-member-uid` header for auth. Now genuinely populated: a
funnel's mailing-list signup sends the funnel owner's uid as that header,
and it's stored on the row along with `source: 'funnel_signup'`. See
`gotchas.md` for the full story and the real, filtered `GET /mine` this
enabled.

```
id, tenant_id (default 1), member_uid
email             varchar(255) not null
first_name / last_name / display_name
phone
source            varchar(100) — e.g. 'pbn_signup', 'funnel_signup'
tags              jsonb, default []
custom_fields     jsonb, default {}
meta              jsonb, default {}
engagement_score  numeric(4,2), default 0
is_vip            boolean, default false
created_at / updated_at
UNIQUE (tenant_id, email)
```

## `smtp_credentials`

**Don't try to use this for actual SMTP config** — it only has
`id, tenant_id, from_address, from_name`, no host/port/username/password
columns. `src/email/smtp.js`'s `loadTransport()` expects those columns; the
mismatch means any row here causes a caught error and falls straight through
to the `MAIL_*` env var fallback. Either leave this table empty (current
state, and it works fine via the env fallback) or add the missing columns
properly if per-tenant SMTP config is ever actually needed.

## `email_templates`

```
id, tenant_id, name, subject, html, text, version (default 1),
is_active (default true), created_at
```
Looked up by `name` (not id) at send time when `templateName` is passed to
`/send` or `/send-bulk`. No UI currently manages this table — rows would
need to be inserted directly.

## `email_events`

Append-only log. Written by the `/webhook` route (dormant, see `routes.md`)
and by `/send`'s "sent"/"failure" logging.

```
id, message_id (FK -> email_messages, CASCADE), tenant_id,
event_type varchar(50), payload jsonb, occurred_at
```

## `audience_segments` / `audience_segment_members`

Named contact segments, referenced by `contacts.js`'s `GET /segments` and
the `?segment=` filter on `GET /contacts`. No UI currently creates segments
— would need direct inserts, or a management UI built.

## Tables referenced by code but confirmed **not to exist**

Don't write code assuming these exist without creating them first — this
exact mistake caused several silent-failure bugs this session (see
`gotchas.md`):

- ~~`users`~~ — **fixed 2026-07-27**, see `../funnel-builder/gotchas.md`'s
  "`POST /api/users/sync` was 404ing on every login" entry. Was referenced
  by `contacts.js`'s `syncStencilUsers` (safely `.catch()`-wrapped,
  permanently a no-op) and by `server/routes/auth/users.js` (route file
  existed but was never mounted). Table now created
  (`server/migrations/002_create_users.sql`) and the route mounted at
  `/api/users` — both dependents should work now, though
  `syncStencilUsers` specifically hasn't been independently re-verified
  live.
- `m.labels` (a column on `email_messages`) — the old label-filtering logic
  in `GET /messages` referenced this; removed this session along with the
  Star feature cleanup, since no labels table/column exists.
