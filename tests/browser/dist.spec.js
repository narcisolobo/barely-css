import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { DEMO } from '../helpers/env.js';

const serialize = () =>
  [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules].map((r) => r.cssText));

test('minified CSS produces the same CSSOM', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-light', 'Chromium light only');
  await page.goto(DEMO);
  const full = await page.evaluate(serialize);
  const min = readFileSync(new URL('../../dist/barely.min.css', import.meta.url), 'utf8');
  await page.route('**/dist/barely.css', (route) =>
    route.fulfill({ contentType: 'text/css', body: min }),
  );
  await page.goto(DEMO);
  const minified = await page.evaluate(serialize);
  expect(full.length).toBeGreaterThan(0);
  expect(minified).toEqual(full);
});
