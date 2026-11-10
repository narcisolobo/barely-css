import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
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

test('thead and tfoot rules paint in border-strong, row rules in border', async ({ page }) => {
  await page.goto(DEMO);
  const table = page.locator('#grades');
  await table.evaluate((t) => {
    t.style.setProperty('--barely-color-border', 'rgb(255 0 0)');
    t.style.setProperty('--barely-color-border-strong', 'rgb(0 0 255)');
    t.style.setProperty('--barely-color-surface', 'rgb(255 255 255)');
    t.style.setProperty('--barely-border-width', '6px');
    t.style.backgroundColor = 'rgb(255 255 255)';
    t.scrollIntoView();
  });
  const edges = await table.evaluate((t) => {
    const box = t.getBoundingClientRect();
    return {
      theadBottom: t.tHead.getBoundingClientRect().bottom - box.top,
      tfootTop: t.tFoot.getBoundingClientRect().top - box.top,
      betweenBody: t.tBodies[0].rows[0].getBoundingClientRect().bottom - box.top,
      x: t.rows[1].cells[1].getBoundingClientRect().left - box.left + 8,
    };
  });
  const png = PNG.sync.read(await table.screenshot({ scale: 'css' }));
  const near = (y0) => {
    const found = new Set();
    for (let y = Math.round(y0) - 3; y <= Math.round(y0) + 3; y++) {
      const i = (y * png.width + Math.round(edges.x)) * 4;
      found.add(`${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`);
    }
    return found;
  };
  for (const y of [edges.theadBottom, edges.tfootTop]) {
    expect(near(y).has('0,0,255')).toBe(true);
    expect(near(y).has('255,0,0')).toBe(false);
  }
  expect(near(edges.betweenBody).has('255,0,0')).toBe(true);
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
