# Light Patterns / Library — Bible

Covers the "light pattern" designer feature (custom patterns for LED
mirrors): where it lives, the two Firebase data structures involved, and
the mobile app's community "Library" screen that reads from one of them.

## Where the UI actually lives (this took real digging to confirm)

The pattern designer/upload UI is `src/components/auth/Account.js`
(exports `AccountPage`). **It is not reachable via any top-level route or
`currentPage` check in `App.js`** — there's no `<Account />` JSX usage and
no `<Route>` for it there. It's easy to wrongly conclude it's dead code if
you only grep `App.js` or search for its full import path.

The real path: `src/components/auth/CustomerDashboard.js` (the component
actually rendered at `#account`) imports it via a **same-folder relative
path**, `import AccountPage from './Account'`, and renders `<AccountPage />`
when its own internal `activeSection === 'patterns'` — reached by clicking
"Open" on the "Light Patterns" card on the main `#account` dashboard
screen. A path-substring search for `auth/Account` (matching `App.js`'s
import written from outside the folder) will **not** find this usage,
since from inside the same folder it's just `./Account`. If this component
ever seems unreachable again, search for the bare word `Account` across
the whole `src/` tree, not a path-qualified string.

## Two separate Firebase Realtime Database structures — don't confuse them

1. **`uploads/{uid}/{itemId}`** — per-user, written by `Account.js`'s
   `handleSavePattern()`. This is what "Your Uploads" / the personal
   uploads listener in `Account.js` reads (`db.ref('uploads/' + uid)`,
   real-time `.on('value', ...)`). Shape:
   ```
   { id, type ("pattern" | "mirror"), title, colorway,
     downloads, likes, comments, updatedAt,
     preview (CSS gradient string OR a real Firebase Storage image URL —
       check which before rendering), metadata }
   ```

