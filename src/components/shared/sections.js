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
        data: { title: "Featured", productIds: [], columns: { base: 1, sm: 2, md: 3, lg: 4 }, showPrice: true, showCTA: true },
      };
    case "rich-text":
      return {
        id: uid("rt"),
        type,
        data: { html: "<p>Tell your story here…</p>", align: "left", maxWidth: 720 },
      };
    case "faq":
      return { id: uid("faq"), type, data: { items: [{ q: "What is shipping time?", a: "2-5 business days." }] } };
    default:
      return { id: uid("sec"), type, data: {} };
  }
}

export default { uid, createSection };