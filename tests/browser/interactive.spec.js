import { test, expect } from '@playwright/test';
import { DEMO } from '../helpers/env.js';
import { PNG } from 'pngjs';
import { distinctColorCount } from '../helpers/pixels.js';

test.beforeEach(async ({ page }) => {
  await page.goto(DEMO);
});

test.describe('dialog at 375', () => {
  test.use({ viewport: { width: 375, height: 700 } });

  test('dialog fits at 375', async ({ page }) => {
    await page.locator('[commandfor="demo-dialog"][command="show-modal"]').click();
    const dialog = page.locator('#demo-dialog');
    await expect(dialog).toBeVisible();
    const r = await dialog.evaluate((el) => {
      const b = el.getBoundingClientRect();
      const probe = document.createElement('div');
      probe.style.cssText = 'padding:0;inline-size:var(--barely-page-padding-inline)';
      document.body.append(probe);
      const pad = probe.getBoundingClientRect().width;
      probe.remove();
      return { left: b.left, right: innerWidth - b.right, pad };
    });
    // The 70ch cap is wider than the viewport here, so the dialog should sit exactly one page padding from each edge.
    expect(Math.abs(r.left - r.pad)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(r.right - r.pad)).toBeLessThanOrEqual(0.5);
  });
});

test('meter shows optimum, suboptimum and even-less-good in the status colors', async ({ page }) => {
  const token = (name) =>
    page.evaluate((n) => {
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      const probe = document.createElement('span');
      probe.style.color = `var(${n})`;
      document.body.append(probe);
      ctx.fillStyle = getComputedStyle(probe).color;
      probe.remove();
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
    }, name);
  // Dominant color in the left fifth of the meter, inside the border: that strip is always filled.
  const dominant = async (id) => {
    const { width, height, data } = PNG.sync.read(await page.locator(`#${id}`).screenshot());
    const counts = new Map();
    const inset = 3;
    for (let y = inset; y < height - inset; y++) {
      for (let x = inset; x < Math.floor(width * 0.05); x++) {
        const i = (y * width + x) * 4;
        const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
  };
  const near = (got, want) => got.every((v, i) => Math.abs(v - want[i]) <= 8);
  const cases = [
    ['meter-optimum', '--barely-color-success'],
    ['meter-suboptimum', '--barely-color-warning'],
    ['meter-even-less-good', '--barely-color-danger'],
  ];
  const seen = [];
  for (const [id, name] of cases) {
    const got = await dominant(id);
    const want = await token(name);
    expect(near(got, want), `${id} painted ${got}, ${name} is ${want}`).toBe(true);
    seen.push(got.join());
  }
  expect(new Set(seen).size).toBe(3);
});

test('progress paints a fill and a track', async ({ page }) => {
  const png = await page.locator('#demo-progress').screenshot();
  expect(distinctColorCount(png, { inset: 3 })).toBeGreaterThanOrEqual(2);
});

test('dialog and popover use the surface tokens', async ({ page }) => {
  await page.locator('[popovertarget="demo-popover"]').click();
  const s = await page.locator('#demo-popover').evaluate((el) => {
    const c = getComputedStyle(el);
    return { radius: c.borderStartStartRadius, border: c.borderBlockStartWidth };
  });
  expect(parseFloat(s.radius)).toBeGreaterThan(0);
  expect(parseFloat(s.border)).toBeGreaterThan(0);
});
