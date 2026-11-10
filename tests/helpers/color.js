// Pure color helpers for the contrast tests. No browser needed.

/** Parse `--barely-color-*: light-dark(oklch(...), oklch(...))` declarations. */
export function parseColorTokens(css) {
  const out = new Map();
  const re = /--barely-color-([\w-]+)\s*:\s*light-dark\(\s*oklch\(([^)]*)\)\s*,\s*oklch\(([^)]*)\)\s*\)/g;
  const nums = (s) => s.trim().split(/\s+/).map(Number);
  for (const m of css.matchAll(re)) out.set(m[1], { light: nums(m[2]), dark: nums(m[3]) });
  return out;
}

/** primary-hover: lightness -0.07 in light, +0.07 in dark; chroma and hue unchanged. */
export function deriveHover([l, c, h], theme) {
  return [theme === 'light' ? l - 0.07 : l + 0.07, c, h];
}

/** OKLCH to linear sRGB (Ottosson matrices), each channel clamped to [0, 1]. */
export function oklchToLinearSrgb([L, C, h]) {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ].map((v) => Math.min(1, Math.max(0, v)));
}

/** 0-255 sRGB channels to linear. */
export function srgb8ToLinear(rgb) {
  return rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
}

export function luminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(linearA, linearB) {
  const a = luminance(linearA);
  const b = luminance(linearB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
