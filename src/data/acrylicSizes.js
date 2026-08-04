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

// "£39.99" -> "39.99", for PayPal amount props etc.
export function priceToAmount(priceString) {
  return (priceString || '').replace(/[^0-9.]/g, '');
}
