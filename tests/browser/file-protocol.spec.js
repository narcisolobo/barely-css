import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('demo renders over file://', async ({ page }) => {
  await page.goto(pathToFileURL(resolve('demo/index.html')).href);
  const r = await page.evaluate(() => {
    const sheet = document.styleSheets[0];
    let rules = null;
    try {
      rules = sheet.cssRules.length;
    } catch {
      // Chromium and WebKit treat file:// stylesheets as cross-origin and refuse cssRules.
    }
    return {
      sheet: Boolean(sheet),
      rules,
      token: getComputedStyle(document.documentElement).getPropertyValue('--barely-font-size').trim(),
      family: getComputedStyle(document.body).fontFamily,
    };
  });
  expect(r.sheet).toBe(true);
  if (r.rules !== null) expect(r.rules).toBeGreaterThan(0);
  expect(r.token).not.toBe('');
  expect(r.family.startsWith('system-ui')).toBe(true);
});
