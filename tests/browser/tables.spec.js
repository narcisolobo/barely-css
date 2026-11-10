import { test, expect } from '@playwright/test';
import { DEMO } from '../helpers/env.js';
import { paintedRgba, effectiveBackground } from '../helpers/page-color.js';
import { srgb8ToLinear, contrast } from '../helpers/color.js';

test('table keeps display: table', async ({ page }) => {
  await page.goto('/tests/pages/tables.html');
  const d = await page.evaluate(() => [...document.querySelectorAll('table')].map((t) => getComputedStyle(t).display));
  expect(d).toEqual(['table', 'table']);
});

test.describe('narrow', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('table with a long URL fits at 375', async ({ page }) => {
    await page.goto('/tests/pages/tables.html');
    const r = await page.evaluate(() => {
      const root = document.documentElement;
      const table = document.querySelector('#url-table').getBoundingClientRect();
      const cells = [...document.querySelectorAll('#url-table td')].map((c) => c.getBoundingClientRect());
      return {
        scroll: root.scrollWidth,
        client: root.clientWidth,
        table: { left: table.left, right: table.right },
        cells: cells.map((c) => ({ left: c.left, right: c.right })),
      };
    });
    expect(r.scroll).toBeLessThanOrEqual(r.client);
    for (const c of r.cells) {
      expect(c.left).toBeGreaterThanOrEqual(r.table.left - 0.5);
      expect(c.right).toBeLessThanOrEqual(r.table.right + 0.5);
    }
  });

  test('wrapped wide table scrolls inside its wrapper, not the page', async ({ page }) => {
    await page.goto('/tests/pages/tables.html');
    const r = await page.evaluate(() => {
      const root = document.documentElement;
      const w = document.querySelector('#wrapper');
      return {
        page: root.scrollWidth <= root.clientWidth,
        wrapperOverflows: w.scrollWidth > w.clientWidth,
        overflowX: getComputedStyle(w).overflowX,
      };
    });
    expect(r.page).toBe(true);
    expect(r.wrapperOverflows).toBe(true);
    expect(r.overflowX).toBe('auto');
  });

  test('wrapped table drops its bottom margin; the wrapper keeps one', async ({ page }) => {
    await page.goto('/tests/pages/tables.html');
    const r = await page.evaluate(() => ({
      table: getComputedStyle(document.querySelector('#wide')).marginBottom,
      wrapper: parseFloat(getComputedStyle(document.querySelector('#wrapper')).marginBottom),
    }));
    expect(r.table).toBe('0px');
    expect(r.wrapper).toBeGreaterThan(0);
  });
});

test('wrapper shows the focus ring', async ({ page }) => {
  await page.goto('/tests/pages/tables.html');
  await page.keyboard.press('Tab');
  const r = await page.evaluate(() => {
    const el = document.activeElement;
    const s = getComputedStyle(el);
    return { id: el.id, matches: el.matches(':focus-visible'), style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
  });
  expect(r.id).toBe('wrapper');
  expect(r.matches).toBe(true);
  expect(r.style).toBe('solid');
  expect(r.width).toBeGreaterThanOrEqual(2);
});

for (const theme of ['light', 'dark']) {
  test(`stripe rows have 4.5:1 text contrast (${theme})`, async ({ page }) => {
    await page.goto(DEMO);
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    const even = page.locator('#grades tbody tr:nth-child(even) td').first();
    const bg = await effectiveBackground(even);
    const odd = await effectiveBackground(page.locator('#grades tbody tr:nth-child(odd) td').first());
    expect(bg).not.toEqual(odd); // the stripe is actually painted
    const fg = await paintedRgba(even, 'color');
    expect(contrast(srgb8ToLinear(fg.slice(0, 3)), srgb8ToLinear(bg))).toBeGreaterThanOrEqual(4.5);
  });
}
