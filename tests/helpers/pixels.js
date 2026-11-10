import { PNG } from 'pngjs';

/**
 * Counts distinct RGB colors in a PNG, ignoring a border of `inset` pixels.
 * Used to prove an element paints visibly (a bar, a chevron) without comparing exact values.
 */
export function distinctColorCount(png, { inset = 0 } = {}) {
  const { width, height, data } = PNG.sync.read(png);
  const colors = new Set();
  for (let y = inset; y < height - inset; y++) {
    for (let x = inset; x < width - inset; x++) {
      const i = (y * width + x) * 4;
      colors.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    }
  }
  return colors.size;
}
