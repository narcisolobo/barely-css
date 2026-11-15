import { test, expect } from '@playwright/test';
import { DEMO } from '../helpers/env.js';
import { dominantColor, columnMatch, near } from '../helpers/pixels.js';

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
  // Dominant color in a strip (3% to 8% across) that is filled for all three meters.
  const dominant = async (id) =>
    dominantColor(await page.locator(`#${id}`).screenshot(), { from: 0.03, to: 0.08, inset: 3 });
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

const cssColor = (page, value) =>
  page.evaluate((v) => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const probe = document.createElement('span');
    probe.style.color = v;
    document.body.append(probe);
    ctx.fillStyle = getComputedStyle(probe).color;
    probe.remove();
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
  }, value);

test('determinate progress fills with primary and leaves the rest as track', async ({ page }) => {
  const png = await page.locator('#demo-progress').screenshot();
  const filled = dominantColor(png, { from: 0.1, to: 0.4, inset: 3 });
  const empty = dominantColor(png, { from: 0.9, to: 0.95, inset: 3 });
  expect(near(filled, await cssColor(page, 'var(--barely-color-primary)')), `fill ${filled}`).toBe(true);
  expect(near(empty, await cssColor(page, 'var(--barely-color-surface)')), `track ${empty}`).toBe(true);
});

test('meter track is the flat surface color', async ({ page }) => {
  const png = await page.locator('#meter-even-less-good').screenshot();
  const empty = dominantColor(png, { from: 0.9, to: 0.95, inset: 3 });
  expect(near(empty, await cssColor(page, 'var(--barely-color-surface)')), `track ${empty}`).toBe(true);
});

test('meter fill spans the track interior', async ({ page }) => {
  const png = await page.locator('#meter-optimum').screenshot();
  const fill = dominantColor(png, { from: 0.1, to: 0.4, inset: 3 });
  // Rows of the column at 20% that hold the fill: the interior, minus the 1px border at each edge.
  const share = columnMatch(png, { x: 0.2, rgb: fill });
  const { height } = await page.locator('#meter-optimum').evaluate((el) => ({ height: el.getBoundingClientRect().height }));
  expect(share * height).toBeGreaterThanOrEqual(height - 4);
});

test('indeterminate progress keeps its native animation', async ({ page }) => {
  const bar = page.locator('#demo-progress-indeterminate');
  await bar.scrollIntoViewIfNeeded();
  const shots = [];
  for (let i = 0; i < 4; i++) {
    shots.push((await bar.screenshot()).toString('base64'));
    await page.waitForTimeout(300);
  }
  expect(new Set(shots).size).toBeGreaterThan(1);
});

test('dialog and popover use the surface tokens', async ({ page }) => {
  await page.locator('[popovertarget="demo-popover"]').click();
  await page.locator('[commandfor="demo-dialog"][command="show-modal"]').click({ trial: true }).catch(() => {});
  const bg = await cssColor(page, 'var(--barely-color-background)');
  const pad = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'padding:0;inline-size:calc(var(--barely-spacing) * 1.5)';
    document.body.append(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return w;
  });
  for (const id of ['demo-popover', 'demo-dialog']) {
    const r = await page.locator(`#${id}`).evaluate((el) => {
      const c = getComputedStyle(el);
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = c.backgroundColor;
      ctx.fillRect(0, 0, 1, 1);
      return { bg: [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3), pad: parseFloat(c.paddingInlineStart), radius: parseFloat(c.borderStartStartRadius) };
    });
    expect(near(r.bg, bg), `${id} background ${r.bg}`).toBe(true);
    expect(r.pad, id).toBeCloseTo(pad, 1);
    expect(r.radius, id).toBeGreaterThan(0);
  }
});
