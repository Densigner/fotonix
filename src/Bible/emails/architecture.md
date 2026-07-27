# Email Architecture

## Two completely separate mail systems, don't confuse them

There are **three** "campaign"/email subsystems in this codebase historically.
Two are dead:

- `server/campaigns.js` (repo root `server.js`, port 5002) — dead. Nothing in
  the live frontend calls port 5002. Half its own route mounts are broken.
- The "Email Automation" lifecycle dashboard (abandoned cart, win-back, etc.,
  `src/components/email-automation/`) — UI is real and clickable, but the
  queue processor that would send those emails (`server/email-automation/vpsMailClient.js`)
  is never instantiated anywhere. Toggling automations on does nothing.

**The one that's real**: `server/routes/email/emails.js` mounted at
`/api/email` on `server/index.js` (the actual production API on the VPS).
Everything in this Bible folder is about that one.

## Where mail actually lives

`mail.fotonix.co.uk` resolves to the **VPS** (`178.104.153.63`), not the
cPanel box (`91.238.164.175`). The VPS runs Postfix (SMTP) + Dovecot
(IMAP/POP + SASL auth) directly — this has nothing to do with cPanel's
"Email Accounts" feature. Creating a mailbox via cPanel's UI does **not**
create a working mailbox for this domain; it creates one on the wrong
server entirely (this mistake was made once — see `gotchas.md`).

### How a mailbox is actually defined (two files, both on the VPS)

1. **`/etc/dovecot/users`** — one line per mailbox, format:
   ```
   address@fotonix.co.uk:{SHA512-CRYPT}<hash>:5000:5000::/var/mail/vhosts/fotonix.co.uk/<name>::
   ```
   Generate the hash with `doveadm pw -s SHA512-CRYPT -p '<password>'`.
   This file backs Dovecot's SASL auth (`passdb { driver = passwd-file }`,
   confirmed via `doveconf -n`, not the on-disk `10-auth.conf` which
   misleadingly shows `passwd-file` commented out — the *effective* config
   wins, always check `doveconf -n` not the raw conf.d files).

2. **`/etc/postfix/virtual_mailbox`** — one line per mailbox, format:
   ```
   address@fotonix.co.uk	fotonix.co.uk/<name>/
   ```
   Then `postmap /etc/postfix/virtual_mailbox` to rebuild the lookup db.

3. Maildir itself: `mkdir -p /var/mail/vhosts/fotonix.co.uk/<name>` owned by
   `vmail:vmail`, mode `2750`. Dovecot auto-creates the `Maildir/{new,cur,tmp}`
   subfolders on first delivery.

4. `systemctl reload dovecot && systemctl reload postfix@-` to pick up changes.

**Existing mailboxes**: `admin@`, `noreply@`, `orders@`, `support@`,
`josh@fotonix.co.uk`. Credentials for `orders@`/`noreply@` live in
`/var/www/.env` (`SMTP_USER`/`SMTP_PASS` and `MAIL_USERNAME`/`MAIL_PASSWORD`
respectively — **two different mailbox identities**, see below).

### Two different SMTP identities are in play — don't mix them up

- `SMTP_HOST` / `SMTP_USER=orders@fotonix.co.uk` / `SMTP_PASS` — used by
  transactional emails (order confirmations, affiliate signup emails) in
  `server/routes/payments/capture-order.js` etc.
