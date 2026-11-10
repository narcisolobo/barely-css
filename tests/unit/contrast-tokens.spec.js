import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parseColorTokens, deriveHover, oklchToLinearSrgb, contrast } from '../helpers/color.js';

const tokens = parseColorTokens(readFileSync('src/tokens.css', 'utf8'));

const BASE = ['background', 'surface', 'border', 'border-strong', 'text', 'text-muted',
  'primary', 'on-primary', 'mark', 'success', 'warning', 'danger'];

// [foreground, background, minimum] from the spec's contrast matrix: 7 rows, 19 pairs per theme.
const PAIRS = [
  ...['background', 'surface', 'mark'].map((bg) => ['text', bg, 4.5]),
  ...['background', 'surface'].map((bg) => ['text-muted', bg, 4.5]),
  ...['background', 'surface'].map((bg) => ['primary', bg, 4.5]),
  ...['background', 'surface'].map((bg) => ['primary-hover', bg, 4.5]),
  ...['primary', 'primary-hover'].map((bg) => ['on-primary', bg, 4.5]),
  ...['success', 'warning', 'danger'].flatMap((fg) => ['background', 'surface'].map((bg) => [fg, bg, 4.5])),
  ...['background', 'surface'].map((bg) => ['border-strong', bg, 3]),
];

function lch(name, theme) {
  if (name === 'primary-hover') return deriveHover(tokens.get('primary')[theme], theme);
  return tokens.get(name)[theme];
}
const lin = (name, theme) => oklchToLinearSrgb(lch(name, theme));
const ratio = (fg, bg, theme) => contrast(lin(fg, theme), lin(bg, theme));

test('the contrast matrix expands to 19 pairs', () => {
  expect(PAIRS).toHaveLength(19);
});

for (const theme of ['light', 'dark'])
  for (const [fg, bg, min] of PAIRS)
    test(`${theme}: ${fg} on ${bg} >= ${min}`, () => {
      expect(ratio(fg, bg, theme)).toBeGreaterThanOrEqual(min);
    });

test("pins the spec's reported ratios", () => {
  expect(ratio('border-strong', 'surface', 'light')).toBeCloseTo(3.46, 2);
  expect(ratio('warning', 'surface', 'light')).toBeCloseTo(4.78, 2);
  expect(ratio('primary-hover', 'background', 'light')).toBeCloseTo(7.82, 2);
  expect(ratio('primary-hover', 'background', 'dark')).toBeCloseTo(10.45, 2);
});

test('tokens.css declares the 12 base color tokens and not primary-hover', () => {
  expect([...tokens.keys()].sort()).toEqual([...BASE].sort());
  expect(readFileSync('src/tokens.css', 'utf8')).not.toMatch(/--barely-color-primary-hover\s*:/);
});
