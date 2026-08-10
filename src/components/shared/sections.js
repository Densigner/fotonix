// sections.js - simple helpers for page sections
export const uid = (p = "s") => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export function createSection(type) {
  switch (type) {
    case "hero":
      return {
        id: uid("hero"),
        type,
        data: {
          title: "Good things, chosen carefully",
          subtitle: "A small, considered edit — not everything, just what's worth owning",
          align: "center",
          overlay: 0.35,
          // No default CTA link: the old "#products" anchor doesn't point
          // at anything real anymore (there's no longer a hardcoded
          // Products section with that id -- products are just a block
          // like anything else, if the page even has one). Leaving both
          // empty means no CTA button renders at all until someone
          // deliberately sets one in the Inspector.
          cta: { label: "", href: "" },
          tone: "default",
        },
      };
    case "collection-grid":
      return {
        id: uid("grid"),
        type,
        data: {
          title: "The edit", productIds: [], columns: { base: 1, sm: 2, md: 3, lg: 4 }, showPrice: true, showCTA: true,
          // displayMode "all" shows every active product instead of the
          // curated productIds list; "featured" pulls one product out into
          // a large hero card above the grid.
          displayMode: "curated", featured: false, featuredProductId: "",
          tone: "default",
        },
      };
    case "rich-text":
      return {
        id: uid("rt"),
        type,
        data: {
          html: "<p>Every piece here earns its place — picked for how it looks, how it lasts, and how it actually gets used. That's the whole philosophy, in one sentence.</p>",
          align: "left", maxWidth: 720, tone: "default",
        },
      };
    case "faq":
      return {
        id: uid("faq"), type,
        data: {
          items: [
            { q: "How fast is shipping?", a: "Most orders ship within 1-2 business days and arrive within the week." },
            { q: "What's the return policy?", a: "30 days, no questions asked, full refund." },
          ],
          tone: "muted",
        },
      };
    case "heading":
      return { id: uid("heading"), type, data: { text: "Made to be used, not just looked at", size: 32, align: "center", tone: "default" } };
    case "paragraph":
      return { id: uid("para"), type, data: { text: "No filler, nothing forgettable — just a short list of things worth the money.", width: 700, align: "center", tone: "default" } };
    case "image":
      return { id: uid("img"), type, data: { url: "", widthPct: 100, radius: 16, shadow: true, actionType: "none" } };
    case "button":
      return { id: uid("btn"), type, data: { label: "Shop now", href: "", style: "default", full: false, actionType: "link" } };
    case "testimonial":
      // Deliberately reads as a builder instruction, not a real quote --
      // an invented "customer" name/quote here could get published as-is
      // if an owner forgets to replace it before hitting Save, which would
      // read as a fabricated review. Only the honest, self-aware version
      // ships as a default.
      return { id: uid("testi"), type, data: { quote: "Paste a real quote from a real customer here — their exact words work better than anything written for them.", name: "", role: "", photo: "", tone: "muted" } };
    case "endorsed-review":
      return { id: uid("reviews"), type, data: { widgetType: "basic-stars", themeMode: "light", branding: true, tone: "default" } };
    case "split":
      return {
        id: uid("split"),
        type,
        data: {
          eyebrow: "Why it's different", heading: "Built around how you'll actually use it",
          body: "Not another spec sheet — say plainly what makes this worth its price, and who it's actually for.",
          cta: { label: "", href: "" }, media: { url: "", focal: "" }, variant: "media-left", tone: "default",
        },
      };
    case "columns":
      return {
        id: uid("cols"),
        type,
        data: {
          heading: "", variant: "icon", tone: "default",
          items: [
            { icon: "truck", title: "Fast shipping", text: "Out the door in 1-2 days." },
            { icon: "shield", title: "Guaranteed", text: "30-day money-back guarantee." },
            { icon: "headphones", title: "Real support", text: "A real person, not a bot." },
          ],
        },
      };
    default:
      return { id: uid("sec"), type, data: {} };
  }
}

export default { uid, createSection };