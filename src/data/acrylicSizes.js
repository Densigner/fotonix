// Shared size/price tables for the two Side-lit Acrylic products, so the
// landing page banners and the real designer/checkout page (which both
// route through the same tool) can never show different numbers.

// Wall-mounted panel — priced off £29.99 for 30x30cm (~£0.033/cm²).
export const WALL_ACRYLIC_SIZES = [
  { key: '20x30', label: '20 × 30 cm', price: '£19.99' },
  { key: '30x30', label: '30 × 30 cm', price: '£29.99' },
  { key: '30x40', label: '30 × 40 cm', price: '£39.99' },
  { key: '30x50', label: '30 × 50 cm', price: '£49.99' },
];

// Desk-mounted, cut-to-shape sign — rough size bands, same tool.
export const DESK_ACRYLIC_SIZES = [
  { key: 'small', label: 'Small · ~6 × 10 cm', price: '£24.99' },
  { key: 'medium', label: 'Medium · ~12 × 18 cm', price: '£34.99' },
  { key: 'large', label: 'Large · ~20 × 28 cm', price: '£49.99' },
  { key: 'xl', label: 'XL · 30 × 40 cm', price: '£69.99' },
];

export const DEFAULT_WALL_ACRYLIC_SIZE_KEY = '30x30';
export const DEFAULT_DESK_ACRYLIC_SIZE_KEY = 'small';

export function findAcrylicSize(sizeKey) {
  return (
    WALL_ACRYLIC_SIZES.find((s) => s.key === sizeKey) ||
    DESK_ACRYLIC_SIZES.find((s) => s.key === sizeKey) ||
    null
  );
}

// The desk sign is cut to its own shape; the wall panel is a fixed
// rectangle — used to decide which mockup preview (cut-to-shape vs plate)
// the shared designer page should show for the currently-selected size.
export function isDeskAcrylicSize(sizeKey) {
  return DESK_ACRYLIC_SIZES.some((s) => s.key === sizeKey);
}

// "£39.99" -> "39.99", for PayPal amount props etc.
export function priceToAmount(priceString) {
  return (priceString || '').replace(/[^0-9.]/g, '');
}

// The desk sign ("Custom Shape Sign") is cut to whatever shape the customer
// draws, in one of two materials. They're lit completely differently — clear
// acrylic carries LED light through the sheet and out at the cut edges and
// any engraving ("edge-lit"); a mirror is opaque, so the same LED strip
// instead shines from behind it, spilling a soft halo out around the
// perimeter ("back-lit"). The material name is shown to the customer, so it
// has to reflect which of those it actually is, not a generic "lit" label.
export const MATERIALS = [
  { key: 'acrylic', label: 'Acrylic', lightingLabel: 'Edge-Lit Acrylic' },
  { key: 'mirror', label: 'Mirror', lightingLabel: 'Back-Lit Mirror' },
];
export const DEFAULT_MATERIAL_KEY = 'acrylic';

export function findMaterial(materialKey) {
  return MATERIALS.find((m) => m.key === materialKey) || MATERIALS.find((m) => m.key === DEFAULT_MATERIAL_KEY);
}

// Mirror costs more than acrylic at the same size — heavier glass, silvering,
// and a much higher breakage risk in transit.
export const MIRROR_PRICE_MULTIPLIER = 1.4;

// Applies the mirror premium to a base (acrylic) "£24.99"-style price string.
export function priceForMaterial(basePriceString, materialKey) {
  const base = parseFloat(priceToAmount(basePriceString));
  if (!isFinite(base)) return basePriceString;
  const amount = materialKey === 'mirror' ? base * MIRROR_PRICE_MULTIPLIER : base;
  return `£${amount.toFixed(2)}`;
}
