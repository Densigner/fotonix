// sections.js - simple helpers for page sections
export const uid = (p = "s") => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export function createSection(type) {
  switch (type) {
    case "hero":
      return {
        id: uid("hero"),
        type,
        data: {
          title: "Welcome to my store",
          subtitle: "Curated picks I love",
          align: "center",
          overlay: 0.35,
          cta: { label: "Shop now", href: "#products" },
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
        },
      };
    case "rich-text":
      return {
        id: uid("rt"),
        type,
        data: { html: "<p>Tell your story here…</p>", align: "left", maxWidth: 720 },
      };
    case "faq":
      return { id: uid("faq"), type, data: { items: [{ q: "What is shipping time?", a: "2-5 business days." }] } };
    case "heading":
      return { id: uid("heading"), type, data: { text: "Welcome to my store", size: 32, align: "center" } };
    case "paragraph":
      return { id: uid("para"), type, data: { text: "Curated picks I love", width: 700, align: "center" } };
    case "image":
      return { id: uid("img"), type, data: { url: "", widthPct: 100, radius: 16, shadow: true, actionType: "none" } };
    case "button":
      return { id: uid("btn"), type, data: { label: "Follow me", href: "#", style: "default", full: false, actionType: "link" } };
    default:
      return { id: uid("sec"), type, data: {} };
  }
}

export default { uid, createSection };