import { test, expect } from '@playwright/test';
import { tabKey } from '../helpers/env.js';
import { tagElements, expectedStops, walkTabStops, assertOrder } from '../helpers/tab-order.js';
import { focusRingReport, paintedRgba } from '../helpers/page-color.js';
import { srgb8ToLinear, contrast } from '../helpers/color.js';

const idsOf = (page, kbIds) =>
  page.evaluate((list) => list.map((n) => document.querySelector(`[data-kb-id="${n}"]`).id), kbIds);

test.describe('tab-order helper on tests/pages/tab-stops.html', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tests/pages/tab-stops.html');
    await tagElements(page);
  });

  const forward = [
    'first', 'div-stop', 'unchecked-1', 'checked-2', 'last',
  ];

  test('expected stops skip negative tabindex and group named radios', async ({ page }) => {
    const expected = await expectedStops(page);
    expect(await idsOf(page, expected.required)).toEqual(forward);
    expect(Object.values(expected.alternates)).toHaveLength(1);
    expect(await idsOf(page, Object.values(expected.alternates)[0])).toEqual(['unchecked-1', 'unchecked-2', 'unchecked-3']);
  });

  test('forward walk matches', async ({ page, browserName }) => {
    const actual = await walkTabStops(page, tabKey(browserName));
    assertOrder(actual, await expectedStops(page));
    expect(await idsOf(page, actual)).toEqual(forward);
  });

  test('reverse walk matches', async ({ page, browserName }) => {
    const actual = await walkTabStops(page, `Shift+${tabKey(browserName)}`);
    const expected = await expectedStops(page);
    assertOrder(actual, { ...expected, required: [...expected.required].reverse() });
  });
});

test.describe('radios with no name or name="" on tests/pages/unnamed-radios.html', () => {
  const all = ['first', 'unnamed-1', 'unnamed-2', 'empty-1', 'empty-2', 'last'];

  test.beforeEach(async ({ page }) => {
    await page.goto('/tests/pages/unnamed-radios.html');
    await tagElements(page);
  });

  test('each is its own stop, counted once', async ({ page }) => {
    expect(await idsOf(page, (await expectedStops(page)).required)).toEqual(all);
  });

  test('forward walk matches', async ({ page, browserName }) => {
    // WebKit treats nameless radios as one group (Tab enters the first only); HTML says they are ungrouped.
    test.fixme(browserName === 'webkit', 'WebKit groups radios that have no name');
    const actual = await walkTabStops(page, tabKey(browserName));
    expect(await idsOf(page, actual)).toEqual(all);
  });
});

test.describe('focus ring contrast on tests/pages/focus-ring.html', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tests/pages/focus-ring.html');
    await tagElements(page);
  });

  async function focusWithKeyboard(page, browserName, id) {
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press(tabKey(browserName));
      if (await page.evaluate((x) => document.activeElement?.id === x, id)) return;
    }
    throw new Error(`could not tab to #${id}`);
  }

  const ratio = (a, b) => contrast(srgb8ToLinear(a), srgb8ToLinear(b));

  test('a positive-offset ring is measured against the page, not the button fill', async ({ page, browserName }) => {
    await focusWithKeyboard(page, browserName, 'outside');
    const report = await focusRingReport(page);
    expect(report.offset).toBeGreaterThanOrEqual(0);
    const ring = (await paintedRgba(page.locator('#outside'), 'outlineColor')).slice(0, 3);
    expect(report.contrast).toBeCloseTo(ratio(ring, [255, 255, 255]), 5);
    expect(report.contrast).not.toBeCloseTo(ratio(ring, [10, 10, 10]), 1);
  });

  test('a negative-offset ring is measured against the button fill', async ({ page, browserName }) => {
    await focusWithKeyboard(page, browserName, 'inside');
    const report = await focusRingReport(page);
    expect(report.offset).toBeLessThan(0);
    const ring = (await paintedRgba(page.locator('#inside'), 'outlineColor')).slice(0, 3);
    expect(report.contrast).toBeCloseTo(ratio(ring, [10, 10, 10]), 5);
  });
});
