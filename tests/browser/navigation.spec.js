import { test, expect } from '@playwright/test';

const PAGE = '/tests/pages/nav.html';

const rects = (page, sel) =>
  page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => {
    const r = e.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height };
  }), sel);

const style = (page, sel, prop) =>
  page.evaluate(([s, p]) => getComputedStyle(document.querySelector(s))[p], [sel, prop]);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(PAGE);
});

test('two-list nav puts lists at start and end edges', async ({ page }) => {
  const [first, second] = await rects(page, '#two nav > ul');
  const header = (await rects(page, '#two'))[0];
  const pad = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#two')).paddingLeft));
  expect(first.left).toBeCloseTo(header.left + pad, 0);
  expect(second.right).toBeCloseTo(header.right - pad, 0);
  expect(second.left).toBeGreaterThan(first.right + 100);
  expect(Math.abs(first.top - second.top)).toBeLessThan(10);
  const items = await rects(page, '#two nav > ul:last-child > li');
  expect(items[1].left).toBeGreaterThan(items[0].left);
  expect(Math.abs(items[1].top - items[0].top)).toBeLessThan(2);
});

test('single list starts at the start edge', async ({ page }) => {
  const [list] = await rects(page, '#single nav > ul');
  const header = (await rects(page, '#single'))[0];
  const pad = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#single')).paddingLeft));
  expect(list.left).toBeCloseTo(header.left + pad, 0);
  const items = await rects(page, '#single nav > ul > li');
  expect(items[1].left).toBeGreaterThan(items[0].right - 1);
  expect(Math.abs(items[1].top - items[0].top)).toBeLessThan(2);
  expect(await style(page, '#single nav > ul', 'listStyleType')).toBe('none');
});

test('nav wrapped in a div inside the masthead is still horizontal', async ({ page }) => {
  expect(await style(page, '#wrapped nav > ul', 'display')).toBe('flex');
  const items = await rects(page, '#wrapped nav > ul > li');
  expect(Math.abs(items[1].top - items[0].top)).toBeLessThan(2);
});

test('nested submenu ul stays vertical', async ({ page }) => {
  expect(await style(page, '#submenu nav > ul', 'display')).toBe('flex');
  expect(await style(page, '#submenu nav > ul ul', 'display')).not.toBe('flex');
  const kids = await rects(page, '#submenu nav > ul ul > li');
  expect(kids[1].top).toBeGreaterThan(kids[0].top);
});

test('footer, aside, main and article navs are ordinary lists', async ({ page }) => {
  for (const id of ['footer-nav', 'aside-nav', 'main-nav', 'article-nav']) {
    expect(await style(page, `#${id}`, 'display'), id).toBe('block');
    expect(await style(page, `#${id} > ul`, 'display'), id).toBe('block');
    expect(await style(page, `#${id} > ul`, 'listStyleType'), id).not.toBe('none');
  }
});

test('masthead nav wraps at 375 without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const d = await page.evaluate(() => ({
    s: document.documentElement.scrollWidth,
    c: document.documentElement.clientWidth,
  }));
  expect(d.s).toBeLessThanOrEqual(d.c);
  const items = await rects(page, '#many nav > ul:last-child > li');
  expect(Math.max(...items.map((i) => i.top))).toBeGreaterThan(Math.min(...items.map((i) => i.top)) + 10);
});

test('breadcrumb matches case-insensitively', async ({ page }) => {
  expect(await style(page, '#crumb-upper ol', 'display')).toBe('flex');
  expect(await style(page, '#crumb ol', 'display')).toBe('flex');
  expect(await style(page, '#crumb ol', 'listStyleType')).toBe('none');
});

test('breadcrumb separator is hidden from the accessibility tree', async ({ page }) => {
  const sep = await page.evaluate(() => getComputedStyle(document.querySelector('#crumb li + li'), '::before').content);
  expect(sep).toContain('/');
  const snap = await page.locator('#crumb').ariaSnapshot();
  // ariaSnapshot writes "/url:" for links; the separator would appear as "/" text or inside a name.
  expect(snap.replace(/\/url:/g, '')).not.toContain('/');
  const items = await rects(page, '#crumb li');
  expect(Math.abs(items[1].top - items[0].top)).toBeLessThan(2);
});

test('breadcrumb current page has no underline', async ({ page }) => {
  expect(await style(page, '#crumb li[aria-current="page"]', 'textDecorationLine')).toBe('none');
});

test('masthead nav link targets are at least 24px tall', async ({ page }) => {
  const links = await rects(page, '#two nav a, #single nav a, #many nav a');
  for (const l of links) expect(l.height).toBeGreaterThanOrEqual(24);
});
