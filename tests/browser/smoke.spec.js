import { test, expect } from '@playwright/test';
import { DEMO } from '../helpers/env.js';
import { paintedRgb } from '../helpers/paint.js';

test('body uses tokens and not pure black or white', async ({ page }) => {
  await page.goto(DEMO);
  const s = await page.evaluate(() => {
    const c = getComputedStyle(document.body);
    return {
      family: c.fontFamily,
      lineHeight: parseFloat(c.lineHeight),
      fontSize: parseFloat(c.fontSize),
    };
  });
  expect(s.family.startsWith('system-ui')).toBe(true);
  expect(s.lineHeight / s.fontSize).toBeCloseTo(1.6, 1);

  const background = await paintedRgb(page, 'html', 'backgroundColor');
  const text = await paintedRgb(page, 'body', 'color');
  for (const rgb of [background, text]) {
    expect(rgb).not.toEqual([255, 255, 255]);
    expect(rgb).not.toEqual([0, 0, 0]);
  }
});
