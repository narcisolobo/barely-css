// Computed colors may serialize as oklch(...), color(srgb ...) or rgb(...), so resolve through a canvas.
export async function paintedRgb(page, selector, property = 'backgroundColor') {
  return page.evaluate(
    ([sel, prop]) => {
      const css = getComputedStyle(document.querySelector(sel))[prop];
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
    },
    [selector, property],
  );
}
