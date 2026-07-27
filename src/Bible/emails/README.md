# Email System — Bible

Everything about how email (sending, receiving, campaigns, the inbox UI) actually
works on Fotonix, written down so future edits don't have to rediscover it the
hard way. This system had a *lot* of schema drift and dead code before this
was written — code referencing columns/tables that never existed, or routes
the frontend called that were never built on the backend. Most of that is now
fixed (see `gotchas.md` for the full list of what broke and why), but if
something in this area "looks broken but returns no error," schema drift is
the first thing to suspect — see `gotchas.md`.

## Files in this folder

- **`architecture.md`** — the big picture: where mail actually lives, how
  send/receive work end to end, what runs where (VPS vs cPanel).
- **`routes.md`** — every backend route, what it does, request/response shape.
- **`database.md`** — every table involved and its real (verified) schema.
- **`gotchas.md`** — every bug found and fixed this round, and the *pattern*
  behind them, so the same class of bug is easy to recognize next time.

## Fastest orientation

1. Frontend inbox UI: `src/components/email/AdvancedInboxScreen.js`
2. Campaign send UI: `src/components/email/MailBuilder/CampaignSendPage.js`
3. Backend routes: `server/routes/email/emails.js` (send/messages/actions/stats),
   `server/routes/email/receive-webhook.js` (inbound mail lands here),
   `server/routes/email/contacts.js` (contact list + CSV import),
   `server/email-attachments.js` (shared attachment upload helper)
4. The bridge between the real mail server and the app's database:
   `server/mail-poller.js`, run every 2 minutes by cron on the VPS.

## Where things actually run

- **Frontend**: static build, deployed via cPanel Git Version Control to
  `/home/fotonixc/public_html` (see the deploy workflow below).
- **API** (`server/index.js` and everything it requires): runs on the VPS
  (`178.104.153.63`) under PM2 as `fotonix-api`, **not** on the cPanel box.
- **Mail server** (Postfix + Dovecot, i.e. `mail.fotonix.co.uk`): also on the
  **same VPS**, completely separate from cPanel's own email system. cPanel's
  "Email Accounts" feature is irrelevant here — mailboxes are managed by hand
  on the VPS (see `architecture.md`).
- **Database**: Postgres, also on the VPS, `fotonix_dev` database, user
  `fotonix` / password `fotonixpass` (local-only, `localhost:5432`).

## Deploying a change in this area

Both frontend and backend are deployed manually — there is no CI/CD.

**Frontend** (anything under `src/`):
1. Copy changed file(s) into the deploy clone (a separate git checkout of
   `https://github.com/Densigner/fotonix.git`, kept in the scratch/temp dir —
   ask the assistant/see prior session notes for the exact path if scripting
   this again).
2. `CI=false npm run build` in that clone.
3. `git add -A && git commit && git push origin main`.
4. SSH into cPanel (`ssh -p 88 fotonixc@fotonix.co.uk`, key-based auth),
   `cd /home/fotonixc/repositories/fotonix && git pull origin main`, then
   manually copy `build/*` into `/home/fotonixc/public_html` (cPanel's own
   "Deploy HEAD Commit" button has been unreliable — do it directly).

**Backend** (anything under `server/`):
1. `scp` the changed file directly to `/var/www/fotonix-api/...` on the VPS
   (`178.104.153.63`).
2. `node -c <file>` on the VPS to syntax-check before restarting.
3. `pm2 restart fotonix-api --update-env`.
4. Also copy the same file into the frontend deploy clone and commit/push it
   there too — **the VPS and the git repo are two separate copies of the
   backend and will silently drift apart if you only update one.** This has
   already happened once this session (multiple backend fixes were live on
   the VPS for a while before anyone remembered to commit them to git).

**Database migrations**: run directly via `psql` over SSH — there is no
migration runner actively used for this area (a `database/migrations/`
folder exists in the repo but several of its files were never actually
applied; don't trust it as a source of truth for current schema — always
check the live table with `\d tablename` instead).
