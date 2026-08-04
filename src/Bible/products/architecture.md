# Products & Landing Page — Architecture

## The five products, and which real page each one hands off to

`src/data/productsData.js` is the canonical list — five entries, each with
`id`, `name`, `description`, `price`, `imagePlaceholder`, `category`,
`sku`, and either a `link` or `isCustomQuote: true`. `MainLandingPage.js`
imports this array directly (`products[0]` through `products[4]`) rather
than duplicating names/prices/skus as literals, so the two stay in sync
automatically if the data file ever changes.

| # | Product | Real destination | How it's reached |
|---|---|---|---|
| 0 | LED Lumina Mirror | `ProductPageClean.js` | `link: "product"` → `/#product` |
| 1 | Side-lit Acrylic Designer (**wall**, fixed-ish 30×30cm) | `AffiliateProductPageCleanAccryl.js` | `link: "affiliate-product-accryl"` → `/#affiliate-product-accryl` |
| 2 | Custom Shape Mirror | *(none — quote modal)* | `isCustomQuote: true` → opens `MainLandingPage.js`'s own modal, no navigation |
| 3 | Stencil Generator | `StencilGenerator.js` | `link: "tools/stencil-generator"` → `/tools/stencil-generator` (a real path, not a hash) |
| 4 | Side-lit Acrylic Sign — Desk Mounted | `AffiliateProductPageCleanAccryl.js` (same page as #1) | `link: "affiliate-product-accryl"` |

The link-resolution logic (`computeProductHref` in `MainLandingPage.js`)
is a deliberate line-for-line copy of what `Products.js`'s own
`handleProductSelect` already did before this session — same three
branches (absolute/`#`-prefixed link used verbatim, a link containing `/`
becomes a real path, anything else becomes `/#link`). Copied rather than
imported because `Products.js` no longer renders on the homepage but
still exists and is used elsewhere (its own `handleProductSelect` is
`export`-free, defined inline) — see "Why `Products.js` still exists"
below.

**Note products #1 and #4 point at the exact same real page.** That page
was built assuming one fixed 30×30cm product; it's now shared by two
conceptually different marketing entries (a fixed wall panel and a cut-
to-shape desk sign) with a size selector on each banner. How that
selection actually reaches the shared page is the single most important
thing to understand in this codebase area — see "The acrylic size
hand-off" below, and `gotchas.md` for the Lumina Mirror's *un-fixed*
version of the same problem.

## Why `Products.js` still exists but isn't used

`src/components/products/Products.js` (the old product grid + its inline
custom-quote modal + a "Bring your ideas to light" signup banner) was the
homepage's product section before this session. It's not imported by
`App.js` anymore, but the file wasn't deleted — it's low-risk to leave
(no other file imports it either, confirmed by grep before assuming
that's safe to state), and deleting working code that isn't causing a
problem wasn't asked for. Same reasoning applies to `Hero.js`,
`HeroRedesign.jsx`, and `TestimonialsSlider.js` — all still present,
none rendered from the homepage anymore. `TestimonialsSlider.js`
specifically should **not** be revived as-is if anyone's tempted — it's
four fabricated named reviews with quotes about features that don't
exist (AI skin-health insights, circadian rhythm sync) sitting behind a
real "Verified by Endorsed.Review" badge. Left alone, not fixed, because
fixing content-authenticity issues wasn't in scope for a component that
isn't even live anymore.

## The acrylic size hand-off (the part that actually works)

`src/data/acrylicSizes.js` exports `WALL_ACRYLIC_SIZES` and
`DESK_ACRYLIC_SIZES` — each entry `{ key, label, price }` — plus
`findAcrylicSize(key)` and `priceToAmount(priceString)` ("£39.99" →
"39.99"). Both `MainLandingPage.js` and
`AffiliateProductPageCleanAccryl.js` import from this one file. This
exists specifically so the landing page's size buttons and the real
checkout page can't quietly disagree about what something costs — see
`gotchas.md` for what happened before this existed.

The hand-off, step by step:

1. Each acrylic banner keeps its own `useState` index into its sizes
   array (`deskAcrylicSize`, `wallAcrylicSize`) — clicking a size pill
   just updates that index, which drives the displayed price
   (`WALL_ACRYLIC_SIZES[wallAcrylicSize].price` etc.) live, no navigation.
2. Clicking "Start Designing" calls `goToProduct(product, sizeKey)` —
   `sizeKey` being `WALL_ACRYLIC_SIZES[wallAcrylicSize].key` (e.g.
   `"30x40"`), passed only by the two acrylic banners (the other three
   products call `goToProduct(product)` with no second argument).
3. `goToProduct` builds the href as usual via `computeProductHref`, then
   — only if `sizeKey` was passed — rewrites it from `/#affiliate-
   product-accryl` to `/?size=30x40#affiliate-product-accryl`. The query
   string goes **before** the hash deliberately: `App.js`'s router reads
   `window.location.hash` verbatim as the page name
   (`getInitialPage()`/its hashchange listener), so anything appended
   *inside* the hash (`#affiliate-product-accryl?size=30x40`) would
   change the literal string being matched against `currentPage ===
   'affiliate-product-accryl'` and silently break routing. Putting it in
   `location.search` instead keeps it completely invisible to the router.
4. `AffiliateProductPageCleanAccryl.js`'s `ProductPage()` resolves this
   once on mount via `useState(resolveAcrylicSize)` (lazy initializer, so
   `window.location.search` is only read once, not on every render).
   `resolveAcrylicSize()` reads `?size=`, looks it up with
   `findAcrylicSize`, and falls back to the standard 30×30cm/£29.99 wall
   entry if the param is missing or unrecognised — so a direct visit
   (bookmark, typed URL, old link) still gets a sensible default instead
   of breaking.
5. The resolved `{ label, price }` then drives **five** separate spots in
   that file that used to be hardcoded literals: the sticky header title
   (`AppHeader`'s `sizeLabel` prop), two on-page price displays, the
   `PayPalButton`'s `amount` prop (i.e. what's actually charged), and the
   `orderData.pricing`/`metadata.productSize` fields written to Firebase
   on purchase (see `database.md`).

**This mechanism only exists for the two acrylic products.** It is not a
generic "pass a size to any product" system — extending it to the Lumina
Mirror would mean building the equivalent read-the-query-string logic
into `ProductPageClean.js` from scratch (see `gotchas.md`).

## Image and video assets — real imports, not base64

Every photo/video used in `MainLandingPage.js` is a real file under
`src/components/landing/image/` (plus two font files and the hero photo
reused directly from `src/components/affiliate/` via a relative import —
deliberately not duplicated), imported normally
(`import edgelitBanner from './image/edgelit-banner.jpg'`) so CRA's
webpack pipeline emits them as real hashed static files
(`build/static/media/...`) and returns a URL string, used directly in
inline `style={{ backgroundImage: \`url(${edgelitBanner})\` }}`-style CSS
inside the component's own `<style>{...}</style>` template literal.

This is a different technique from the artifact-tester phase that
preceded this page's real build — those Claude Artifact prototypes had to
inline every image as a base64 `data:` URI (an artifact is a single
self-contained HTML file with no separate asset server), which produced
multi-hundred-KB-per-image bloat acceptable for a private preview but
never carried over into the real component. If you're ever converting
another artifact tester into real code, this is the swap to make: base64
`data:` URIs become relative file imports.

Every photo used started life as a multi-megabyte raw phone/AI-generated
image and was run through `sharp` (already a project dependency) before
being committed — `resize({ width: 1920 })` for full-bleed banners
(smaller for inset thumbnails/posters), `.jpeg({ quality: 78, mozjpeg:
true })`. The one video (`lumina-bg.mp4`, the colour-cycling "Your Custom
Design" sign demo) started as a 152MB, 71-second source clip — trimmed to
an 8-second loop and heavily compressed with `ffmpeg`
(`-vf scale=960:-2,fps=24 -an -crf 30`) down to ~300KB before being
imported the same way as the images (`<source src={luminaBgVideo}
type="video/mp4" />`), autoplay+muted+loop+playsInline.

### The `raw-uploads/` convention (read this before adding new product photos)

CRA copies the **entire** `public/` folder into every build, verbatim,
no matter what's actually imported by the app. Real product photos get
saved to `public/images/products/` by convention (that's where the
original four products' images already lived) — but when raw,
uncompressed originals (some of them 1–2MB, one of them 152MB) land in
that same folder waiting to be processed, a build+commit at that moment
would ship all of it, unprocessed, straight into the git history and the
live site. This actually happened mid-session and was caught before
committing.

The fix, and the convention going forward: raw originals get moved out of
`public/images/products/` into `raw-uploads/products/` (project root,
**gitignored** — added to `.gitignore` this session specifically for
this) as soon as a compressed copy has been made and imported into
`src/`. Nothing is ever deleted, just moved somewhere the build pipeline
can't see it. When adding a new product photo: compress with `sharp`
first, `cp` the small version into `src/components/landing/image/`,
*then* move the original out of `public/` into `raw-uploads/products/` —
don't leave both sitting in `public/` even briefly if you're about to run
a build.
