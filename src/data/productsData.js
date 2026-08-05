// productsData.js
// Export the products array separately to keep component files smaller.
const products = [
  {
    id: 1,
    name: "LED Lumina Mirror - Classic Rectangle",
    description: "Transform your space with our premium LED mirror featuring warm white lighting, touch controls, and anti-fog technology. Perfect for bathrooms, bedrooms, or vanity areas.",
    price: "£29.99",
    imagePlaceholder: "/images/products/lucasroom.jpg",
    category: "bathroom-mirrors",
    sku: "FTX-LED-REC-001",
    link: "product"
  },
  {
    id: 2,
    name: "Side-lit Acrylic Designer",
    description: "Create stunning edge-lit acrylic signs and displays with our custom designer. Perfect for logos, names, and decorative pieces with vibrant LED illumination.",
    price: "£29.99",
    imagePlaceholder: "/images/products/noahsroom.jpg",
    category: "acrylic-signs",
    sku: "FTX-ACRYL-001",
    link: "affiliate-product-accryl"
  },
  {
    id: 3,
    name: "Custom Shape Sign - Back-Lit Mirror",
    description: "Cut to your own shape and mounted on a weighted base, just like our acrylic sign — but in mirror, back-lit for a soft glow around the edge instead of glowing engraving.",
    price: "From £34.99",
    imagePlaceholder: "/images/products/lucasroomtwo.jpg",
    category: "custom-mirrors",
    sku: "FTX-CST-SHP-MIRROR-001",
    link: "affiliate-product-accryl",
    linkQuery: "material=mirror"
  },
  {
    id: 4,
    name: "Stencil Generator",
    description: "Create custom stencils from any image! Upload your photo, adjust settings, and get a perfect printable stencil for spray painting, art projects, and crafts.",
    price: "£9.99",
    imagePlaceholder: "/images/products/stencil-generator-banner.png",
    category: "tools",
    sku: "FTX-STENCIL-001",
    link: "tools/stencil-generator",
    fullWidth: true
  },
  {
    id: 5,
    name: "Side-lit Acrylic Sign - Desk Mounted",
    description: "Cut to your own shape and mounted on a weighted base — not a fixed square panel. Perfect for logos, names, and desk or shelf display, from small nameplates to statement pieces.",
    price: "From £24.99",
    imagePlaceholder: "/images/products/EdgeLit.png",
    category: "acrylic-signs",
    sku: "FTX-ACRYL-DESK-001",
    link: "affiliate-product-accryl"
  }
];

export default products;