2. **`communityPatterns/{itemId}`** (added 2026-07-29) — top-level,
   **not** per-user, written by the same `handleSavePattern()` right after
   the `uploads/{uid}/{itemId}` write succeeds. This is what the **mobile
   app's Library screen** reads to show a logged-in user *other people's*
   patterns, not just their own — before this was added, nothing ever
   wrote to `communityPatterns` at all, so the mobile Library always
   showed "No shared patterns yet" (the correct empty state for genuinely
   no data, not a bug in the mobile app itself).

   **This is a deliberately different, flatter shape than `uploads/{uid}`
   above** — built to match the mobile app's `lib/patterns/
   community_pattern.dart` `CommunityPattern` class field-for-field, not
   reused/spread from `newItem` (which nests `colors`/`brightness`/`speed`
   under a `metadata` object that Dart side doesn't have):
   ```
   { id, ownerId, ownerUsername, title, colorway,
     colors,       // top-level here, NOT nested under metadata
     brightness,   // top-level here, NOT nested under metadata
     speed,        // top-level here, NOT nested under metadata
     downloads, likes, comments, updatedAt,
     preview,      // JSON key is "preview" — Dart's `previewUrl` field
                   // reads from this key, don't rename it to "previewUrl"
     sourceUploadId  // == id, traces back to uploads/{uid}/{id} }
   ```
   `colors` is written **with** a leading `#` (`'#ffffff'`), matching this
   codebase's convention everywhere else — the Dart class comment says
   "6-hex-digit strings, RRGGBB" (no `#`), which may need stripping on the
   Dart side. Flagged, not resolved, as of 2026-07-29 — confirm which side
   should handle it before assuming either is correct.

   **`effectMode` (added 2026-07-29)** — optional integer 0-7, selected via
   an "Effect (optional)" button row in the "Create New Design" modal
   (`EFFECT_MODES` array in `Account.js`). Genuinely optional: omitted
   entirely from both `uploads/{uid}/{itemId}` and `communityPatterns/{itemId}`
   when no effect is picked (default "None"), never written as `null` or a
   default index. Maps directly to the mirror's BLE effect commands
   (`bleManager.sendColorToDevice(... hexColor: "7bff13XXffffffffbf" ...)`
   on the mobile/firmware side, where `XX` is this index) — the array order
   in `EFFECT_MODES` **must** stay in sync with that hex-command list:
   ```
   0 Dream · 1 Horse Race · 2 Hiding Colours · 3 Full Colour Swap ·
   4 Slow fill up · 5 Quick swap · 6 Moving Groups · 7 All Colour Comets
   ```

   - **Public by default, deliberately** — these are just light/mirror
     patterns, nothing sensitive, so there's no opt-in/visibility flag.
     Every save goes to both places.
   - **No backfill.** Patterns saved before this write was added only
     exist in `uploads/{uid}/{itemId}` and will never retroactively appear
     in `communityPatterns` — only patterns saved from 2026-07-29 onward.
   - The write is best-effort (its own try/catch) — a failure here does
     **not** undo the real `uploads/{uid}/{itemId}` save, which happens
     first.

## Username / "by {author}" display — the "Unknown" bug

Every place that shows who created something (`Account.js`'s uploads grid,
the comment-submit handler) uses this fallback chain:
```
userProfile?.username || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Unknown'
```
`'Unknown'` only shows if literally none of those exist. It used to show
for **almost every account**, because `AuthContext.js`'s shared `signup()`
only sets `username` from `options.username`, and:
- `src/components/auth/Signup.js` (the main member signup form) **does**
  collect and pass a username — this path always worked.
- `AffiliateSignupPage.js` and `CustomerSignup.js` **never** pass one —
  `username` got stored as `''` forever for every account created through
  either of those.

Fixed 2026-07-29 in `AuthContext.js`'s `signup()`: defaults
`username` to `email.split('@')[0]` when no explicit username is given —
covers all three signup paths from one place rather than fixing each page
individually. `Account.js`'s own display fallback chain (above) was also
extended with the email-derived fallback so **already-existing** accounts
with `username: ''` display correctly too, without needing a data
migration.

## The Firebase listener "firing madly" bug (fixed 2026-07-29)

`Account.js`'s `uploads/{uid}` realtime listener lives in a `useEffect`
with `fetchUserProfile` (from `AuthContext.js`) in its dependency array.
`fetchUserProfile` was a plain function recreated on every render of
`AuthProvider` — never memoized — so its identity changed on every single
re-render anywhere in the app that touched auth state, and the effect
would tear down and re-attach the Firebase listener every time, re-firing
its (now-removed) debug logs. Fixed by wrapping `fetchUserProfile` in
`useCallback` with an empty dep array in `AuthContext.js`. Any other
component that puts `fetchUserProfile` in an effect dependency array gets
the same fix for free — if a similar "runs constantly" symptom shows up
elsewhere, check whether the culprit is another unmemoized function coming
out of `AuthContext`.

`Account.js` also used to be full of leftover debug `console.log` /
`console.trace` calls (modal-open tracing, step-by-step logs through
`handleSavePattern` and the comment-submit handler, a whole effect just to
check whether the modal's DOM node existed). All removed — only real
`console.warn`/`console.error` error-path logging remains.

## What's still fake/mock in `Account.js` — don't assume otherwise

- The **"Available Downloads" tab** always shows `sampleDownloads`, three
  hardcoded fake entries ("Community Pack · Top 20", etc.) — never fetched
  from anywhere. Not the same thing as `communityPatterns` above, and not
  wired to any real backend. If asked to make this tab real, it needs
  building from scratch (presumably reading `communityPatterns`), not just
  "fixing."
- The **"Settings" tab** shows hardcoded `user@fotonix.app` / `Free` plan /
  `Mirror #A3F-29` device — not read from the actual logged-in user at all.
- If a user has never uploaded anything, the `uploads/{uid}` listener falls
  back to `sampleItems` (fake pattern data) instead of showing a genuine
  empty state — a new user would see fabricated stats presented as their
  own account activity. Not yet fixed; flagged here for whenever it is.

## Mobile app coordination

The mobile app's Library screen (a separate codebase from this repo) is
expected to read `communityPatterns/{itemId}` directly for its
"browse everyone's patterns" feature, resolving each pattern's display name
via `users/{ownerId}` in Realtime DB (same fallback chain as above — don't
let it hardcode "Unknown" as the only fallback either). This repo is the
only place that *writes* to `communityPatterns`; the mobile app only reads.