- `MAIL_HOST` / `MAIL_USERNAME=noreply@fotonix.co.uk` / `MAIL_PASSWORD` — used
  by the campaign/inbox system (`src/email/smtp.js`'s `loadTransport()`),
  which is what this Bible folder is about.

Both point at the same physical mail server, just authenticate as different
mailboxes. `loadTransport()` first tries a `smtp_credentials` Postgres row
for the tenant; that table's real schema doesn't have `host`/`username`/
`password` columns (only `id, tenant_id, from_address, from_name`), so that
lookup always fails and it falls through to the `MAIL_*` env vars — this is
fine, don't try to populate `smtp_credentials`, it can't do what the code
expects without a schema change nobody has needed yet.

**Landmine**: `server/index.js` loads env vars from `/var/www/.env`
(`path.resolve(__dirname, '../.env')`), **not** `/var/www/fotonix-api/.env`.
Editing the wrong file silently does nothing.

## Sending flow

1. Frontend (compose modal in `AdvancedInboxScreen.js`, or the campaign
   builder in `CampaignSendPage.js`) POSTs JSON to `/api/email/send` or
   `/api/email/send-bulk`.
2. Route loads the SMTP transport (`loadTransport`), inserts a row into
   `email_messages` (status `queued`), then calls `transport.sendMail()`.
3. On success, updates the row to `status='sent'` and logs an `email_events`
   row. On failure, `status='failed'` with the error message stored.
4. If attachments were included (base64 in the request body), they're
   uploaded to Firebase Storage **first** (see Attachments below) and the
   same buffer is handed straight to nodemailer — no re-download from
   storage needed for the actual send.

## Receiving flow — the part that was completely missing

Real inbound mail is delivered by Postfix/Dovecot straight into each
mailbox's Maildir on disk (`/var/mail/vhosts/fotonix.co.uk/<name>/Maildir/`)
— that's just how mail servers work, nothing app-specific about it. The
**app's own inbox UI reads from Postgres** (`email_messages` with
`direction='inbound'`), and nothing connected the two until this session.

The bridge is `server/mail-poller.js`, run by cron every 2 minutes
(`crontab -l` on the VPS: `*/2 * * * * cd /var/www/fotonix-api && /usr/bin/node mail-poller.js >> /var/log/mail-poller.log 2>&1`).
It:

1. Scans every mailbox's `Maildir/{new,cur}/` for files.
2. Parses each with `mailparser`'s `simpleParser` (extracts from/to/subject/
   body/attachments/Message-ID).
3. Dedupes by `Message-ID` against `email_messages.message_id` — safe to run
   repeatedly, already-imported mail is skipped, never double-inserted.
4. POSTs each new message to `/api/email/receive-webhook` (internally, on
   `localhost`) with the header `x-webhook-secret` matching
   `WEBHOOK_SECRET` in `/var/www/.env`.

**Deliberately does not touch Postfix/Dovecot's delivery config** (e.g. no
content-filter transport, no Sieve pipe extension) — that would risk
breaking real mail delivery for every mailbox including the transactional
ones. Polling the filesystem read-only is slower (up to ~2min lag) but zero
risk to the actual mail server.

If you ever need to change the poll interval: edit the crontab entry
directly (`crontab -e` as root on the VPS, or `crontab -l`/pipe/`crontab -`
non-interactively).

## Attachments

- Storage: Firebase Storage, bucket `fotonix-97544.firebasestorage.app`,
  path `email-attachments/<message-key>/<timestamp>-<safe-filename>`, made
  public on upload (`file.makePublic()`) so the stored URL is directly
  downloadable with no auth.
- Shared upload helper: `server/email-attachments.js`
  (`uploadAttachment`/`uploadAttachments`). Used by both the send routes and
  `receive-webhook.js` so there's one place that handles size limits
  (15MB/file, keeps combined JSON payload under the 20MB body limit) and
  filename sanitization.
- **Metadata storage**: `email_messages.attachments` (JSONB array of
  `{filename, contentType, size, url}`), added this session — there is no
  separate attachments table.
- Wire format over HTTP: attachments travel as
  `{filename, contentType, dataBase64}` in the JSON body (both when the
  frontend sends a new message, and when `mail-poller.js` forwards a parsed
  inbound message to the webhook). Nothing uses multipart/form-data here.
- Inline images (`Content-Disposition: inline`, e.g. images referenced by
  `cid:` in HTML email bodies) are filtered out by `mail-poller.js` before
  forwarding — only real attachments (`Content-Disposition: attachment` or
  no disposition header) get uploaded and shown.
