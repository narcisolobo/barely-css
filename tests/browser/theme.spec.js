import { test, expect } from '@playwright/test';
import { DEMO, setTheme } from '../helpers/env.js';
import { paintedRgb } from '../helpers/paint.js';

const rgbOf = (page, selector) => paintedRgb(page, selector, 'backgroundColor');


const isDark = (rgb) => rgb.every((n) => n < 100);
const isLight = (rgb) => rgb.every((n) => n > 200);

test('data-theme on html forces the theme', async ({ page }) => {
  await page.goto(DEMO);
  await setTheme(page, 'dark');
  expect(isDark(await rgbOf(page, 'html'))).toBe(true);
  await setTheme(page, 'light');
  expect(isLight(await rgbOf(page, 'html'))).toBe(true);
  await setTheme(page, 'dark');
  expect(isDark(await rgbOf(page, 'html'))).toBe(true);
});

test('nested data-theme scope repaints its subtree', async ({ page }) => {
  await page.goto(DEMO);
  for (const outer of ['light', 'dark']) {
    await setTheme(page, outer);
    expect(isDark(await rgbOf(page, '#nested-theme'))).toBe(true);
    expect(isLight(await rgbOf(page, '#nested-theme [data-theme="light"]'))).toBe(true);
  }
});

test('native controls follow color-scheme', async ({ page }) => {
  await page.goto(DEMO);
  const schemes = await page.evaluate(() => ({
    dark: getComputedStyle(document.querySelector('#nested-theme > p input')).colorScheme,
    light: getComputedStyle(document.querySelector('#nested-theme [data-theme="light"] input')).colorScheme,
  }));
  expect(schemes.dark).toBe('dark');
  expect(schemes.light).toBe('light');
});
