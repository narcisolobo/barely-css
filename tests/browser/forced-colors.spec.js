import { test, expect } from '@playwright/test';
import { DEMO } from '../helpers/env.js';

test('forced-colors media query applies', async ({ page }) => {
  await page.goto(DEMO);
  const matches = await page.evaluate(() => matchMedia('(forced-colors: active)').matches);
  expect(matches).toBe(true);
});
