import { normalizeHex, isValidHex } from './hexGridToPng';

test('normalizeHex expands short hex and lowercases', () => {
  expect(normalizeHex('fff')).toBe('#ffffff');
  expect(normalizeHex('#AbC')).toBe('#aabbcc');
  expect(normalizeHex('#123456')).toBe('#123456');
});

test('isValidHex detects 6-digit hex only', () => {
  expect(isValidHex('#123456')).toBe(true);
  expect(isValidHex('#abc')).toBe(false);
  expect(isValidHex('nothex')).toBe(false);
});
