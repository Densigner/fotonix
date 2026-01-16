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
    name: "Custom Shape Mirror - Made to Order",
    description: "Create your perfect mirror! We can cut any shape you imagine - hexagon, oval, star, or your own custom design. Professional edge polishing included.",
    price: "£79.99",
    buttonLabel: "Get Custom Quote",
    imagePlaceholder: "/images/products/lucasroomtwo.jpg",
    category: "custom-mirrors",
    sku: "FTX-CST-SHP-001",
    isCustomQuote: true
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
  }
];

export default products;
