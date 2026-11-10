import { test, expect } from '@playwright/test';
import { DEMO, forcedMode, tabKey } from '../helpers/env.js';
import { tagElements, expectedStops, walkTabStops, assertOrder } from '../helpers/tab-order.js';
import { focusRingReport } from '../helpers/page-color.js';

test.beforeEach(async ({ page }) => {
  await page.goto(DEMO);
  await tagElements(page);
});

test('every interactive element is reachable in source order', async ({ page, browserName }) => {
  assertOrder(await walkTabStops(page, tabKey(browserName)), await expectedStops(page));
});

test('shift+tab visits the same stops in reverse', async ({ page, browserName }) => {
  const key = `Shift+${tabKey(browserName)}`;
  const actual = await walkTabStops(page, key);
  const expected = await expectedStops(page);
  assertOrder(actual, { required: [...expected.required].reverse(), optional: expected.optional });
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
    if (!r.inViewport || r.covered) {
      await expect.poll(async () => (await focusRingReport(page)).inViewport, { timeout: 2000 }).toBe(true);
      r = await focusRingReport(page);
    }
    if (reports.at(-1)?.id === r.id) continue;
    reports.push(r);
  }
  expect(reports.length).toBeGreaterThan(0);
  for (const r of reports) {
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
