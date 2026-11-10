import { test, expect } from '@playwright/test';
import { DEMO, forcedMode, tabKey } from '../helpers/env.js';

test('forced-colors media query applies', async ({ page }) => {
  await page.goto(DEMO);
  const matches = await page.evaluate(() => matchMedia('(forced-colors: active)').matches);
  expect(matches).toBe(true);
});

test('focus outline is visible in forced colors', async ({ page, browserName }, testInfo) => {
  test.skip(forcedMode(testInfo) !== 'active', 'WebKit only reports the media query');
  await page.goto(DEMO);
  for (const selector of ['a[href]', 'button']) {
    // Tab from the top of the page until the first matching element has focus.
    await page.evaluate(() => document.activeElement?.blur());
    const target = page.locator(selector).first();
    for (let i = 0; i < 50 && !(await target.evaluate((n) => n === document.activeElement)); i++) {
      await page.keyboard.press(tabKey(browserName));
    }
    await expect(target).toBeFocused();
    const outline = await target.evaluate((n) => {
      const s = getComputedStyle(n);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(outline.style, selector).not.toBe('none');
    expect(outline.width, selector).toBeGreaterThanOrEqual(2);
  }
});
