# Deployment — how a change actually gets to production

There is no CI/CD here. Every deploy this whole project has had is manual,
over SSH, following the exact steps below. Read this before touching
anything in `affiliates/` or `emails/` — those files assume you already know
this part.

## The two hosting locations — don't mix them up

- **Frontend** (the static React build) — hosted on a **cPanel** box,
  served from `/home/fotonixc/public_html`, deployed via cPanel's Git
  Version Control feature pointed at
  `https://github.com/Densigner/fotonix.git`.
- **Backend** (`server/index.js` and everything it requires — the real API,
  the mail server, Postgres) — runs on a completely separate **VPS**
  (`178.104.153.63`), under PM2 as the process `fotonix-api`. cPanel has
  nothing to do with the backend at all, despite hosting the frontend for
  the same site — this surprised everyone the first time it came up this
  session ("tell me this isn't uploaded to the VPS, we host somewhere
  completely different?" — yes, genuinely two different servers).

If a fix doesn't seem to be taking effect, the first question is always
"did I deploy this to the right one of these two places."

## Frontend deploy (anything under `src/`)

1. There's a separate, persistent git clone of the same GitHub repo kept
   specifically for building/deploying — not the same checkout you edit
   source in day to day. Copy the changed file(s) from the real working
   copy into that clone.
2. `CI=false npm run build` inside that clone. (`CI=false` because CRA
   otherwise treats ESLint warnings as build-breaking errors in CI mode —
   this codebase has plenty of pre-existing warnings that aren't worth
   fixing just to get a clean build.)
3. `git add -A && git commit -m "..." && git push origin main`.
4. SSH into cPanel: `ssh -i <cpanel-key> -p 88 fotonixc@fotonix.co.uk`.
5. `cd /home/fotonixc/repositories/fotonix && git pull origin main`.
6. Manually copy the build output into the live doc root:
   ```
   export DEPLOYPATH=/home/fotonixc/public_html
   cp -R build/* $DEPLOYPATH/
   cp build/.htaccess $DEPLOYPATH/.htaccess
   ```
   **Don't rely on cPanel's own "Deploy HEAD Commit" button** — it reads
   `.cpanel.yml` and is supposed to do step 6 automatically, but it was
   unreliable/opaque this session (see "Historical blocker" below) and
   running the copy commands directly is faster to verify.
7. **Always verify**, don't just trust the deploy succeeded — `curl` the
   live site, find the current bundle hash (`grep -o 'main\.[a-z0-9]*\.js'`
   on the homepage), fetch that bundle, and grep it for something specific
   to your change (a new string, a fixed function name, whatever's
   unique). This caught real problems more than once — e.g. a fix that was
   coded and "deployed" but the build step had actually been skipped.

## Backend deploy (anything under `server/`)

1. `scp` the changed file directly to its path on the VPS, e.g.:
   ```
   scp -i <vps-key> server/routes/email/emails.js root@178.104.153.63:/var/www/fotonix-api/routes/email/emails.js
   ```
2. **Always syntax-check before restarting**: `node -c <path>` over SSH. A
   syntax error in a file PM2 is about to reload will crash the whole API
   process, not just fail gracefully.
3. `pm2 restart fotonix-api --update-env`.
4. Check `pm2 describe fotonix-api` or tail logs
   (`pm2 logs fotonix-api --lines 40 --nostream`) to confirm it actually
   came back up clean, not stuck in a restart loop.

### The gotcha that's bitten this project already: two copies of the backend

The VPS (`/var/www/fotonix-api/...`, what's actually running) and the git
repo (what gets pulled for the *frontend* deploy, which happens to also
contain the `server/` folder) are **two independent copies**. Deploying a
backend fix via `scp` updates the VPS but does **nothing** to the git repo —
if you stop there, the next person (or the next session) who does a
frontend deploy will `git pull` a repo that still has the *old* backend
code in it, with no obvious sign anything's wrong (the frontend deploy step
doesn't touch the VPS at all, so nothing errors).

**Always copy the same backend file into the frontend deploy clone too, and
commit/push it there**, even though that push doesn't itself deploy
anything to the VPS — it's purely so the two copies don't silently drift
apart. This exact drift happened mid-session (several backend fixes were
live on the VPS for a while before anyone remembered to also commit them to
git) and had to be caught and reconciled after the fact.

## Database changes

No migration runner is actually used, despite a `database/migrations/`
folder existing in the repo — several of its files were written but never
actually applied to production (confirmed multiple times this session by
finding tables/columns the code assumed existed that simply weren't there).
**Don't trust that folder as a description of the live schema.**

Real schema changes happen directly via `psql` over SSH to the VPS:
```
ssh -i <vps-key> root@178.104.153.63
PGPASSWORD=fotonixpass psql -h localhost -U fotonix -d fotonix_dev -c "ALTER TABLE ..."
```
Always check the *live* table first with `\d tablename` before assuming
anything about its columns — this was the root cause of several bugs this
session (code referencing a column that was never actually added).

## Historical blocker (already resolved, noted in case it recurs)

Early in this project's life, cPanel's "Deploy HEAD Commit" refused to run
with the message "no uncommitted changes exist" / a stale `.cpanel.yml`
check — root cause was `logs/server.log` being tracked in git despite being
gitignored (it had been committed before the `.gitignore` rule was added),
which left the checked-out branch permanently "dirty" from cPanel's
perspective. Fixed with `git rm --cached logs/server.log`. If cPanel's
deploy button ever refuses again with a similar complaint, check
`git status` on the server-side checkout for exactly this kind of
stray-tracked-file situation before assuming it's a cPanel bug.

## SSH access

Two separate sets of credentials, don't confuse them:
- **VPS** (`178.104.153.63`) — key-based, root access, used for backend
  deploys, mail server administration, and direct `psql` access.
- **cPanel** (`fotonix.co.uk`, port `88`, user `fotonixc`) — key-based
  (imported via cPanel's "Import SSH Key" UI, since the account's original
  key was passphrase-protected and unusable non-interactively), used only
  for the frontend git-pull-and-copy deploy step.
