# Roadmap — what a real "left in cart" email would actually need

Sketched 2026-07-28, at the user's request, after confirming the existing
"Email Automation" abandoned-cart toggle (see `gotchas.md`) is pure UI
theater — a Firebase flag nothing reads. This file is **not** a plan to
fix that toggle. It's what would actually be required to build a real
cart-abandonment email from scratch in this codebase, the way Amazon/eBay
do it. Nothing below is built yet — this is deliberately just the plan.

## The blocker, stated plainly, before anything else

**You cannot send someone an abandoned-cart email if you never captured
their email address before they abandoned.** This is the one fact
everything else here depends on, so it goes first.

Checked directly (not assumed): today, in the real live purchase path
(`src/components/products/ProductPageClean.js` → `PayPalButton.js` →
`POST /api/paypal/create-order`), **no cart exists and no email is known
until PayPal itself returns one, after payment is already captured**
(`server/routes/payments/capture-order.js`, reading
`result.payer?.email_address` post-capture). Before that point, the only
things the server has seen are a product name and an amount — there is no
concept of "this anonymous visitor started buying something" anywhere that
persists past the page refresh. If they close the tab before clicking
"Pay," nothing was ever recorded, and there is no email to send a reminder
to even if something *were* watching for abandonment.

There's a real, fuller checkout flow already written —
`src/components/checkout/CheckoutPage.js`, a proper 3-step Contact →
Shipping → Payment form that captures email in step 1, before payment —
but it's **not wired into the live site** (`App.js` never mounts it; it's
only reachable via its own demo wrapper, `CheckoutDemo.js`). If this ever
goes live for real, it would immediately solve half the problem below,
since it already asks for email early.

### Why Amazon/eBay don't have this problem

They don't solve this cleverly — they sidestep it. You're logged in
(or asked to log in) before you can meaningfully shop, so your cart is
tied to your account from the first "Add to Cart" click, not to an
anonymous browser session. Cart abandonment tracking, for them, is just
"does this logged-in user have cart items with no matching order after
N hours" — a database query, not a tracking problem. The email address was
never in question.

This codebase already has a version of that shortcut available:
`src/contexts/AuthContext.js` carries `firebaseUser.email` for anyone
logged in. `ProductPageClean.js`'s buy button doesn't currently require
login first — most real purchases today are fully anonymous until PayPal
hands back an email. **The cheapest real version of this feature only
covers logged-in users**, and would need a product decision: require login
before buying (matches Amazon/eBay, but adds friction), or build real
pre-payment email capture for anonymous buyers too (more work, no added
friction).

## What already exists and is genuinely reusable

- **Sending**: `POST /api/email/send` (`server/routes/email/emails.js`)
  and the `email_templates` table — real, production-used, already
  supports `templateName` + `templateData` merge rendering
  (`src/email/renderer.js`).
- **Open/click tracking**: real as of 2026-07-28 (see `architecture.md`'s
  "Open/click tracking" section) — a cart-recovery email sent through
  `/send` (not `/send-bulk`, since it's one email to one specific person,
  not a campaign) would need this ported to the single-send route if you
  want to know whether the reminder itself got opened. Currently only
  wired into `/send-bulk`.
- **Scheduled-job pattern**: `server/mail-poller.js`, run every 2 minutes
  via VPS crontab (`architecture.md`) — a plain Node script using `pg`
  directly, polling for state and calling an existing API route. A
  "check for abandoned carts every N minutes" job should look like this,
  not a new framework.

## What's dead and NOT reusable as a starting point

The existing "Email Automation" abandoned-cart/win-back dashboard
(`src/components/email-automation/`, `server/email-automation/vpsMailClient.js`)
is UI-only — confirmed again this session (grepped the whole codebase and
the VPS crontab, nothing instantiates its processor). Its Firebase-shaped
data model (`stores/{uid}/emailAutomation/...`) could inform schema design
if useful, but there's no working code underneath it worth building on top
of. Treat it as a mockup, not a foundation.

## Phase 1 — decide where a "cart" actually lives

Nothing below matters until this is decided. Options, roughly cheapest to
most complete:

1. **Logged-in-only, no new cart table.** On the product page, if a
   logged-in user clicks "Buy" but doesn't complete payment within N
   minutes, write a row to a new lightweight table (or reuse
   `email_messages`-adjacent Postgres, tenant already single) —
   `{email, product_name, amount, created_at, recovered_at}` — created the
   moment `createOrder` fires (product/amount already known then, per
   `PayPalButton.js`), not waiting for capture. Cheapest real version;
   covers nothing for anonymous buyers.
2. **Wire up the existing `CheckoutPage.js`** as the real checkout flow
   (replacing the single-button `ProductPageClean.js` path, or offered
   alongside it), so email is captured in step 1 for everyone, logged in
   or not. More product-facing work (it's currently a mock with a
   `// Mock order processing` comment), but closes the gap for anonymous
   buyers too and matches the fuller Amazon/eBay-style flow.
3. **Full client-side cart + backend sync** (add multiple items, cart
   persists across pages/sessions) — not needed just for abandonment
   emails; only relevant if multi-item carts are wanted as a feature in
   their own right. Don't build this only to support Phase 2 below; it's
   a separate, bigger product decision.

## Phase 2 — detection job

Once Phase 1 exists in some form: a `mail-poller.js`-style script, cron'd
(e.g. every 15 minutes), querying for cart/checkout-start rows older than
some threshold (Amazon-style would be a short first nudge — around 1 hour
— then a longer follow-up around 24 hours, maybe a final one at 3 days)
with no matching completed order and no reminder already sent for that
threshold, then calling `/api/email/send` for each.

## Phase 3 — the actual email(s)

- Needs at least one real `email_templates` row (none exist yet for this —
  `email_templates` currently has no UI to manage it at all, see
  `routes.md`'s note that rows would need to be inserted directly).
- Content-wise, Amazon/eBay's pattern worth copying: show the specific
  product they were looking at (image + name + price), one clear CTA back
  to that exact product page, and — only on a later touch, not the first
  — a small incentive (discount code, free shipping) to actually convert
  the recovery, not just remind.
- Reuse the tracking-pixel/link-rewrite mechanism built this session
  (`injectTracking()` in `emails.js`) — currently only called from
  `/send-bulk`; would need calling from `/send` too (or a shared helper
  extracted) so recovery emails' opens/clicks are measurable the same way
  campaign sends are.

## Not decided yet — flag before building

- Login-required-to-buy vs. real anonymous email capture (the Phase 1
  fork above) — product decision, not a technical one.
- How many touches, what timing, whether to include a discount — content/
  marketing decision.
- Whether this should be per-tenant configurable (probably moot — see
  `database.md`, this is a single-tenant platform in practice) or just a
  fixed sequence.
