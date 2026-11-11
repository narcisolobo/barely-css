import { srgb8ToLinear, contrast } from './color.js';

/**
 * Computed colors may serialize as oklch(...), color(srgb ...) or rgb(...), so resolve through a
 * 1x1 canvas. Returns [r, g, b, a] with r, g, b in 0-255 and a in 0-255.
 */
export async function paintedRgba(locator, property, pseudo) {
  return locator.evaluate(
    (el, [prop, pseudoElt]) => {
      const css = getComputedStyle(el, pseudoElt || null)[prop];
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data];
    },
    [property, pseudo],
  );
}

/**
 * Composites background colors up the ancestor chain onto the root background (white if none).
 * With `fromParent`, the element's own background is left out (it is not behind its outline).
 */
export async function effectiveBackground(locator, { fromParent = false } = {}) {
  return locator.evaluate((el, skipSelf) => {
    const paint = (css) => {
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data];
    };
    const layers = [];
    for (let node = skipSelf ? el.parentElement : el; node; node = node.parentElement) {
      const [r, g, b, a] = paint(getComputedStyle(node).backgroundColor);
      if (a > 0) layers.push([r, g, b, a / 255]);
      if (a === 255) break;
    }
    // Start from opaque white (the canvas default) and composite from the farthest layer inward.
    let out = [255, 255, 255];
    for (const [r, g, b, a] of layers.reverse()) {
      out = [r, g, b].map((v, i) => Math.round(v * a + out[i] * (1 - a)));
    }
    return out;
  }, fromParent);
}

/** Describes the focus ring of document.activeElement; null when nothing is focused. */
export async function focusRingReport(page) {
  const handle = await page.evaluateHandle(() => {
    const el = document.activeElement;
    return el && el !== document.body && el !== document.documentElement ? el : null;
  });
  const element = handle.asElement();
  if (!element) return null;
  const base = await element.evaluate((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, Math.min(Math.max(cy, r.top + 1), innerHeight - 1, r.bottom - 1));
    return {
      id: el.closest('[data-kb-id]')?.getAttribute('data-kb-id') ?? null,
      tag: el.localName,
      center: [Math.round(cx), Math.round(cy), innerWidth, innerHeight],
      style: s.outlineStyle,
      width: parseFloat(s.outlineWidth),
      offset: parseFloat(s.outlineOffset),
      // A scroll container taller than the leftover viewport (a table's scroll wrapper) may be only partly in
      // view: Firefox scrolls a partly visible focus target no further. Its ring's near edge is then on screen.
      inViewport:
        (cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight) ||
        (/auto|scroll/.test(s.overflowX) && r.top < innerHeight && r.bottom > 0 && cx >= 0 && cx <= innerWidth),
      covered: !(hit && (hit === el || el.contains(hit))),
    };
  });
  const [r, g, b] = await paintedRgbaOfHandle(element, 'outlineColor');
  // An outline with offset >= 0 paints outside the border box, over the parent's backdrop;
  // a negative offset paints inside, over the element's own background.
  const bg = await effectiveBackgroundOfHandle(element, { fromParent: base.offset >= 0 });
  return { ...base, contrast: contrast(srgb8ToLinear([r, g, b]), srgb8ToLinear(bg)) };
}

// ElementHandle has evaluate(fn, arg) with the element as first argument, like Locator.evaluate,
// so the locator helpers work on a handle through this thin adapter.
const asLocator = (handle) => ({ evaluate: (fn, arg) => handle.evaluate(fn, arg) });
const paintedRgbaOfHandle = (handle, property) => paintedRgba(asLocator(handle), property);
const effectiveBackgroundOfHandle = (handle, opts) => effectiveBackground(asLocator(handle), opts);
