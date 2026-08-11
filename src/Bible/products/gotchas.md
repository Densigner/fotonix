# Gotchas — Products & Landing Page

## The acrylic size picker did nothing real (fixed this session)

The wall and desk acrylic banners each got a size-selector UI (matching
the pattern already used on the Lumina Mirror banner) before this bug was
even noticed — clicking a size correctly updated the price shown on the
landing page itself. What it didn't do: affect anything on the page
"Start Designing" actually sent you to.

`AffiliateProductPageCleanAccryl.js` — the one real designer page shared
by both acrylic products — had its size and price **hardcoded in five
separate places**: the sticky header title ("Fotonix — Side-lit Acrylic
Designer 30cm X 30cm", always, verbatim), two on-page price displays
(`£34.99`, both), the `PayPalButton`'s `amount` prop (i.e. the actual
amount charged), and the Firebase order record's `pricing.total` and
`metadata.productSize`. No matter which size a visitor picked on the
landing page, they always landed on a page that said 30×30cm and charged
£34.99.

**That £34.99 was itself already wrong before any of this** — every
other reference to this product (`productsData.js`, the landing page
banner) says £29.99. Two unrelated bugs stacked on the same page: a
stale hardcoded price that never matched the listing, plus a new size
selector that had nowhere real to report its selection to.

Fixed by threading the selection through the URL rather than trying to
share React state across a full page navigation (`window.location.href =
...` is a real browser navigation here, there's no client-side router
connecting the two pages) — see `architecture.md`'s "The acrylic size
hand-off" for the exact mechanism (`?size=` in `location.search`,
deliberately kept out of the hash so `App.js`'s exact-string route
matching doesn't break). Pulled the size/price tables into
`src/data/acrylicSizes.js` as the one shared source, specifically so nothing
like the £34.99-vs-£29.99 split can happen silently again — before, "the
price" was three unrelated literals in three files that happened to
usually agree.

**Verified end-to-end**, not just read through: built, ran the real dev
server, clicked through both acrylic banners at multiple sizes, confirmed
the resulting designer page's title/price/PayPal-amount all matched what
was picked, confirmed a direct visit with no `?size=` param still falls
back cleanly to 30×30cm/£29.99, then repeated the 30×50cm case against
the actual **live production site** after deploying (not just the local
dev server) before calling it done.

## The Lumina Mirror has the exact same gap, just not fixed (flagged, not resolved)

The Lumina Mirror banner has its own size selector (`LUMINA_SIZES` in
`MainLandingPage.js` — 15×20/20×30/30×50cm) that behaves identically to
what the acrylic ones looked like *before* the fix above: it updates the
displayed price on the landing page, and does nothing else. "View
Product" always sends you to `/#product` with no size information
attached at all — `ProductPageClean.js` has no query-string reading logic
of any kind, and its price (`STANDARD_MIRROR_BASE_PRICE = 29.99`) is a
flat constant with a code comment nearby (`"Size selection removed; use
defaults or implement later"`) confirming this designer never supported
variable sizing to begin with, on any code path, size selector or not.

This was **not fixed** this session — only the acrylic side was, because
that's what was reported broken. If asked to fix pricing/sizing anywhere
in the product pages again, check whether the Lumina Mirror is what's
meant before assuming it already works the way the acrylic ones now do.
Doing the equivalent fix here means adding real query-string reading to
`ProductPageClean.js` (there's currently none — `AffiliateProductPage-
CleanAccryl.js`'s `resolveAcrylicSize()` is a reasonable template to
copy from) plus a `LUMINA_SIZES`-equivalent shared data file the same way
`acrylicSizes.js` was pulled out.

## The affiliate side had its own, separate chain of bugs (fixed 2026-08-11)

Everything above is about the customer-facing landing page. A completely
separate audit of the affiliate-facing side (`AffiliateCreateProduct.js`,
`AffiliateProductsPanel.js`, `resolveProductClick`) turned up a chain of
unrelated bugs that had accumulated over time, each hiding the next:

1. **"Add Product" on the affiliate dashboard didn't add anything.** It
   opened `AffiliateProductsPanel.js` — a read-only performance table
   (clicks/conversions/earnings). The actual Create Product modal
   (`AffiliateCreateProduct.js`) was fully built, wired to real Firebase
   writes, and completely unreachable — nothing anywhere ever called
   `setShowCreateProductModal(true)`. Fixed by adding a real "Create
   Product" button to the panel.
2. **`resolveProductClick`'s routing checked a field, `typeId`, that's
   never set anywhere in the codebase** — the Create Product modal
   actually saves the template under `templateId`. The `lumina-cut-user`/
   `light-up-user` special cases had only ever "worked" via a coincidental
   title-text fallback (`title.includes("light up")`), never via the
   field the code looked like it was checking.
3. **Once reachable, the modal's own template list had drifted from the
   real products it's supposed to represent** — every single one:
   "Light Up User Design" listed at £19.99 while the real wall panel it
   opens defaults to £29.99; "Lumina Mirror Cut To Shape User Design"
   listed at £40.00 vs. the real £24.99; none of the four labels matched
   their real homepage product names at all. Same root cause as the
   acrylic size bug above — a hand-typed, independently-maintained copy
   of "the price"/"the name" that nobody kept in sync as the real
   products changed.
4. **The Title field's placeholder was "e.g. Premium Cotton T-Shirt."**
   Fotonix doesn't sell t-shirts.
5. **Stencil Generator, a real product with a real destination, had no
   template option in the modal at all.**

**The actual fix wasn't "correct the four numbers"** — that would just be
the same class of bug waiting to drift again. Instead: added
`products/fotonix-official`, a real Firebase catalog of the five core
products (see `database.md`), and made the modal *fetch it live* rather
than hand-typing a fourth copy of title/price/photo. Picking a Fotonix
product now shows a read-only preview of exactly what's in that catalog
record — no title/description/photo fields to fill in or drift out of
sync, because there's nothing left to duplicate. See `architecture.md`'s
"The affiliate side" section for the full routing table and modal
behavior.

**While fixing #2**, also noticed the wall/desk acrylic routes had no
`?size=` at all (both silently landed on whatever the default resolves
to) — fixed alongside it using the same before-the-hash placement as
`goToProduct` already established. And while adding Custom Shape Mirror
to the Fotonix catalog (previously believed to have no real destination
— see the correction note in `database.md`), gave the desk
designer's "Save Design" feature the ability to record mirror vs. acrylic
material too, since it had been silently losing that distinction on save.

## A 152MB video nearly got committed (caught before it happened, not a live bug)

Raw, uncompressed source photos/video the user was actively saving into
`public/images/products/` (mid-session, to be used as new banner
backgrounds) would have been swept into `build/` wholesale by CRA's
public-folder-copy step and then committed to git — including one 152MB
video file — the first time a build+commit happened afterward. Caught by
checking `git status` before staging rather than running a blanket
`git add -A`, moved everything out to the new gitignored `raw-uploads/`
folder, then rebuilt clean. See `architecture.md`'s "The `raw-uploads/`
convention" for the process to follow so this doesn't happen for real
next time — the risk is structural (anything left in `public/` ships,
full stop), not a one-off mistake, so it'll recur if the convention isn't
followed for future product photos.
