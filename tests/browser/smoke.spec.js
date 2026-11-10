import { test, expect } from '@playwright/test';
import { DEMO } from '../helpers/env.js';

test('body uses tokens and not pure black or white', async ({ page }) => {
  await page.goto(DEMO);
  const s = await page.evaluate(() => {
    const c = getComputedStyle(document.body);
    return {
      family: c.fontFamily,
      lineHeight: parseFloat(c.lineHeight),
      fontSize: parseFloat(c.fontSize),
      background: c.backgroundColor,
      color: c.color,
      htmlBackground: getComputedStyle(document.documentElement).backgroundColor,
    };
  });
  expect(s.family.startsWith('system-ui')).toBe(true);
  expect(s.lineHeight / s.fontSize).toBeCloseTo(1.6, 1);
  for (const value of [s.htmlBackground, s.background, s.color]) {
    expect(value).not.toBe('rgb(255, 255, 255)');
    expect(value).not.toBe('rgb(0, 0, 0)');
  }
});
