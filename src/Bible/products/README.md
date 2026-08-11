# Products & Landing Page — Bible

How the main customer landing page and its five real products are built,
priced, photographed, and — the part that actually matters — how (and
whether) an order for each one ends up saved anywhere. Written after
replacing the whole homepage this session (`Hero`/`Products`/
`TestimonialsSlider` → one new component) and shipping four rounds of
follow-up fixes, so this reflects what's actually live, not a plan.

## Files in this folder

- **`architecture.md`** — how `MainLandingPage.js` is put together: the
  product banners, the size selectors, real navigation (how a click here
  actually reaches a real designer/checkout page), and the image/video
  asset pipeline (compression, `raw-uploads/`, why these are real imports
  and not base64).
- **`database.md`** — where an order for each of the five products
  actually lands, and the one product where nothing is saved anywhere yet.
- **`gotchas.md`** — the real bug found and fixed (size picker was
  cosmetic, price didn't match the checkout charge) plus the one still
  open (same bug, different product, not yet fixed).

## The one-sentence version

`MainLandingPage.js` is a marketing/discovery layer in front of three
pre-existing (mostly unrelated) real designer pages, shared across five
marketing entries — it doesn't do any
checkout itself; every "Start Designing"/"View Product" button hands off
to whichever real tool already existed for that product, and the landing
page's job is just to get the visitor there with the right size/price
already communicated (see `gotchas.md` for how incompletely that hand-off
actually works today).

## Fastest orientation

- The landing page itself: `src/components/landing/MainLandingPage.js`
  (self-contained — embedded `<style>` block, all `mlp-` prefixed classes
  so it can't collide with any other page's CSS, no shared layout beyond
  the real global `Header`/`Footer` App.js already wraps every page in)
- Wired in at `App.js`'s `currentPage === 'home'` case — replaced
  `<Hero/>`/`<HeroRedesign/>`, `<InfoBar/>`, `<Products/>`,
  `<TestimonialsSlider/>` entirely (those component files still exist,
  just no longer rendered from here — see `architecture.md` if you're
  wondering why `Products.js` still exists but the homepage doesn't use
  it)
- The five products, canonical data: `src/data/productsData.js`
- Acrylic sizing (all three acrylic/mirror products share this):
  `src/data/acrylicSizes.js` — the single source both the landing page
  and the real designer page read, on purpose (see `gotchas.md` for what
  happens when two pages each hardcode their own copy of "the price")
- The three real destination pages a click can land on:
  `src/components/products/ProductPageClean.js` (Lumina Mirror, hash
  `#product`), `src/components/products/AffiliateProductPageCleanAccryl.js`
  (all three acrylic/mirror products — wall panel, desk sign, and Custom
  Shape Mirror via `?material=mirror` — hash `#affiliate-product-accryl`),
  and `src/components/stencilUpload/StencilGenerator.js` (path
  `/tools/stencil-generator`). Custom Shape Mirror does **not** open a
  quote-request modal — that was true of an earlier version of the page;
  see the correction note in `database.md`.

## Deploying a change in this area

Same manual process as the rest of the codebase (see
`../emails/README.md`): `CI=false npm run build`, `git add` the specific
changed `src/` files plus the resulting `build/` files (never
`git add -A` — see "the raw-uploads convention" in `architecture.md` for
exactly why), commit, push, then on the VPS: `git pull` inside
`/home/fotonixc/fotonix-repo`, `cp -r build/* /home/fotonixc/public_html/`.
Verify with `curl -s https://fotonix.co.uk | grep -o 'main\.[a-z0-9]*\.js'`
and compare against what you just built.
