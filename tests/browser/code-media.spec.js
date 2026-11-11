import { test, expect } from '@playwright/test';
import { DEMO } from '../helpers/env.js';
import { paintedRgba, effectiveBackground } from '../helpers/page-color.js';
import { srgb8ToLinear, contrast } from '../helpers/color.js';

test.describe('narrow', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('wide img, video and iframe never overflow at 375', async ({ page }) => {
    await page.goto('/tests/pages/code-media.html');
    const r = await page.evaluate(() => {
      const root = document.documentElement;
      const main = document.querySelector('main').getBoundingClientRect();
      const boxes = ['#wide-img', '#wide-video', '#wide-iframe'].map((s) => {
        const b = document.querySelector(s).getBoundingClientRect();
        return { s, left: b.left, right: b.right, width: b.width };
      });
      return { scroll: root.scrollWidth, client: root.clientWidth, main: { left: main.left, right: main.right }, boxes };
    });
    expect(r.scroll).toBeLessThanOrEqual(r.client);
    for (const b of r.boxes) {
      expect(b.width, b.s).toBeGreaterThan(0);
      expect(b.left, b.s).toBeGreaterThanOrEqual(r.main.left - 0.5);
      expect(b.right, b.s).toBeLessThanOrEqual(r.main.right + 0.5);
    }
  });

  test('long pre scrolls inside itself', async ({ page }) => {
    await page.goto('/tests/pages/code-media.html');
    const r = await page.evaluate(() => {
      const pre = document.querySelector('#long-pre');
      const root = document.documentElement;
      return {
        inner: pre.scrollWidth > pre.clientWidth,
        overflowX: getComputedStyle(pre).overflowX,
        page: root.scrollWidth <= root.clientWidth,
      };
    });
    expect(r.inner).toBe(true);
    expect(r.overflowX).toBe('auto');
    expect(r.page).toBe(true);
  });
});

test('iframe with a height attribute keeps it', async ({ page }) => {
  await page.goto('/tests/pages/code-media.html');
  const h = await page.locator('#with-height').evaluate((el) => el.getBoundingClientRect().height);
  expect(h).toBeCloseTo(150, 0);
});

test('iframe without one is 16:9', async ({ page }) => {
  await page.goto('/tests/pages/code-media.html');
  const r = await page.locator('#no-height').evaluate((el) => {
    const b = el.getBoundingClientRect();
    return { w: b.width, h: b.height, aspect: getComputedStyle(el).aspectRatio };
  });
  expect(r.w / r.h).toBeCloseTo(16 / 9, 1);
});

for (const theme of ['light', 'dark']) {
  test(`code text meets 4.5:1 on surface (${theme})`, async ({ page }) => {
    await page.goto(DEMO);
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    for (const sel of ['#code p code', '#code pre code', '#code kbd', '#code samp']) {
      const el = page.locator(sel).first();
      await el.scrollIntoViewIfNeeded();
      const surface = await page.evaluate(
        () => getComputedStyle(document.documentElement).getPropertyValue('--barely-color-surface'),
      );
      expect(surface).not.toBe('');
      const host = sel === '#code pre code' ? page.locator('#code pre').first() : el;
      const bg = await effectiveBackground(host);
      const bodyBg = await effectiveBackground(page.locator('#code h2'));
      expect(bg, `${sel} paints a surface`).not.toEqual(bodyBg);
      const fg = await paintedRgba(el, 'color');
      expect(contrast(srgb8ToLinear(fg.slice(0, 3)), srgb8ToLinear(bg)), sel).toBeGreaterThanOrEqual(4.5);
    }
  });
}

test('code uses the mono stack at 0.875em, pre keeps its tab size', async ({ page }) => {
  await page.goto(DEMO);
  const r = await page.evaluate(() => {
    const p = document.querySelector('#code p');
    const c = p.querySelector('code');
    return {
      ratio: parseFloat(getComputedStyle(c).fontSize) / parseFloat(getComputedStyle(p).fontSize),
      family: /ui-monospace/.test(getComputedStyle(c).fontFamily) && /monospace$/.test(getComputedStyle(c).fontFamily),
      tab: getComputedStyle(document.querySelector('#code pre')).tabSize,
    };
  });
  expect(r.ratio).toBeCloseTo(0.875, 2);
  expect(r.family).toBe(true);
  expect(r.tab).toBe('4');
});

test('demo video and audio play sources are present and sized', async ({ page }) => {
  await page.goto(DEMO);
  const r = await page.evaluate(() => {
    const main = document.querySelector('main').getBoundingClientRect();
    const a = document.querySelector('#media audio').getBoundingClientRect();
    return { audioFull: Math.abs(a.width - main.width) < 2 || a.width > 200, tracks: document.querySelectorAll('#media video track').length };
  });
  expect(r.audioFull).toBe(true);
  expect(r.tracks).toBe(1);
});
