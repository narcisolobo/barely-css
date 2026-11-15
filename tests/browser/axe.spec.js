import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DEMO, setTheme } from '../helpers/env.js';

test('demo has no axe violations', async ({ page, colorScheme }) => {
  await page.goto(DEMO);
  const run = async () => (await new AxeBuilder({ page }).analyze()).violations;
  expect(await run()).toEqual([]);
  await setTheme(page, colorScheme === 'dark' ? 'light' : 'dark');
  expect(await run()).toEqual([]);
});
