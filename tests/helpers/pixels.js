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

/**
 * Dominant RGB color in a vertical strip of a PNG, between `from` and `to` (fractions of the width), ignoring
 * `inset` pixels at the top and bottom. Pass a strip that is always filled, or never filled, to read the fill or the track.
 */
export function dominantColor(png, { from, to, inset = 0 }) {
  const { width, height, data } = PNG.sync.read(png);
  const counts = new Map();
  for (let y = inset; y < height - inset; y++) {
    for (let x = Math.floor(width * from); x < Math.ceil(width * to); x++) {
      const i = (y * width + x) * 4;
      const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
}

/** Fraction of the rows in one pixel column (x as a fraction of the width) whose color is within `tol` of `rgb`. */
export function columnMatch(png, { x, rgb, tol = 8 }) {
  const { width, height, data } = PNG.sync.read(png);
  const col = Math.floor(width * x);
  let hit = 0;
  for (let y = 0; y < height; y++) {
    const i = (y * width + col) * 4;
    if ([0, 1, 2].every((k) => Math.abs(data[i + k] - rgb[k]) <= tol)) hit++;
  }
  return hit / height;
}

export const near = (got, want, tol = 8) => got.every((v, i) => Math.abs(v - want[i]) <= tol);
