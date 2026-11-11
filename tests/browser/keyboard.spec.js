import { test, expect } from '@playwright/test';
import { DEMO, forcedMode, tabKey } from '../helpers/env.js';
import { tagElements, expectedStops, walkTabStops, assertOrder } from '../helpers/tab-order.js';
import { focusRingReport } from '../helpers/page-color.js';

test.beforeEach(async ({ page }) => {
  await page.goto(DEMO);
  await tagElements(page);
});

test('every interactive element is reachable in source order', async ({ page, browserName }) => {
  assertOrder(await walkTabStops(page, tabKey(browserName)), await expectedStops(page, browserName));
});

test('shift+tab visits the same stops in reverse', async ({ page, browserName }) => {
  const key = `Shift+${tabKey(browserName)}`;
  const actual = await walkTabStops(page, key);
  const expected = await expectedStops(page, browserName);
  assertOrder(actual, { ...expected, required: [...expected.required].reverse() });
});

test('tabbing past the last element leaves the page', async ({ page, browserName }) => {
  const key = tabKey(browserName);
  const stops = await walkTabStops(page, key);
  expect(stops.length).toBeGreaterThan(0);
  // The walk ends with the press that follows the last stop; that press must leave the page.
  test.info().annotations.push({ type: 'after-last-stop', description: stops.end });
  expect(stops.end).toBe('body');
  const active = await page.evaluate(() => document.activeElement === document.body || document.activeElement === null);
  expect(active).toBe(true);
});

test('focus is visible and unobscured at every stop', async ({ page, browserName }, testInfo) => {
  const key = tabKey(browserName);
  const forced = forcedMode(testInfo);
  const reports = [];
  for (let i = 0; i < 400; i++) {
    await page.keyboard.press(key);
    let r = await focusRingReport(page);
    if (r === null) break;
    // Engines scroll the focused element into view asynchronously; give the layout a moment to settle.
    if (r.tag !== 'iframe' && (!r.inViewport || r.covered)) {
      await expect.poll(async () => (await focusRingReport(page)).inViewport, { timeout: 2000 }).toBe(true);
      r = await focusRingReport(page);
    }
    if (reports.at(-1)?.id === r.id) continue;
    reports.push(r);
  }
  expect(reports.length).toBeGreaterThan(0);
  expect(reports.some((r) => r.tag === 'iframe')).toBe(true);
  for (const r of reports) {
    // An iframe stop is excused from the ring assertions: focus moves into the embedded document, which owns its
    // own focus indicator, and in chromium, firefox and webkit no parent-side selector (:focus, :focus-visible,
    // :focus-within) matches the iframe element, so parent CSS cannot paint a ring. It must still appear in the walk.
    if (r.tag === 'iframe') continue;
    const label = `stop ${r.id} <${r.tag}> center/viewport ${r.center}`;
    expect(r.style, label).not.toBe('none');
    expect(r.width, label).toBeGreaterThanOrEqual(2);
    // Forced colors uses the user's system colors (Highlight), so 3:1 is not ours to guarantee.
    // WebKit reports 'media-only': it matches the query and applies our Highlight rule, so skip there too.
    if (forced === 'off') expect(r.contrast, label).toBeGreaterThanOrEqual(3);
    expect(r.inViewport, label).toBe(true);
    expect(r.covered, label).toBe(false);
  }
});

test.describe('table scroll wrapper', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('table scroll wrapper scrolls with arrow keys', async ({ page, browserName }) => {
    const wrapper = page.locator('#schedule-region');
    await wrapper.focus();
    expect(await wrapper.evaluate((el) => [document.activeElement === el, el.scrollWidth > el.clientWidth])).toEqual([true, true]);
    // Playwright's WebKit does not arrow-scroll any focused scroll container, even a bare
    // `<div tabindex=0 style="overflow-x:auto">` with no stylesheet. It is an engine limit, not our CSS.
    test.skip(browserName === 'webkit', 'Playwright WebKit does not scroll containers with arrow keys');
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await expect.poll(() => wrapper.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  });
});

test('range steps with arrow keys', async ({ page }) => {
  await page.goto('/tests/pages/forms.html');
  const range = page.locator('#range');
  await range.focus();
  const read = () => range.evaluate((el) => [Number(el.value), Number(el.step)]);
  const [before, step] = await read();
  await page.keyboard.press('ArrowRight');
  expect((await read())[0]).toBe(before + step);
});
