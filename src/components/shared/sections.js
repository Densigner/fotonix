// sections.js - simple helpers for page sections
export const uid = (p = "s") => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export function createSection(type) {
  switch (type) {
    case "hero":
      return {
        id: uid("hero"),
        type,
        data: {
          title: "Your store's headline",
          subtitle: "A line that says what makes it worth buying",
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
          title: "Featured", productIds: [], columns: { base: 1, sm: 2, md: 3, lg: 4 }, showPrice: true, showCTA: true,
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
        data: { html: "<p>Tell your story here…</p>", align: "left", maxWidth: 720, tone: "default" },
      };
    case "faq":
      return { id: uid("faq"), type, data: { items: [{ q: "What is shipping time?", a: "2-5 business days." }], tone: "muted" } };
    case "heading":
      return { id: uid("heading"), type, data: { text: "Your store's headline", size: 32, align: "center", tone: "default" } };
    case "paragraph":
      return { id: uid("para"), type, data: { text: "A line that says what makes it worth buying", width: 700, align: "center", tone: "default" } };
    case "image":
      return { id: uid("img"), type, data: { url: "", widthPct: 100, radius: 16, shadow: true, actionType: "none" } };
    case "button":
      return { id: uid("btn"), type, data: { label: "Follow me", href: "#", style: "default", full: false, actionType: "link" } };
    case "testimonial":
      return { id: uid("testi"), type, data: { quote: "What a customer actually said, word for word.", name: "", role: "", photo: "", tone: "muted" } };
    case "endorsed-review":
      return { id: uid("reviews"), type, data: { widgetType: "basic-stars", themeMode: "light", branding: true, tone: "default" } };
    case "split":
      return {
        id: uid("split"),
        type,
        data: {
          eyebrow: "", heading: "Made for how you actually use it", body: "A line or two on what makes this worth buying.",
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